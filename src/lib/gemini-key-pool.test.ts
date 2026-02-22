import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPooledProxy, KeyPool } from './gemini-key-pool';

// Mock GoogleGenAI
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    _key: string;
    models: Record<string, ReturnType<typeof vi.fn>>;
    constructor({ apiKey }: { apiKey: string }) {
      this._key = apiKey;
      this.models = {
        generateContent: vi.fn().mockResolvedValue({ text: 'ok' }),
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

// Mock Redis — single JSON value
let redisValue: number[] | null = null;
const mockSet = vi.fn(async (_key: string, value: number[]) => {
  redisValue = value;
});

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: vi.fn(async () => redisValue),
    set: mockSet,
  }),
}));

describe('KeyPool', () => {
  beforeEach(() => {
    redisValue = null;
    mockSet.mockClear();
  });

  describe('constructor', () => {
    it('creates entries from comma-separated keys', () => {
      const pool = new KeyPool('key1,key2,key3');
      expect(pool.getStatus()).toHaveLength(3);
    });

    it('trims whitespace', () => {
      expect(new KeyPool(' k1 , k2 ').getStatus()).toHaveLength(2);
    });

    it('throws if empty', () => {
      expect(() => new KeyPool('')).toThrow('Missing GEMINI_API_KEY');
    });
  });

  describe('withRetry', () => {
    it('calls fn with first available key', async () => {
      const pool = new KeyPool('k1');
      const result = await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );
      expect(result).toEqual({ text: 'ok' });
    });

    it('does not write Redis on clean success', async () => {
      const pool = new KeyPool('k1');
      await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('retries next key on 429 and marks 30s cooldown (first failure)', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1 = pool['entries'][0].genAI;
      (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new ApiError({ status: 429, message: 'rate limited' }),
      );

      const result = await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );

      expect(result).toEqual({ text: 'ok' });
      // k1 marked with 30s cooldown
      const cooldown = redisValue![0];
      expect(cooldown).toBeGreaterThan(Date.now());
      expect(cooldown).toBeLessThanOrEqual(Date.now() + 30_000);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });

    it('marks 24h cooldown on second failure (on notice)', async () => {
      // k1 has expired cooldown → "on notice"
      redisValue = [1, 0];

      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1 = pool['entries'][0].genAI;
      (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new ApiError({ status: 429, message: 'rate limited' }),
      );

      const result = await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );

      expect(result).toEqual({ text: 'ok' });
      // k1 now has 24h cooldown
      const cooldown = redisValue![0];
      expect(cooldown).toBeGreaterThan(Date.now() + 60_000);
    });

    it('retries on 500/503', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1 = pool['entries'][0].genAI;
      (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new ApiError({ status: 503, message: 'unavailable' }),
      );

      const result = await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );
      expect(result).toEqual({ text: 'ok' });
    });

    it('does not retry on 400', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1 = pool['entries'][0].genAI;
      (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new ApiError({ status: 400, message: 'bad request' }),
      );

      await expect(
        pool.withRetry((genAI) => genAI.models.generateContent({ model: 'test', contents: '' })),
      ).rejects.toThrow('bad request');
    });

    it('skips 401/403 keys permanently', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1 = pool['entries'][0].genAI;
      (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError({ status: 401, message: 'unauthorized' }),
      );

      const result = await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );
      expect(result).toEqual({ text: 'ok' });
      expect(pool.getStatus()[0].disabled).toBe(true);
    });

    it('throws when all keys fail', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      for (const entry of pool['entries']) {
        (entry.genAI.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValue(
          new ApiError({ status: 429, message: 'rate limited' }),
        );
      }

      await expect(
        pool.withRetry((genAI) => genAI.models.generateContent({ model: 'test', contents: '' })),
      ).rejects.toThrow('rate limited');

      // Both keys marked 24h
      expect(redisValue![0]).toBeGreaterThan(Date.now());
      expect(redisValue![1]).toBeGreaterThan(Date.now());
    });

    it('skips keys in cooldown from previous requests', async () => {
      // Simulate k1 already in 24h cooldown (from another instance)
      redisValue = [Date.now() + 86400000, 0];

      const pool = new KeyPool('k1,k2');
      const spy = vi.fn();

      await pool.withRetry((genAI) => {
        spy((genAI as unknown as { _key: string })._key);
        return genAI.models.generateContent({ model: 'test', contents: '' });
      });

      // Should have skipped k1 and used k2
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('k2');
    });

    it('clears cooldown on success and writes state', async () => {
      // k1 has expired cooldown (on notice)
      redisValue = [1, 0];

      const pool = new KeyPool('k1');
      await pool.withRetry((genAI) =>
        genAI.models.generateContent({ model: 'test', contents: '' }),
      );

      // Cooldown cleared, state saved
      expect(redisValue![0]).toBe(0);
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createPooledProxy', () => {
  beforeEach(() => {
    redisValue = null;
    mockSet.mockClear();
  });

  it('proxies models.generateContent', async () => {
    const pool = new KeyPool('k1');
    const proxy = createPooledProxy(pool);
    const result = await proxy.models.generateContent({ model: 'test', contents: '' });
    expect(result).toEqual({ text: 'ok' });
  });

  it('proxies models.embedContent', async () => {
    const pool = new KeyPool('k1');
    const proxy = createPooledProxy(pool);
    const result = await proxy.models.embedContent({ model: 'test', contents: '' });
    expect(result).toEqual({ embeddings: [] });
  });

  it('retries transparently through proxy', async () => {
    const { ApiError } = await import('@google/genai');
    const pool = new KeyPool('k1,k2');

    const k1 = pool['entries'][0].genAI;
    (k1.models.generateContent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError({ status: 429, message: 'rate limited' }),
    );

    const proxy = createPooledProxy(pool);
    const result = await proxy.models.generateContent({ model: 'test', contents: '' });
    expect(result).toEqual({ text: 'ok' });
  });
});
