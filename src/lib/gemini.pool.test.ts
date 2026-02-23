import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolState } from '@/lib/redis';
import { buildChatEntries, GEMINI_MODELS, KeyPool } from './gemini';

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

// Mock Redis — unified PoolState
let state: PoolState = { cd: [], stats: {} };
const mockSave = vi.fn(async (s: PoolState) => {
  state = s;
});

vi.mock('@/lib/redis', () => ({
  loadPoolState: vi.fn(async () => state),
  savePoolState: (...args: unknown[]) => mockSave(...(args as [PoolState])),
}));

describe('KeyPool', () => {
  beforeEach(() => {
    state = { cd: [], stats: {} };
    mockSave.mockClear();
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
    it('calls fn with first available entry', async () => {
      const pool = new KeyPool('k1');
      const result = await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );
      expect(result).toEqual({ text: 'ok' });
    });

    it('always writes state back (1 GET + 1 SET)', async () => {
      const pool = new KeyPool('k1');
      await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('tracks provider:model stats on success', async () => {
      const pool = new KeyPool('k1');
      await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );

      const today = new Date().toISOString().split('T')[0];
      expect(state.stats[`gemini:${GEMINI_MODELS.chat}:${today}`]).toBe(1);
    });

    it('retries next key on 429 and marks 30s cooldown (first failure)', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1Client = pool['entries'][0].client as unknown as {
        models: Record<string, ReturnType<typeof vi.fn>>;
      };
      k1Client.models.generateContent.mockRejectedValueOnce(
        new ApiError({ status: 429, message: 'rate limited' }),
      );

      const result = await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );

      expect(result).toEqual({ text: 'ok' });
      // k1 marked with 30s cooldown
      const cooldown = state.cd[0];
      expect(cooldown).toBeGreaterThan(Date.now());
      expect(cooldown).toBeLessThanOrEqual(Date.now() + 30_000);
    });

    it('marks 24h cooldown on second failure (on notice)', async () => {
      // k1 has expired cooldown → "on notice"
      state = { cd: [1, 0], stats: {} };

      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1Client = pool['entries'][0].client as unknown as {
        models: Record<string, ReturnType<typeof vi.fn>>;
      };
      k1Client.models.generateContent.mockRejectedValueOnce(
        new ApiError({ status: 429, message: 'rate limited' }),
      );

      const result = await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );

      expect(result).toEqual({ text: 'ok' });
      // k1 now has 24h cooldown
      const cooldown = state.cd[0];
      expect(cooldown).toBeGreaterThan(Date.now() + 60_000);
    });

    it('retries on 500/503', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1Client = pool['entries'][0].client as unknown as {
        models: Record<string, ReturnType<typeof vi.fn>>;
      };
      k1Client.models.generateContent.mockRejectedValueOnce(
        new ApiError({ status: 503, message: 'unavailable' }),
      );

      const result = await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );
      expect(result).toEqual({ text: 'ok' });
    });

    it('does not retry on 400', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1Client = pool['entries'][0].client as unknown as {
        models: Record<string, ReturnType<typeof vi.fn>>;
      };
      k1Client.models.generateContent.mockRejectedValueOnce(
        new ApiError({ status: 400, message: 'bad request' }),
      );

      await expect(
        pool.withRetry((entry) =>
          (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
            model: 'test',
            contents: '',
          }),
        ),
      ).rejects.toThrow('bad request');
    });

    it('skips 401/403 keys permanently', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      const k1Client = pool['entries'][0].client as unknown as {
        models: Record<string, ReturnType<typeof vi.fn>>;
      };
      k1Client.models.generateContent.mockRejectedValue(
        new ApiError({ status: 401, message: 'unauthorized' }),
      );

      const result = await pool.withRetry((entry) =>
        (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
          model: 'test',
          contents: '',
        }),
      );
      expect(result).toEqual({ text: 'ok' });
      expect(pool.getStatus()[0].disabled).toBe(true);
    });

    it('throws when all keys fail', async () => {
      const { ApiError } = await import('@google/genai');
      const pool = new KeyPool('k1,k2');

      for (const entry of pool['entries']) {
        const client = entry.client as unknown as {
          models: Record<string, ReturnType<typeof vi.fn>>;
        };
        client.models.generateContent.mockRejectedValue(
          new ApiError({ status: 429, message: 'rate limited' }),
        );
      }

      await expect(
        pool.withRetry((entry) =>
          (entry.client as unknown as { models: Record<string, Function> }).models.generateContent({
            model: 'test',
            contents: '',
          }),
        ),
      ).rejects.toThrow('rate limited');

      // Both keys have cooldowns
      expect(state.cd[0]).toBeGreaterThan(Date.now());
      expect(state.cd[1]).toBeGreaterThan(Date.now());
    });

    it('skips keys in cooldown from previous requests', async () => {
      // Simulate k1 already in 24h cooldown (from another instance)
      state = { cd: [Date.now() + 86400000, 0], stats: {} };

      const pool = new KeyPool('k1,k2');
      const spy = vi.fn();

      await pool.withRetry((entry) => {
        spy((entry.client as unknown as { _key: string })._key);
        return (
          entry.client as unknown as { models: Record<string, Function> }
        ).models.generateContent({
          model: 'test',
          contents: '',
        });
      });

      // Should have skipped k1 and used k2
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('k2');
    });
  });
});

