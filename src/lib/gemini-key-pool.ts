import { ApiError, GoogleGenAI } from '@google/genai';

/** First retry after 30s; if still failing, disable for 24h. */
const RETRY_COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type KeyStatus = 'healthy' | 'cooldown' | 'disabled';

interface KeyStats {
  requests: number;
  errors: number;
  lastErrorCode: number | null;
  lastErrorAt: number | null;
}

interface KeyEntry {
  id: number;
  maskedKey: string;
  genAI: GoogleGenAI;
  status: KeyStatus;
  cooldownUntil: number;
  cooldownStep: number;
  stats: KeyStats;
}

export interface KeyStatusInfo {
  id: number;
  maskedKey: string;
  status: KeyStatus;
  cooldownUntil: number;
  stats: KeyStats;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-2)}`;
}

/** Retryable HTTP status codes — these trigger cooldown + retry with next key. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

/** Permanently disabling status codes — key is invalid. */
function isDisablingStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export class KeyPool {
  private entries: KeyEntry[];
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
      status: 'healthy' as KeyStatus,
      cooldownUntil: 0,
      cooldownStep: 0,
      stats: { requests: 0, errors: 0, lastErrorCode: null, lastErrorAt: null },
    }));
  }

  /** Round-robin acquire the next healthy key. Auto-recovers expired cooldowns. */
  acquire(): { id: number; genAI: GoogleGenAI } {
    const now = Date.now();
    const len = this.entries.length;

    for (let i = 0; i < len; i++) {
      const idx = (this.pointer + i) % len;
      const entry = this.entries[idx];

      // Auto-recover expired cooldowns
      if (entry.status === 'cooldown' && now >= entry.cooldownUntil) {
        entry.status = 'healthy';
      }

      if (entry.status === 'healthy') {
        this.pointer = (idx + 1) % len;
        return { id: entry.id, genAI: entry.genAI };
      }
    }

    throw new Error('All Gemini API keys are unavailable');
  }

  /** Record a successful call — resets backoff step. */
  reportSuccess(keyId: number): void {
    const entry = this.entries[keyId];
    if (!entry) return;
    entry.stats.requests++;
    entry.cooldownStep = 0;
  }

  /** Record a failed call — enter cooldown or disable depending on status code. */
  reportFailure(keyId: number, httpStatus: number): void {
    const entry = this.entries[keyId];
    if (!entry) return;
    entry.stats.errors++;
    entry.stats.lastErrorCode = httpStatus;
    entry.stats.lastErrorAt = Date.now();

    if (isDisablingStatus(httpStatus)) {
      entry.status = 'disabled';
      console.error(`[KeyPool] Key ${entry.maskedKey} DISABLED (HTTP ${httpStatus})`);
      return;
    }

    if (isRetryableStatus(httpStatus)) {
      if (entry.cooldownStep === 0) {
        // First failure: short cooldown, will retry once
        entry.status = 'cooldown';
        entry.cooldownUntil = Date.now() + RETRY_COOLDOWN_MS;
        entry.cooldownStep = 1;
        console.warn(`[KeyPool] Key ${entry.maskedKey} COOLDOWN 30s (HTTP ${httpStatus})`);
      } else {
        // Second failure after retry: disable for 24h
        entry.status = 'cooldown';
        entry.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        entry.cooldownStep = 2;
        console.warn(`[KeyPool] Key ${entry.maskedKey} DISABLED 24h (HTTP ${httpStatus})`);
      }
    }
  }

  /** Snapshot of all key states for monitoring. */
  getStatus(): KeyStatusInfo[] {
    return this.entries.map((e) => ({
      id: e.id,
      maskedKey: e.maskedKey,
      status: e.status,
      cooldownUntil: e.cooldownUntil,
      stats: { ...e.stats },
    }));
  }

  /** Number of keys in the pool (for retry loop bounds). */
  get size(): number {
    return this.entries.length;
  }
}

/** Extract HTTP status from SDK errors. */
function extractStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  return (error as { status?: number })?.status;
}

/**
 * Create a GoogleGenAI-shaped Proxy that transparently does
 * round-robin key selection + auto-retry on retryable errors.
 */
export function createPooledProxy(pool: KeyPool): GoogleGenAI {
  const modelsProxy = new Proxy({} as GoogleGenAI['models'], {
    get(_, method: string) {
      return async (...args: unknown[]) => {
        let lastError: unknown;

        for (let i = 0; i < pool.size; i++) {
          const { id, genAI } = pool.acquire();
          try {
            const result = await (genAI.models as unknown as Record<string, Function>)[method](
              ...args,
            );
            pool.reportSuccess(id);
            return result;
          } catch (err) {
            lastError = err;
            const status = extractStatus(err);
            if (status !== undefined) {
              pool.reportFailure(id, status);
              if (isRetryableStatus(status) && i < pool.size - 1) continue;
            }
            throw err;
          }
        }

        throw lastError;
      };
    },
  });

  return new Proxy({} as GoogleGenAI, {
    get(_, prop) {
      if (prop === 'models') return modelsProxy;
      // Fallback: delegate to first healthy key for any other property
      return (pool.acquire().genAI as unknown as Record<string, unknown>)[prop as string];
    },
  });
}
