import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Redis credentials are not defined')
}

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Public ratelimiter (IP based): 10 requests per 10 seconds (or configured)
export const ratelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_PUBLIC_REQUESTS || '10'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.env.RATE_LIMIT_PUBLIC_WINDOW || '10 s') as any
    ),
    analytics: true,
    prefix: '@upstash/ratelimit/public',
})

// Free tier ratelimiter (User based): 20 requests per 10 seconds (or configured)
export const freeRatelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_FREE_REQUESTS || '20'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.env.RATE_LIMIT_FREE_WINDOW || '10 s') as any
    ),
    analytics: true,
    prefix: '@upstash/ratelimit/free',
})

// Pro tier ratelimiter (User based): 100 requests per 10 seconds (or configured)
export const proRatelimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(
        parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '100'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.env.RATE_LIMIT_PRO_WINDOW || '10 s') as any
    ),
    analytics: true,
    prefix: '@upstash/ratelimit/pro',
})

export async function checkLLMUsage(userId: string, limit: number) {
    const date = new Date().toISOString().split('T')[0];
    const key = `usage:llm:${userId}:${date}`;

    // Increment usage
    const usage = await redis.incr(key);

    // Set expiry for 24 hours if it's new (or just set it every time, it's cheap)
    if (usage === 1) {
        await redis.expire(key, 86400);
    }

    return {
        success: usage <= limit,
        remaining: Math.max(0, limit - usage),
        count: usage
    };
}

export async function getLLMUsage(userId: string) {
    const date = new Date().toISOString().split('T')[0];
    const key = `usage:llm:${userId}:${date}`;
    const usage = await redis.get<number>(key);
    return usage || 0;
}
