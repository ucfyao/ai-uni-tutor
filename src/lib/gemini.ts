import { ApiError, GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AppError } from '@/lib/errors';
import { loadPoolState, savePoolState } from '@/lib/redis';
import { getLlmLogService, LlmLogService } from '@/lib/services/LlmLogService';
import type { LlmCallContext } from '@/lib/services/LlmLogService';
import type { Json } from '@/types/database';

export const GEMINI_MODELS = {
  chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
  parse: process.env.GEMINI_PARSE_MODEL || 'gemini-2.0-flash',
  embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
} as const;

// ==================== Key Pool ====================

const RETRY_COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RETRYABLE = new Set([429, 500, 503]);

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-2)}`;
}

export interface PoolEntry {
  id: number;
  provider: 'gemini' | 'minimax';
  model: string;
  maskedKey: string;
  client: GoogleGenAI | OpenAI;
  disabled: boolean;
}

export interface KeyStatusInfo {
  id: number;
  maskedKey: string;
  disabled: boolean;
}

export interface PoolEntryStatus {
  id: number;
  provider: 'gemini' | 'minimax';
  maskedKey: string;
  disabled: boolean;
  cooldownUntil: number;
  failCount: number; // from state.fails
  pool: 'default' | 'chat';
}

export interface PoolStatusResponse {
  entries: PoolEntryStatus[];
  serverTime: number;
}

function getHttpStatus(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  // openai package throws APIError with .status
  const asAny = err as { status?: number; error?: { status?: number } };
  return asAny?.status ?? asAny?.error?.status;
}

/** @internal Exported for testing only */
export class KeyPool {
  private entries: PoolEntry[];
  private pointer = 0;
  readonly poolName: string;

  constructor(input: string | PoolEntry[], poolName: string = 'default') {
    this.poolName = poolName;
    if (Array.isArray(input)) {
      // Overload 2: pre-built entries (used by getChatPool)
      if (input.length === 0) {
        throw new Error('KeyPool: entries array must not be empty');
      }
      this.entries = input;
    } else {
      // Overload 1: Gemini-only from comma-separated key string (existing behaviour)
      const keys = input
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (keys.length === 0) {
        throw new Error('Missing GEMINI_API_KEY in environment variables');
      }

      this.entries = keys.map((key, i) => ({
        id: i,
        provider: 'gemini' as const,
        model: GEMINI_MODELS.chat,
        maskedKey: maskKey(key),
        client: new GoogleGenAI({ apiKey: key }),
        disabled: false,
      }));
    }
  }

  /**
   * Execute `fn` with automatic key rotation, failover, and stats tracking.
   * 1 GET + 1 SET = 2 Redis calls per request.
   */
  async withRetry<T>(fn: (entry: PoolEntry) => Promise<T>, context?: LlmCallContext): Promise<T> {
    const state = await loadPoolState();
    const now = Date.now();
    let lastError: unknown;

    try {
      const start = this.pointer;
      for (let i = 0; i < this.entries.length; i++) {
        const idx = (start + i) % this.entries.length;
        const entry = this.entries[idx];
        const cdKey = `${this.poolName}:${idx}`;

        if (entry.disabled || (state.cd[cdKey] ?? 0) > now) continue;

        const callStart = Date.now();
        try {
          const result = await fn(entry);
          this.pointer = (idx + 1) % this.entries.length;
          delete state.fails[cdKey];
          const statsKey = `${entry.model}:${new Date().toISOString().split('T')[0]}`;
          state.stats[statsKey] = (state.stats[statsKey] ?? 0) + 1;

          // Fire-and-forget call logging
          const latencyMs = Date.now() - callStart;
          getLlmLogService().logCall({
            user_id: context?.userId ?? null,
            call_type: context?.callType ?? LlmLogService.inferCallType(entry.model),
            provider: entry.provider,
            model: entry.model,
            status: 'success',
            latency_ms: latencyMs,
            metadata: (context?.metadata ?? {}) as Json,
          });

          return result;
        } catch (err) {
          lastError = err;
          const status = getHttpStatus(err);
          const latencyMs = Date.now() - callStart;

          // Log the failed call
          getLlmLogService().logCall({
            user_id: context?.userId ?? null,
            call_type: context?.callType ?? LlmLogService.inferCallType(entry.model),
            provider: entry.provider,
            model: entry.model,
            status: 'error',
            error_message: err instanceof Error ? err.message : String(err),
            latency_ms: latencyMs,
            metadata: (context?.metadata ?? {}) as Json,
          });

          if (status === 401 || status === 403) {
            entry.disabled = true;
            console.error(
              `[KeyPool] ${entry.provider}:${entry.maskedKey} DISABLED permanently (HTTP ${status})`,
            );
            continue;
          }

          if (status && RETRYABLE.has(status)) {
            const prevFails = state.fails[cdKey] ?? 0;
            state.fails[cdKey] = prevFails + 1;
            const isRepeat = prevFails >= 1;
            state.cd[cdKey] = now + (isRepeat ? RATE_LIMIT_COOLDOWN_MS : RETRY_COOLDOWN_MS);
            console.warn(
              `[KeyPool] ${entry.provider}:${entry.maskedKey} ${isRepeat ? 'DISABLED 24h' : 'COOLDOWN 30s'} (HTTP ${status})`,
            );
            continue;
          }

          throw err;
        }
      }

      throw lastError ?? new Error('All AI pool entries are unavailable');
    } finally {
      await savePoolState(state);
    }
  }

  /** Create a GoogleGenAI-compatible proxy that routes all calls through the pool. */
  asProxy(): GoogleGenAI {
    const modelsProxy = new Proxy({} as GoogleGenAI['models'], {
      get:
        (_, method: string) =>
        (...args: unknown[]) => {
          return this.withRetry((entry) =>
            ((entry.client as GoogleGenAI).models as unknown as Record<string, Function>)[method](
              ...args,
            ),
          );
        },
    });

    const filesProxy = new Proxy({} as GoogleGenAI['files'], {
      get:
        (_, method: string) =>
        (...args: unknown[]) => {
          return this.withRetry((entry) =>
            ((entry.client as GoogleGenAI).files as unknown as Record<string, Function>)[method](
              ...args,
            ),
          );
        },
    });

    return new Proxy({} as GoogleGenAI, {
      get: (_, prop) => {
        if (prop === 'models') return modelsProxy;
        if (prop === 'files') return filesProxy;
        return undefined;
      },
    });
  }

  getEntries(): readonly PoolEntry[] {
    return [...this.entries];
  }

  getStatus(): KeyStatusInfo[] {
    return this.entries.map((e) => ({ id: e.id, maskedKey: e.maskedKey, disabled: e.disabled }));
  }
}

// ==================== Public API ====================

/** @internal Exported for testing only */
export let _pooledProxy: GoogleGenAI | null = null;
/** @internal Exported for testing only */
export let _defaultPool: KeyPool | null = null;

/** @internal Reset pool singletons for testing only */
export function _resetPools(): void {
  _pooledProxy = null;
  _defaultPool = null;
  _chatPool = null;
}

/** Lazy: validated on first use so pages/tests without GEMINI_API_KEY don't crash at import. */
export function getGenAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }
  if (!_pooledProxy) {
    _defaultPool = new KeyPool(process.env.GEMINI_API_KEY, 'default');
    _pooledProxy = _defaultPool.asProxy();
  }
  return _pooledProxy;
}

/** Return the default KeyPool for callers that need a single `withRetry` around multi-step ops. */
export function getDefaultPool(): KeyPool {
  getGenAI(); // ensure pool is initialised
  return _defaultPool!;
}

// ==================== Chat Pool (multi-provider) ====================

/** @internal Exported for testing only */
export function buildChatEntries(): PoolEntry[] {
  const entries: PoolEntry[] = [];

  // Collect AI_CHAT_N entries sorted numerically
  const chatVars = Object.entries(process.env)
    .filter(([k]) => /^AI_CHAT_\d+$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  let id = 0;

  for (const [envKey, value] of chatVars) {
    if (!value) continue;
    const firstColon = value.indexOf(':');
    const secondColon = value.indexOf(':', firstColon + 1);
    if (firstColon === -1 || secondColon === -1) {
      console.warn(`[KeyPool] Skipping ${envKey}: expected provider:model:apiKey`);
      continue;
    }
    const provider = value.slice(0, firstColon).trim() as PoolEntry['provider'];
    const model = value.slice(firstColon + 1, secondColon).trim();
    const apiKey = value.slice(secondColon + 1).trim();

    if (!apiKey) {
      console.warn(`[KeyPool] Skipping ${envKey}: empty apiKey`);
      continue;
    }

    if (provider === 'gemini') {
      entries.push({
        id: id++,
        provider: 'gemini',
        model,
        maskedKey: maskKey(apiKey),
        client: new GoogleGenAI({ apiKey }),
        disabled: false,
      });
    } else if (provider === 'minimax') {
      entries.push({
        id: id++,
        provider: 'minimax',
        model,
        maskedKey: maskKey(apiKey),
        client: new OpenAI({ baseURL: 'https://api.minimax.io/v1', apiKey }),
        disabled: false,
      });
    } else {
      console.warn(`[KeyPool] Skipping ${envKey}: unknown provider "${provider}"`);
    }
  }

  // Backward compatible: fall back to GEMINI_API_KEY if no AI_CHAT_* vars
  if (entries.length === 0) {
    const geminiKeys = (process.env.GEMINI_API_KEY || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    for (const apiKey of geminiKeys) {
      entries.push({
        id: id++,
        provider: 'gemini',
        model: GEMINI_MODELS.chat,
        maskedKey: maskKey(apiKey),
        client: new GoogleGenAI({ apiKey }),
        disabled: false,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error(
      'No AI chat entries configured. Set AI_CHAT_0=provider:model:apiKey or GEMINI_API_KEY.',
    );
  }

  return entries;
}

/** @internal Exported for testing only */
export let _chatPool: KeyPool | null = null;

export function getChatPool(): KeyPool {
  if (!_chatPool) {
    _chatPool = new KeyPool(buildChatEntries(), 'chat');
  }
  return _chatPool;
}

/**
 * Collect all unique model names configured across both pools + GEMINI_MODELS.
 * Used by admin UI to populate filter dropdowns dynamically.
 */
export function getAllConfiguredModels(): string[] {
  const models = new Set(Object.values(GEMINI_MODELS));

  // Initialize pools if not yet done
  if (!_defaultPool && process.env.GEMINI_API_KEY) {
    try {
      getGenAI();
    } catch {
      /* ignore */
    }
  }
  if (!_chatPool) {
    try {
      getChatPool();
    } catch {
      /* ignore */
    }
  }

  if (_defaultPool) {
    for (const e of _defaultPool.getEntries()) models.add(e.model);
  }
  if (_chatPool) {
    for (const e of _chatPool.getEntries()) models.add(e.model);
  }

  return [...models];
}

export async function getPoolStatusInfo(): Promise<PoolStatusResponse> {
  const state = await loadPoolState();
  const now = Date.now();
  const entries: PoolEntryStatus[] = [];

  // Initialize default pool if env var present but not yet initialized
  if (!_defaultPool && process.env.GEMINI_API_KEY) {
    try {
      getGenAI();
    } catch {
      /* initialization failed */
    }
  }

  if (_defaultPool) {
    for (const entry of _defaultPool.getEntries()) {
      const cdKey = `default:${entry.id}`;
      entries.push({
        id: entry.id,
        provider: entry.provider,
        maskedKey: entry.maskedKey,
        disabled: entry.disabled,
        cooldownUntil: (state.cd[cdKey] ?? 0) > now ? state.cd[cdKey] : 0,
        failCount: state.fails[cdKey] ?? 0,
        pool: 'default',
      });
    }
  }

  if (!_chatPool) {
    try {
      getChatPool();
    } catch {
      /* no chat pool configured */
    }
  }

  if (_chatPool) {
    for (const entry of _chatPool.getEntries()) {
      const cdKey = `chat:${entry.id}`;
      entries.push({
        id: entry.id,
        provider: entry.provider,
        maskedKey: entry.maskedKey,
        disabled: entry.disabled,
        cooldownUntil: (state.cd[cdKey] ?? 0) > now ? state.cd[cdKey] : 0,
        failCount: state.fails[cdKey] ?? 0,
        pool: 'chat',
      });
    }
  }

  return { entries, serverTime: now };
}

/**
 * Parse any error thrown by the Gemini SDK into a structured AppError.
 * Checks `ApiError.status` first, then falls back to message pattern matching.
 */
export function parseGeminiError(error: unknown): AppError {
  if (error instanceof ApiError) {
    const { status, message } = error;
    if (status === 429) {
      const isQuota = /RESOURCE_EXHAUSTED|quota/i.test(message);
      return new AppError(isQuota ? 'GEMINI_QUOTA_EXCEEDED' : 'GEMINI_RATE_LIMITED');
    }
    if (status === 401 || status === 403) return new AppError('GEMINI_INVALID_KEY');
    if (status === 500 || status === 503) return new AppError('GEMINI_UNAVAILABLE');
    if (status === 400) {
      const isBlocked = /safety|blocked|HARM_CATEGORY/i.test(message);
      return new AppError(isBlocked ? 'GEMINI_CONTENT_BLOCKED' : 'GEMINI_ERROR');
    }
    return new AppError('GEMINI_ERROR');
  }

  if (error instanceof Error) {
    const msg = error.message || '';
    if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg))
      return new AppError('GEMINI_RATE_LIMITED');
    if (/safety|blocked|HARM_CATEGORY/i.test(msg)) return new AppError('GEMINI_CONTENT_BLOCKED');
    return new AppError('GEMINI_ERROR');
  }

  return new AppError('GEMINI_ERROR');
}
