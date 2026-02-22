import { ApiError, GoogleGenAI } from '@google/genai';
import { getRedis } from '@/lib/redis';

/**
 * Single Redis key `gemini:pool` stores cooldown state as number[].
 * Each element = cooldown-until timestamp (ms).
 *   0 or absent  → available
 *   > Date.now() → in cooldown, skip
 */
const REDIS_KEY = 'gemini:pool';
const RETRY_COOLDOWN_MS = 30_000;
const RATE_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const KEY_TTL_S = 24 * 60 * 60;

interface KeyEntry {
  id: number;
  maskedKey: string;
  genAI: GoogleGenAI;
  disabled: boolean; // 401/403 — permanent, in-memory
}

export interface KeyStatusInfo {
  id: number;
  maskedKey: string;
  disabled: boolean;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-2)}`;
}

function extractStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  return (error as { status?: number })?.status;
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
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
      disabled: false,
    }));
  }

  /**
   * Execute `fn` with automatic key rotation and failover.
   *
   * 1. GET cooldown state from Redis (1 call)
   * 2. Try each available key — on retryable error, mark 30s cooldown (or 24h if repeat), try next
   * 3. On success: clear cooldown if any, SET only if state changed
   * 4. All keys exhausted: SET state, throw error
   */
  async withRetry<T>(fn: (genAI: GoogleGenAI) => Promise<T>): Promise<T> {
    // 1. Read state — single GET
    let cooldowns: number[];
    try {
      cooldowns = (await getRedis().get<number[]>(REDIS_KEY)) ?? [];
    } catch {
      cooldowns = [];
    }

    const now = Date.now();
    const len = this.entries.length;
    let dirty = false;
    let lastError: unknown;

    // 2. Try each key (start fixed to avoid pointer drift mid-loop)
    const start = this.pointer;
    for (let i = 0; i < len; i++) {
      const idx = (start + i) % len;
      const entry = this.entries[idx];

      if (entry.disabled) continue;
      if ((cooldowns[idx] ?? 0) > now) continue;

      try {
        const result = await fn(entry.genAI);

        // Success — advance pointer, clear cooldown if any
        this.pointer = (idx + 1) % len;
        if (cooldowns[idx]) {
          cooldowns[idx] = 0;
          dirty = true;
        }
        if (dirty) await this.save(cooldowns);
        return result;
      } catch (err) {
        lastError = err;
        const status = extractStatus(err);

        if (status === 401 || status === 403) {
          entry.disabled = true;
          console.error(`[KeyPool] Key ${entry.maskedKey} DISABLED permanently (HTTP ${status})`);
          continue;
        }

        if (status && isRetryable(status)) {
          if (!cooldowns[idx]) {
            // First failure: 30s cooldown, auto-recovers
            cooldowns[idx] = now + RETRY_COOLDOWN_MS;
            console.warn(`[KeyPool] Key ${entry.maskedKey} COOLDOWN 30s (HTTP ${status})`);
          } else {
            // Already failed before ("on notice") → 24h cooldown
            cooldowns[idx] = now + RATE_LIMIT_COOLDOWN_MS;
            console.warn(`[KeyPool] Key ${entry.maskedKey} DISABLED 24h (HTTP ${status})`);
          }
          dirty = true;
          continue;
        }

        // Non-retryable (e.g. 400) — save state and throw
        if (dirty) await this.save(cooldowns);
        throw err;
      }
    }

    // 3. All keys exhausted
    if (dirty) await this.save(cooldowns);
    throw lastError ?? new Error('All Gemini API keys are unavailable');
  }

  private async save(cooldowns: number[]): Promise<void> {
    try {
      await getRedis().set(REDIS_KEY, cooldowns, { ex: KEY_TTL_S });
    } catch {
      // Redis unavailable — fail-open
    }
  }

  getStatus(): KeyStatusInfo[] {
    return this.entries.map((e) => ({
      id: e.id,
      maskedKey: e.maskedKey,
      disabled: e.disabled,
    }));
  }

  get size(): number {
    return this.entries.length;
  }
}

/**
 * Create a GoogleGenAI-shaped Proxy — delegates all `models.*` calls
 * through `pool.withRetry` for transparent key rotation.
 */
export function createPooledProxy(pool: KeyPool): GoogleGenAI {
  const modelsProxy = new Proxy({} as GoogleGenAI['models'], {
    get(_, method: string) {
      return (...args: unknown[]) =>
        pool.withRetry((genAI) =>
          (genAI.models as unknown as Record<string, Function>)[method](...args),
        );
    },
  });

  return new Proxy({} as GoogleGenAI, {
    get(_, prop) {
      if (prop === 'models') return modelsProxy;
      return undefined;
    },
  });
}
