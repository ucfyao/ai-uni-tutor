/**
 * Redis + rate limiters.
 *
 * - DDoS (proxy): ratelimit (anonymous), proRatelimit (logged-in). Used in proxy.ts for all requests.
 * - LLM: llmFreeRatelimit, llmProRatelimit (per-window); checkLLMUsage/getLLMUsage (daily). Used in QuotaService for chat/LLM endpoints only.
 *
 * Config from env with fallbacks. See .env.example.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getRateLimitConfig } from '@/lib/env';

let _redis: Redis | null = null;

// --- DDoS (proxy): general request rate limit per IP/user ---
let _ratelimit: Ratelimit | null = null; // anonymous
let _proRatelimit: Ratelimit | null = null; // logged-in

// --- LLM: per-window rate limit for chat/LLM endpoints only ---
let _llmFreeRatelimit: Ratelimit | null = null;
let _llmProRatelimit: Ratelimit | null = null;

export function getRedis(): Redis {
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
const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const r = getRedis();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** DDoS: anonymous requests (proxy) */
function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    const cfg = getRateLimitConfig();
    _ratelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        cfg.publicRequests,
        cfg.publicWindow as Parameters<typeof Ratelimit.slidingWindow>[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/public',
    });
  }
  return _ratelimit;
}

/** DDoS: logged-in requests (proxy) */
function getProRatelimit(): Ratelimit {
  if (!_proRatelimit) {
    const cfg = getRateLimitConfig();
    _proRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        cfg.proRequests,
        cfg.proWindow as Parameters<typeof Ratelimit.slidingWindow>[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/pro',
    });
  }
  return _proRatelimit;
}

/** LLM: chat/LLM API per-window limit (free tier) */
function getLlmFreeRatelimit(): Ratelimit {
  if (!_llmFreeRatelimit) {
    const cfg = getRateLimitConfig();
    _llmFreeRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        cfg.llmFreeRequests,
        cfg.llmFreeWindow as Parameters<typeof Ratelimit.slidingWindow>[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/llm-free',
    });
  }
  return _llmFreeRatelimit;
}

/** LLM: chat/LLM API per-window limit (pro tier) */
function getLlmProRatelimit(): Ratelimit {
  if (!_llmProRatelimit) {
    const cfg = getRateLimitConfig();
    _llmProRatelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(
        cfg.llmProRequests,
        cfg.llmProWindow as Parameters<typeof Ratelimit.slidingWindow>[1],
      ),
      analytics: true,
      prefix: '@upstash/ratelimit/llm-pro',
    });
  }
  return _llmProRatelimit;
}

/** Lazy: validated on first use. DDoS proxy (anonymous). */
export const ratelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** Lazy: validated on first use. DDoS proxy (logged-in). */
export const proRatelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getProRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** Lazy: validated on first use. LLM endpoints only (free tier). */
export const llmFreeRatelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getLlmFreeRatelimit();
    const v = (r as unknown as Record<string, unknown>)[prop as string];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(r) : v;
  },
});

/** Lazy: validated on first use. LLM endpoints only (pro tier). */
export const llmProRatelimit = new Proxy({} as Ratelimit, {
  get(_, prop) {
    const r = getLlmProRatelimit();
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

// ==================== Gemini Key Pool State ====================

const POOL_KEY = 'gemini:pool';
const POOL_TTL_S = 31 * 24 * 60 * 60; // 31 days

export interface PoolState {
  cd: number[];
  stats: Record<string, number>;
}

export async function loadPoolState(): Promise<PoolState> {
  try {
    return (await getRedis().get<PoolState>(POOL_KEY)) ?? { cd: [], stats: {} };
  } catch {
    return { cd: [], stats: {} };
  }
}

export async function savePoolState(state: PoolState): Promise<void> {
  try {
    await getRedis().set(POOL_KEY, state, { ex: POOL_TTL_S });
  } catch {
    // Redis unavailable — fail-open
  }
}

/**
 * Get per-model usage stats from the unified pool state.
 */
export async function getModelStats(model: string): Promise<{ today: number; monthly: number }> {
  const state = await loadPoolState();
  const today = new Date().toISOString().split('T')[0];
  const monthPrefix = today.slice(0, 7);

  const todayCount = state.stats[`${model}:${today}`] ?? 0;

  let monthly = 0;
  for (const [key, count] of Object.entries(state.stats)) {
    if (key.startsWith(`${model}:${monthPrefix}`)) {
      monthly += count;
    }
  }

  return { today: todayCount, monthly };
}
