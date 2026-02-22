import { GoogleGenAI } from '@google/genai';

/** Cooldown steps in milliseconds: 30s, 60s, 5m, 15m */
const COOLDOWN_STEPS_MS = [30_000, 60_000, 300_000, 900_000];

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
      const step = Math.min(entry.cooldownStep, COOLDOWN_STEPS_MS.length - 1);
      const duration = COOLDOWN_STEPS_MS[step];
      entry.status = 'cooldown';
      entry.cooldownUntil = Date.now() + duration;
      entry.cooldownStep++;
      console.warn(
        `[KeyPool] Key ${entry.maskedKey} COOLDOWN ${duration / 1000}s (HTTP ${httpStatus})`,
      );
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
