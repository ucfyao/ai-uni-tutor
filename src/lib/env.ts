/**
 * Environment Variable Validation
 *
 * Centralizes environment variable access with Zod validation.
 * - Core vars (Supabase, site URL, file size) are validated on first `getEnv()` call.
 * - Rate limit / quota defaults are centralized in `getRateLimitConfig()`.
 * - Feature-specific vars (Gemini, Stripe, Redis) are validated lazily in their own modules.
 */

import { z } from 'zod';

// ── Core schema (used across multiple files) ──

const coreSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    (v) => (typeof v === 'string' && v !== '' ? v : 'http://localhost:3000'),
    z.string().url(),
  ),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ENABLE_RATELIMIT: z.string().optional(),
});

export type Env = z.infer<typeof coreSchema>;

let _cached: Env | undefined;

/** Validated core environment. Lazily parsed on first access so it does not run during `next build`. */
export function getEnv(): Env {
  if (_cached) return _cached;

  const result = coreSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Missing or invalid environment variables. See errors above.');
  }
  _cached = result.data;
  return _cached;
}

/** Reset cached env (for tests that modify process.env between runs). */
export function resetEnvCache(): void {
  _cached = undefined;
  _rateLimitConfig = undefined;
}

/** Whether rate limiting is active (production, or ENABLE_RATELIMIT=true). */
export function isRateLimitEnabled(): boolean {
  const env = getEnv();
  return env.NODE_ENV === 'production' || env.ENABLE_RATELIMIT === 'true';
}

// ── Rate limit & quota config (shared by redis.ts and QuotaService) ──

export interface RateLimitConfig {
  /** DDoS proxy: anonymous requests per window */
  publicRequests: number;
  publicWindow: string;
  /** DDoS proxy: logged-in requests per window */
  proRequests: number;
  proWindow: string;
  /** LLM: free-tier per-window limit */
  llmFreeRequests: number;
  llmFreeWindow: string;
  /** LLM: pro-tier per-window limit */
  llmProRequests: number;
  llmProWindow: string;
  /** LLM: daily quota limits */
  dailyLimitFree: number;
  dailyLimitPro: number;
}

let _rateLimitConfig: RateLimitConfig | undefined;

/** Centralized rate-limit & quota defaults. Reads from env with fallbacks. */
export function getRateLimitConfig(): RateLimitConfig {
  if (_rateLimitConfig) return _rateLimitConfig;
  _rateLimitConfig = {
    publicRequests: parseInt(process.env.RATE_LIMIT_PUBLIC_REQUESTS || '60', 10),
    publicWindow: process.env.RATE_LIMIT_PUBLIC_WINDOW || '60 s',
    proRequests: parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '100', 10),
    proWindow: process.env.RATE_LIMIT_PRO_WINDOW || '10 s',
    llmFreeRequests: parseInt(process.env.RATE_LIMIT_LLM_FREE_REQUESTS || '3', 10),
    llmFreeWindow: process.env.RATE_LIMIT_LLM_FREE_WINDOW || '60 s',
    llmProRequests: parseInt(process.env.RATE_LIMIT_LLM_PRO_REQUESTS || '60', 10),
    llmProWindow: process.env.RATE_LIMIT_LLM_PRO_WINDOW || '60 s',
    dailyLimitFree: parseInt(process.env.LLM_LIMIT_DAILY_FREE || '3', 10),
    dailyLimitPro: parseInt(process.env.LLM_LIMIT_DAILY_PRO || '30', 10),
  };
  return _rateLimitConfig;
}
