import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();

vi.mock('@upstash/redis', () => {
  class Redis {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: { url: string; token: string }) {}

    async eval(_script: string, keys: string[], args: string[]) {
      const key = keys[0];
      const limit = Number(args[0]);
      const current = store.get(key) ?? 0;

      if (current >= limit) return [0, current];

      const next = current + 1;
      store.set(key, next);
      return [1, next];
    }

    async get<T>(key: string): Promise<T | null> {
      const value = store.get(key);
      return (value ?? null) as unknown as T | null;
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
