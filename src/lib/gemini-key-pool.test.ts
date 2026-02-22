import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyPool } from './gemini-key-pool';

// Mock GoogleGenAI before importing KeyPool
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    _key: string;
    models: Record<string, ReturnType<typeof vi.fn>>;
    constructor({ apiKey }: { apiKey: string }) {
      this._key = apiKey;
      this.models = {
        generateContent: vi.fn().mockResolvedValue({ text: 'ok' }),
        generateContentStream: vi.fn().mockResolvedValue({ stream: true }),
        embedContent: vi.fn().mockResolvedValue({ embeddings: [] }),
      };
    }
  }
  class MockApiError extends Error {
    status: number;
    constructor({ status, message }: { status: number; message: string }) {
      super(message);
      this.status = status;
    }
  }
  return { GoogleGenAI: MockGoogleGenAI, ApiError: MockApiError };
});

describe('KeyPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates entries from comma-separated keys', () => {
      const pool = new KeyPool('key1,key2,key3');
      const status = pool.getStatus();
      expect(status).toHaveLength(3);
      expect(status.every((s) => s.status === 'healthy')).toBe(true);
    });

    it('trims whitespace from keys', () => {
      const pool = new KeyPool(' key1 , key2 ');
      expect(pool.getStatus()).toHaveLength(2);
    });

    it('works with single key', () => {
      const pool = new KeyPool('single-key');
      expect(pool.getStatus()).toHaveLength(1);
    });

    it('throws if no keys provided', () => {
      expect(() => new KeyPool('')).toThrow('Missing GEMINI_API_KEY');
    });
  });

  describe('acquire (round-robin)', () => {
    it('cycles through healthy keys', () => {
      const pool = new KeyPool('k1,k2,k3');
      const ids = [pool.acquire().id, pool.acquire().id, pool.acquire().id, pool.acquire().id];
      expect(ids).toEqual([0, 1, 2, 0]);
    });

    it('skips cooldown keys', () => {
      const pool = new KeyPool('k1,k2,k3');
      pool.reportFailure(0, 429); // k1 → cooldown
      const ids = [pool.acquire().id, pool.acquire().id, pool.acquire().id];
      expect(ids).toEqual([1, 2, 1]);
    });

    it('skips disabled keys', () => {
      const pool = new KeyPool('k1,k2');
      pool.reportFailure(0, 401); // k1 → disabled
      const ids = [pool.acquire().id, pool.acquire().id];
      expect(ids).toEqual([1, 1]);
    });

    it('throws when all keys unavailable', () => {
      const pool = new KeyPool('k1');
      pool.reportFailure(0, 401);
      expect(() => pool.acquire()).toThrow();
    });
  });

  describe('reportFailure', () => {
    it('marks 429 as cooldown', () => {
      const pool = new KeyPool('k1,k2');
      pool.reportFailure(0, 429);
      expect(pool.getStatus()[0].status).toBe('cooldown');
    });

    it('marks 500/503 as cooldown', () => {
      const pool = new KeyPool('k1');
      pool.reportFailure(0, 500);
      expect(pool.getStatus()[0].status).toBe('cooldown');
    });

    it('marks 401/403 as disabled', () => {
      const pool = new KeyPool('k1,k2');
      pool.reportFailure(0, 401);
      expect(pool.getStatus()[0].status).toBe('disabled');
    });

    it('increments error count', () => {
      const pool = new KeyPool('k1');
      pool.reportFailure(0, 500);
      expect(pool.getStatus()[0].stats.errors).toBe(1);
    });
  });

  describe('cooldown recovery', () => {
    it('recovers after cooldown period expires', () => {
      const pool = new KeyPool('k1,k2');
      pool.reportFailure(0, 429);
      expect(pool.getStatus()[0].status).toBe('cooldown');

      // Advance past first cooldown (30s)
      vi.advanceTimersByTime(31_000);

      // acquire() should return k1 again (auto-recovered)
      const entry = pool.acquire();
      expect(entry.id).toBe(0);
    });

    it('uses exponential backoff on repeated failures', () => {
      const pool = new KeyPool('k1,k2');

      // First failure: 30s cooldown
      pool.reportFailure(0, 429);
      vi.advanceTimersByTime(31_000);
      pool.acquire(); // recovers k1

      // Second failure: 60s cooldown
      pool.reportFailure(0, 429);
      vi.advanceTimersByTime(31_000);
      // Still in cooldown at 31s (needs 60s)
      expect(pool.getStatus()[0].status).toBe('cooldown');

      vi.advanceTimersByTime(30_000); // total 61s
      // pointer is at 1 from first recovery, so acquire returns k2 first
      pool.acquire(); // k2
      const entry = pool.acquire(); // k1, now recovered
      expect(entry.id).toBe(0);
    });
  });

  describe('reportSuccess', () => {
    it('resets cooldown step on success', () => {
      const pool = new KeyPool('k1,k2');
      pool.reportFailure(0, 429); // step 0 → cooldown 30s
      vi.advanceTimersByTime(31_000);
      pool.reportSuccess(0); // reset step

      // Next failure should be 30s again (not 60s)
      pool.reportFailure(0, 429);
      vi.advanceTimersByTime(31_000);
      const entry = pool.acquire();
      expect(entry.id).toBe(0); // recovered at 31s, confirming 30s cooldown
    });

    it('increments request count', () => {
      const pool = new KeyPool('k1');
      pool.reportSuccess(0);
      pool.reportSuccess(0);
      expect(pool.getStatus()[0].stats.requests).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('returns masked keys', () => {
      const pool = new KeyPool('AIzaSyAbcdefghij');
      const status = pool.getStatus();
      expect(status[0].maskedKey).not.toContain('AIzaSyAbcdefghij');
      expect(status[0].maskedKey).toContain('****');
    });
  });
});
