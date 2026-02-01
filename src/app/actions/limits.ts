'use server';

import { QuotaExceededError } from '@/lib/errors';
import { checkLLMUsage, getLLMUsage } from '@/lib/redis';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export type AccessLimits = {
  dailyLimitFree: number;
  dailyLimitPro: number;
  rateLimitFreeRequests: number;
  rateLimitFreeWindow: string;
  rateLimitProRequests: number;
  rateLimitProWindow: string;
  maxFileSizeMB: number;
};

export type QuotaStatus = {
  canSend: boolean;
  usage: number;
  limit: number;
  remaining: number;
  isPro: boolean;
};

export type QuotaCheckResult = {
  allowed: boolean;
  usage: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  error?: string;
};

// ============================================================================
// HELPERS (Internal)
// ============================================================================

async function getUserAndPlan() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isPro: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return { user, isPro };
}

function getDailyLimit(isPro: boolean): number {
  return isPro
    ? parseInt(process.env.LLM_LIMIT_DAILY_PRO || '100')
    : parseInt(process.env.LLM_LIMIT_DAILY_FREE || '10');
}

// ============================================================================
// PUBLIC API - READ ONLY (For UI Display)
// ============================================================================

/**
 * Get system-configured access limits (for Settings page display)
 */
export async function getAccessLimits(): Promise<AccessLimits> {
  return {
    dailyLimitFree: parseInt(process.env.LLM_LIMIT_DAILY_FREE || '10', 10),
    dailyLimitPro: parseInt(process.env.LLM_LIMIT_DAILY_PRO || '100', 10),
    rateLimitFreeRequests: parseInt(process.env.RATE_LIMIT_FREE_REQUESTS || '20', 10),
    rateLimitFreeWindow: process.env.RATE_LIMIT_FREE_WINDOW || '10 s',
    rateLimitProRequests: parseInt(process.env.RATE_LIMIT_PRO_REQUESTS || '100', 10),
    rateLimitProWindow: process.env.RATE_LIMIT_PRO_WINDOW || '10 s',
    maxFileSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5', 10),
  };
}

/**
 * Get current user's daily usage count (READ ONLY - does not increment)
 */
export async function getDailyUsage(): Promise<number> {
  const { user } = await getUserAndPlan();
  if (!user) return 0;
  return await getLLMUsage(user.id);
}

/**
 * Get full quota status for UI (READ ONLY - does not increment)
 * Use this for progress bars, pre-send checks, etc.
 */
export async function checkQuotaBeforeSend(): Promise<QuotaStatus> {
  const { user, isPro } = await getUserAndPlan();

  if (!user) {
    return { canSend: false, usage: 0, limit: 0, remaining: 0, isPro: false };
  }

  const limit = getDailyLimit(isPro);
  const usage = await getLLMUsage(user.id);
  const remaining = Math.max(0, limit - usage);
  const canSend = usage < limit;

  return { canSend, usage, limit, remaining, isPro };
}

// ============================================================================
// PUBLIC API - CONSUME QUOTA (For LLM Calls)
// ============================================================================

/**
 * Check and consume quota for an LLM call.
 * Call this BEFORE any LLM API call to enforce rate limits.
 *
 * Returns `allowed: true` if the user can proceed, `allowed: false` otherwise.
 * The function automatically increments the usage counter.
 */
export async function checkAndConsumeQuota(): Promise<QuotaCheckResult> {
  // Skip rate limiting in development unless explicitly enabled
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_RATELIMIT !== 'true') {
    return {
      allowed: true,
      usage: 0,
      limit: 999,
      remaining: 999,
      isPro: true,
    };
  }

  try {
    const { user, isPro } = await getUserAndPlan();

    if (!user) {
      return {
        allowed: false,
        usage: 0,
        limit: 0,
        remaining: 0,
        isPro: false,
        error: 'Unauthorized',
      };
    }

    const limit = getDailyLimit(isPro);
    const { success, count, remaining } = await checkLLMUsage(user.id, limit);

    console.log(
      `[Quota] User: ${user.id} | Plan: ${isPro ? 'Pro' : 'Free'} | Limit: ${limit} | Usage: ${count} | Allowed: ${success}`,
    );

    return {
      allowed: success,
      usage: count,
      limit,
      remaining,
      isPro,
      error: success
        ? undefined
        : `Daily limit reached (${count}/${limit}). Please upgrade to Pro for more.`,
    };
  } catch (error) {
    console.error('[Quota] Check failed:', error);
    // Fail open: allow if quota check fails (avoid blocking due to Redis issues)
    return {
      allowed: true,
      usage: 0,
      limit: 999,
      remaining: 999,
      isPro: false,
      error: undefined,
    };
  }
}

// ============================================================================
// ERROR CLASS & HELPER
// ============================================================================

/**
 * Helper function to enforce quota. Throws QuotaExceededError if limit reached.
 * Use this at the beginning of any LLM-calling function.
 */
export async function enforceQuota(): Promise<QuotaCheckResult> {
  const result = await checkAndConsumeQuota();

  if (!result.allowed) {
    throw new QuotaExceededError(result.usage, result.limit);
  }

  return result;
}
