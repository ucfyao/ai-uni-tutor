import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;
let _ratelimit: Ratelimit | null = null;
let _freeRatelimit: Ratelimit | null = null;
let _proRatelimit: Ratelimit | null = null;

function getRedis(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      'Redis credentials are not defined (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)',
    );
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

/** Lazy: validated on first use so pages/tests without Redis env don't crash at import. */
export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const r = getRedis();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_PUBLIC_REQUESTS || '10'),
        (process.env.RATE_LIMIT_PUBLIC_WINDOW || '10 s') as Parameters<
          typeof Ratelimit.slidingWindow
        >[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/public',
    });
  }
  return _ratelimit;
}

function getFreeRatelimit(): Ratelimit {
  if (!_freeRatelimit) {
    _freeRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_FREE_REQUESTS || '20'),
        (process.env.RATE_LIMIT_FREE_WINDOW || '10 s') as Parameters<
          typeof Ratelimit.slidingWindow
        >[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/free',
    });
  }
  return _freeRatelimit;
}

function getProRatelimit(): Ratelimit {
  if (!_proRatelimit) {
    _proRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '100'),
        (process.env.RATE_LIMIT_PRO_WINDOW || '10 s') as Parameters<
          typeof Ratelimit.slidingWindow
        >[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/pro',
    });
  }
  return _proRatelimit;
}

/** Lazy: validated on first use. */
export const ratelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** Lazy: validated on first use. */
export const freeRatelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getFreeRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** Lazy: validated on first use. */
export const proRatelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getProRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/**
 * Lua script: atomically check current usage and increment only if under limit.
 * Returns [allowed, count] where allowed is 1 or 0, count is current usage after the op (or current if rejected).
 */
const CHECK_AND_INCR_LLM_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur == false then cur = 0 else cur = tonumber(cur) end
local limit = tonumber(ARGV[1])
if cur >= limit then
  return {0, cur}
end
redis.call('INCR', KEYS[1])
local newVal = cur + 1
if newVal == 1 then
  redis.call('EXPIRE', KEYS[1], 86400)
end
return {1, newVal}
`;

export async function checkLLMUsage(userId: string, limit: number) {
  const date = new Date().toISOString().split('T')[0];
  const key = `usage:llm:${userId}:${date}`;

  const r = getRedis();
  const result = (await r.eval(CHECK_AND_INCR_LLM_SCRIPT, [key], [limit.toString()])) as unknown;

  const arr = Array.isArray(result) ? result : [0, 0];
  const allowed = Number(arr[0]) || 0;
  const count = Number(arr[1]) || 0;
  const success = allowed === 1;

  return {
    success,
    remaining: Math.max(0, limit - count),
    count,
  };
}

export async function getLLMUsage(userId: string) {
  const date = new Date().toISOString().split('T')[0];
  const key = `usage:llm:${userId}:${date}`;
  const usage = await redis.get<number>(key);
  return usage || 0;
}
