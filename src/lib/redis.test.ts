import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('@upstash/redis', () => {
  class Redis {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: { url: string; token: string }) {}

    // Simulates Redis EVAL for Lua scripts (used by checkLLMUsage)
    async eval(_script: string, keys: string[], args: string[]) {
      const key = keys[0];
      const limit = Number(args[0]);
      const current = (store.get(key) as number) ?? 0;

      if (current >= limit) return [0, current];

      const next = current + 1;
      store.set(key, next);
      return [1, next];
    }

    async get<T>(key: string): Promise<T | null> {
      const value = store.get(key);
      return (value ?? null) as T | null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async set(key: string, value: any): Promise<void> {
      store.set(key, value);
    }

    async incr(key: string): Promise<number> {
      const current = (store.get(key) as number) ?? 0;
      const next = current + 1;
      store.set(key, next);
      return next;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async expire(_key: string, _seconds: number): Promise<number> {
      return 1; // Simulate success
    }

    async keys(pattern: string): Promise<string[]> {
      const regex = new RegExp(
        '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$',
      );
      return [...store.keys()].filter((k) => regex.test(k));
    }

    async mget<T>(...keys: string[]): Promise<(T | null)[]> {
      return keys.map((k) => {
        const value = store.get(k);
        return (value ?? null) as unknown as T | null;
      });
    }
  }

  return { Redis };
});

describe('LLM daily limit counter', () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('should enforce daily limits correctly', async () => {
    const { checkLLMUsage } = await import('./redis');

    const testUserId = `test-unit-${Date.now()}`;
    const limit = 3;

    // 1. First Request (1/3) -> Should Pass
    const r1 = await checkLLMUsage(testUserId, limit);
    expect(r1.success).toBe(true);
    expect(r1.count).toBe(1);
    expect(r1.remaining).toBe(2);

    // 2. Second Request (2/3) -> Should Pass
    const r2 = await checkLLMUsage(testUserId, limit);
    expect(r2.success).toBe(true);
    expect(r2.count).toBe(2);
    expect(r2.remaining).toBe(1);

    // 3. Third Request (3/3) -> Should Pass (At Limit)
    const r3 = await checkLLMUsage(testUserId, limit);
    expect(r3.success).toBe(true);
    expect(r3.count).toBe(3);
    expect(r3.remaining).toBe(0);

    // 4. Fourth Request (4/3) -> Should Fail (Over Limit)
    const r4 = await checkLLMUsage(testUserId, limit);
    expect(r4.success).toBe(false);
    expect(r4.count).toBe(3);
    expect(r4.remaining).toBe(0);

    // Cleanup (Optional, but good for keeping Redis clean)
    // await redis.del(`usage:llm:${testUserId}:${new Date().toISOString().split('T')[0]}`);
  });
});

describe('pool state (loadPoolState / savePoolState / getModelStats)', () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('loadPoolState returns empty state when key missing', async () => {
    const { loadPoolState } = await import('./redis');
    const s = await loadPoolState();
    expect(s).toEqual({ cd: [], stats: {} });
  });

  it('savePoolState + loadPoolState round-trip', async () => {
    const { loadPoolState, savePoolState } = await import('./redis');
    const data = { cd: [0, Date.now() + 30000], stats: { 'gemini-2.5-flash:2026-02-22': 5 } };
    await savePoolState(data);
    const loaded = await loadPoolState();
    expect(loaded).toEqual(data);
  });

  it('getModelStats returns today and monthly from pool state', async () => {
    const { getModelStats, savePoolState } = await import('./redis');
    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.slice(0, 7);

    await savePoolState({
      cd: [],
      stats: {
        [`gemini-2.5-flash:${today}`]: 5,
        [`gemini-2.5-flash:${monthPrefix}-01`]: 10,
        [`gemini-2.0-flash:${today}`]: 3,
      },
    });

    const result = await getModelStats('gemini-2.5-flash');
    expect(result.today).toBe(5);
    expect(result.monthly).toBeGreaterThanOrEqual(5);

    const other = await getModelStats('gemini-2.0-flash');
    expect(other.today).toBe(3);
  });
});