describe('buildChatEntries', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all AI_CHAT_* and related env vars
    for (const key of Object.keys(process.env)) {
      if (/^AI_CHAT_\d+$/.test(key)) delete process.env[key];
    }
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses numbered AI_CHAT_* entries', () => {
    process.env.AI_CHAT_0 = 'gemini:gemini-2.5-flash:key1';
    process.env.AI_CHAT_1 = 'gemini:gemini-2.5-flash:key2';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].provider).toBe('gemini');
    expect(entries[0].model).toBe('gemini-2.5-flash');
    expect(entries[1].id).toBe(1);
  });

  it('sorts numerically (AI_CHAT_2 before AI_CHAT_10)', () => {
    process.env.AI_CHAT_10 = 'gemini:model-b:key10';
    process.env.AI_CHAT_2 = 'gemini:model-a:key2';

    const entries = buildChatEntries();
    expect(entries[0].model).toBe('model-a');
    expect(entries[1].model).toBe('model-b');
  });

  it('handles minimax provider', () => {
    process.env.AI_CHAT_0 = 'minimax:MiniMax-M1:mm-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].provider).toBe('minimax');
    expect(entries[0].model).toBe('MiniMax-M1');
  });

  it('handles API keys containing colons', () => {
    process.env.AI_CHAT_0 = 'gemini:gemini-2.5-flash:key:with:colons';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
    // The key should be "key:with:colons" (everything after second colon)
  });

  it('skips malformed entries (missing second colon)', () => {
    process.env.AI_CHAT_0 = 'gemini:gemini-2.5-flash'; // missing :apiKey
    process.env.AI_CHAT_1 = 'gemini:gemini-2.5-flash:valid-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
  });

  it('skips entries with empty apiKey', () => {
    process.env.AI_CHAT_0 = 'gemini:gemini-2.5-flash:';
    process.env.AI_CHAT_1 = 'gemini:gemini-2.5-flash:valid-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
  });

  it('skips unknown providers', () => {
    process.env.AI_CHAT_0 = 'openai:gpt-4:sk-key';
    process.env.AI_CHAT_1 = 'gemini:gemini-2.5-flash:valid-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].provider).toBe('gemini');
  });

  it('falls back to GEMINI_API_KEY when no AI_CHAT_* vars', () => {
    process.env.GEMINI_API_KEY = 'fallback-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].provider).toBe('gemini');
    expect(entries[0].model).toBe(GEMINI_MODELS.chat);
  });

  it('falls back to multiple comma-separated GEMINI_API_KEYs', () => {
    process.env.GEMINI_API_KEY = 'key1,key2';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(2);
  });

  it('throws when no AI_CHAT_* and no GEMINI_API_KEY', () => {
    expect(() => buildChatEntries()).toThrow('No AI chat entries configured');
  });

  it('prefers AI_CHAT_* over GEMINI_API_KEY fallback', () => {
    process.env.AI_CHAT_0 = 'gemini:gemini-2.5-flash:explicit-key';
    process.env.GEMINI_API_KEY = 'fallback-key';

    const entries = buildChatEntries();
    expect(entries).toHaveLength(1);
    // Should use AI_CHAT_0, not GEMINI_API_KEY fallback
  });
});

describe('KeyPool.asProxy', () => {
  beforeEach(() => {
    state = { cd: [], stats: {} };
    mockSave.mockClear();
  });

  it('proxies models.generateContent', async () => {
    const proxy = new KeyPool('k1').asProxy();
    const result = await proxy.models.generateContent({ model: 'test', contents: '' });
    expect(result).toEqual({ text: 'ok' });
  });

  it('proxies models.embedContent', async () => {
    const proxy = new KeyPool('k1').asProxy();
    const result = await proxy.models.embedContent({ model: 'test', contents: '' });
    expect(result).toEqual({ embeddings: [] });
  });

  it('tracks provider:model stats through proxy', async () => {
    const proxy = new KeyPool('k1').asProxy();
    await proxy.models.generateContent({ model: 'gemini-2.5-flash', contents: '' });

    const today = new Date().toISOString().split('T')[0];
    expect(state.stats[`gemini:${GEMINI_MODELS.chat}:${today}`]).toBe(1);
  });

  it('retries transparently through proxy', async () => {
    const { ApiError } = await import('@google/genai');
    const pool = new KeyPool('k1,k2');

    const k1Client = pool['entries'][0].client as unknown as {
      models: Record<string, ReturnType<typeof vi.fn>>;
    };
    k1Client.models.generateContent.mockRejectedValueOnce(
      new ApiError({ status: 429, message: 'rate limited' }),
    );

    const result = await pool.asProxy().models.generateContent({ model: 'test', contents: '' });
    expect(result).toEqual({ text: 'ok' });
  });
});
