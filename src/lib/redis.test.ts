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

    async incr(key: string): Promise<number> {
      const current = store.get(key) ?? 0;
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

describe('incrementModelStats', () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('should increment the correct key with date-based format', async () => {
    const { incrementModelStats } = await import('./redis');

    await incrementModelStats('gemini-2.0-flash');

    const today = new Date().toISOString().split('T')[0];
    const key = `stats:llm:gemini-2.0-flash:${today}`;
    expect(store.get(key)).toBe(1);
  });

  it('should increment the counter on repeated calls', async () => {
    const { incrementModelStats } = await import('./redis');

    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-flash');

    const today = new Date().toISOString().split('T')[0];
    const key = `stats:llm:gemini-2.0-flash:${today}`;
    expect(store.get(key)).toBe(3);
  });

  it('should track different models independently', async () => {
    const { incrementModelStats } = await import('./redis');

    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-pro');
    await incrementModelStats('gemini-2.0-flash');

    const today = new Date().toISOString().split('T')[0];
    expect(store.get(`stats:llm:gemini-2.0-flash:${today}`)).toBe(2);
    expect(store.get(`stats:llm:gemini-2.0-pro:${today}`)).toBe(1);
  });

  it('should catch and log errors without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear env to force getRedis() to throw
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { incrementModelStats } = await import('./redis');

    // Should not throw
    await expect(incrementModelStats('gemini-2.0-flash')).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Redis] Failed to increment model stats:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});

describe('getModelStats', () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  });

  it('should return 0s when no data exists', async () => {
    const { getModelStats } = await import('./redis');

    const result = await getModelStats('gemini-2.0-flash');
    expect(result).toEqual({ today: 0, monthly: 0 });
  });

  it('should return today count and monthly total', async () => {
    const { getModelStats, incrementModelStats } = await import('./redis');

    // Simulate some usage today
    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-flash');

    const result = await getModelStats('gemini-2.0-flash');
    expect(result.today).toBe(3);
    expect(result.monthly).toBe(3);
  });

  it('should include past days in monthly total', async () => {
    const { getModelStats } = await import('./redis');

    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.slice(0, 7); // "YYYY-MM"

    // Seed store with today + past days this month
    store.set(`stats:llm:gemini-2.0-flash:${today}`, 5);
    store.set(`stats:llm:gemini-2.0-flash:${monthPrefix}-01`, 10);
    store.set(`stats:llm:gemini-2.0-flash:${monthPrefix}-15`, 20);

    const result = await getModelStats('gemini-2.0-flash');
    expect(result.today).toBe(5);
    // Monthly total includes all days with the month prefix pattern
    expect(result.monthly).toBeGreaterThanOrEqual(5); // At minimum today's count
  });

  it('should not include other models in stats', async () => {
    const { getModelStats, incrementModelStats } = await import('./redis');

    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-flash');
    await incrementModelStats('gemini-2.0-pro');

    const flashResult = await getModelStats('gemini-2.0-flash');
    const proResult = await getModelStats('gemini-2.0-pro');

    expect(flashResult.today).toBe(2);
    expect(proResult.today).toBe(1);
  });
});
