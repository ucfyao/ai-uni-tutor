import { ApiError, GoogleGenAI } from '@google/genai';
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

export interface KeyStatusInfo {
  id: number;
  maskedKey: string;
  disabled: boolean;
}

/** @internal Exported for testing only */
export class KeyPool {
  private entries: { id: number; maskedKey: string; genAI: GoogleGenAI; disabled: boolean }[];
  private pointer = 0;

  constructor(keysEnv: string) {
    const keys = keysEnv
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (keys.length === 0) {
      throw new Error('Missing GEMINI_API_KEY in environment variables');
    }

    this.entries = keys.map((key, i) => ({
      id: i,
      maskedKey: maskKey(key),
      genAI: new GoogleGenAI({ apiKey: key }),
      disabled: false,
    }));
  }

  /**
   * Execute `fn` with automatic key rotation, failover, and stats tracking.
   * 1 GET + 1 SET = 2 Redis calls per request.
   */
  async withRetry<T>(fn: (genAI: GoogleGenAI) => Promise<T>, model?: string): Promise<T> {
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
          const result = await fn(entry.genAI);
          this.pointer = (idx + 1) % this.entries.length;
          if (model) {
            const statsKey = `${model}:${new Date().toISOString().split('T')[0]}`;
            state.stats[statsKey] = (state.stats[statsKey] ?? 0) + 1;
          }
          return result;
        } catch (err) {
          lastError = err;
          const status =
            err instanceof ApiError ? err.status : (err as { status?: number })?.status;

          if (status === 401 || status === 403) {
            entry.disabled = true;
            console.error(`[KeyPool] Key ${entry.maskedKey} DISABLED permanently (HTTP ${status})`);
            continue;
          }

          if (status && RETRYABLE.has(status)) {
            const isRepeat = !!state.cd[idx];
            state.cd[idx] = now + (isRepeat ? RATE_LIMIT_COOLDOWN_MS : RETRY_COOLDOWN_MS);
            console.warn(
              `[KeyPool] Key ${entry.maskedKey} ${isRepeat ? 'DISABLED 24h' : 'COOLDOWN 30s'} (HTTP ${status})`,
            );
            continue;
          }

          throw err;
        }
      }

      throw lastError ?? new Error('All Gemini API keys are unavailable');
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
          const model = (args[0] as { model?: string })?.model;
          return this.withRetry(
            (genAI) => (genAI.models as unknown as Record<string, Function>)[method](...args),
            model,
          );
        },
    });

    return new Proxy({} as GoogleGenAI, {
      get: (_, prop) => (prop === 'models' ? modelsProxy : undefined),
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
