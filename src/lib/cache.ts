/**
 * Redis Cache Utility
 *
 * Read-through (cache-aside) helper on top of Upstash Redis.
 * Centralises cache keys and TTLs so callers stay DRY.
 */

import { getRedis } from '@/lib/redis';

/**
 * Read-through cache: returns cached value if present, otherwise calls `fetcher`,
 * stores the result with the given TTL, and returns it.
 *
 * Redis errors are swallowed — the fetcher is always called as fallback.
 */
export async function cachedGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // Redis unavailable — fall through to fetcher
  }

  const fresh = await fetcher();

  try {
    const redis = getRedis();
    await redis.set(key, fresh, { ex: ttlSeconds });
  } catch {
    // Best-effort cache write
  }

  return fresh;
}

/**
 * Delete one or more cache keys. Errors are swallowed.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const redis = getRedis();
    await redis.del(...keys);
  } catch {
    // Best-effort invalidation
  }
}

/** Centralised cache key patterns */
export const CACHE_KEYS = {
  coursesList: 'cache:courses:list',
  universitiesList: 'cache:universities:list',
  profile: (userId: string) => `cache:profile:${userId}`,
} as const;

/** Centralised TTLs (seconds) */
export const CACHE_TTL = {
  courses: 10 * 60, // 10 min
  universities: 30 * 60, // 30 min
  profile: 5 * 60, // 5 min
} as const;
