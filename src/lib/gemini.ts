import { ApiError, GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { AppError } from '@/lib/errors';
import { loadPoolState, savePoolState } from '@/lib/redis';

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

  constructor(input: string | PoolEntry[]) {
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
  async withRetry<T>(fn: (entry: PoolEntry) => Promise<T>): Promise<T> {
    const state = await loadPoolState();
    const now = Date.now();
    let lastError: unknown;

    try {
      const start = this.pointer;
      for (let i = 0; i < this.entries.length; i++) {
        const idx = (start + i) % this.entries.length;
        const entry = this.entries[idx];

        if (entry.disabled || (state.cd[idx] ?? 0) > now) continue;

        try {
          const result = await fn(entry);
          this.pointer = (idx + 1) % this.entries.length;
          const statsKey = `${entry.provider}:${entry.model}:${new Date().toISOString().split('T')[0]}`;
          state.stats[statsKey] = (state.stats[statsKey] ?? 0) + 1;
          return result;
        } catch (err) {
          lastError = err;
          const status = getHttpStatus(err);

          if (status === 401 || status === 403) {
            entry.disabled = true;
            console.error(
              `[KeyPool] ${entry.provider}:${entry.maskedKey} DISABLED permanently (HTTP ${status})`,
            );
            continue;
          }

          if (status && RETRYABLE.has(status)) {
            const isRepeat = !!state.cd[idx];
            state.cd[idx] = now + (isRepeat ? RATE_LIMIT_COOLDOWN_MS : RETRY_COOLDOWN_MS);
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

  getStatus(): KeyStatusInfo[] {
    return this.entries.map((e) => ({ id: e.id, maskedKey: e.maskedKey, disabled: e.disabled }));
  }
}

// ==================== Public API ====================

let _pooledProxy: GoogleGenAI | null = null;

/** Lazy: validated on first use so pages/tests without GEMINI_API_KEY don't crash at import. */
export function getGenAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }
  if (!_pooledProxy) {
    _pooledProxy = new KeyPool(process.env.GEMINI_API_KEY).asProxy();
  }
  return _pooledProxy;
}

// ==================== Chat Pool (multi-provider) ====================

function buildChatEntries(): PoolEntry[] {
  const chain = process.env.AI_CHAT_CHAIN || 'gemini:gemini-2.5-flash';
  const pairs = chain.split(',').map((s) => s.trim());
  const geminiKeys = (process.env.GEMINI_API_KEY || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const minimaxKey = process.env.MINIMAX_API_KEY;

  const entries: PoolEntry[] = [];
  let id = 0;

  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const provider = pair.slice(0, colonIdx).trim() as 'gemini' | 'minimax';
    const model = pair.slice(colonIdx + 1).trim();

    if (provider === 'gemini') {
      for (const key of geminiKeys) {
        entries.push({
          id: id++,
          provider: 'gemini',
          model,
          maskedKey: maskKey(key),
          client: new GoogleGenAI({ apiKey: key }),
          disabled: false,
        });
      }
    } else if (provider === 'minimax') {
      if (!minimaxKey) {
        console.warn('[KeyPool] MINIMAX_API_KEY not set — skipping MiniMax entry in AI_CHAT_CHAIN');
        continue;
      }
      entries.push({
        id: id++,
        provider: 'minimax',
        model,
        maskedKey: maskKey(minimaxKey),
        client: new OpenAI({ baseURL: 'https://api.minimax.io/v1', apiKey: minimaxKey }),
        disabled: false,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error(
      'AI_CHAT_CHAIN resolved to zero entries. Check GEMINI_API_KEY / MINIMAX_API_KEY.',
    );
  }

  return entries;
}

let _chatPool: KeyPool | null = null;

export function getChatPool(): KeyPool {
  if (!_chatPool) {
    _chatPool = new KeyPool(buildChatEntries());
  }
  return _chatPool;
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
