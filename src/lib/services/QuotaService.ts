/**
 * Quota Service
 *
 * LLM-related access limits only: daily quota + per-window rate limit for chat/LLM endpoints.
 * DDoS (proxy) limits are separate; see proxy.ts and redis.ts.
 * Config from env with fallbacks. See .env.example.
 */

import { QuotaExceededError } from '@/lib/errors';
import { checkLLMUsage, getLLMUsage, llmFreeRatelimit, llmProRatelimit } from '@/lib/redis';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export interface QuotaStatus {
  canSend: boolean;
  usage: number;
  limit: number;
  remaining: number;
  isPro: boolean;
}

export interface AccessLimits {
  dailyLimitFree: number;
  dailyLimitPro: number;
  /** LLM: per-window requests (free tier) */
  rateLimitLlmFreeRequests: number;
  rateLimitLlmFreeWindow: string;
  /** LLM: per-window requests (pro tier) */
  rateLimitLlmProRequests: number;
  rateLimitLlmProWindow: string;
  maxFileSizeMB: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  usage: number;
  limit: number;
  remaining: number;
  isPro: boolean;
  error?: string;
}

export class QuotaService {
  /**
   * Check quota status without consuming (for UI display)
   */
  async checkStatus(): Promise<QuotaStatus> {
    const { user, isPro } = await this.getUserAndPlan();

    if (!user) {
      return { canSend: false, usage: 0, limit: 0, remaining: 0, isPro: false };
    }

    const limit = this.getDailyLimit(isPro);
    const usage = await getLLMUsage(user.id);
    const remaining = Math.max(0, limit - usage);
    const canSend = usage < limit;

    return { canSend, usage, limit, remaining, isPro };
  }

  /**
   * Get system-configured access limits (for UI display)
   */
  getSystemLimits(): AccessLimits {
    return {
      dailyLimitFree: parseInt(process.env.LLM_LIMIT_DAILY_FREE || '3', 10),
      dailyLimitPro: parseInt(process.env.LLM_LIMIT_DAILY_PRO || '30', 10),
      rateLimitLlmFreeRequests: parseInt(process.env.RATE_LIMIT_LLM_FREE_REQUESTS || '3', 10),
      rateLimitLlmFreeWindow: process.env.RATE_LIMIT_LLM_FREE_WINDOW || '60 s',
      rateLimitLlmProRequests: parseInt(process.env.RATE_LIMIT_LLM_PRO_REQUESTS || '60', 10),
      rateLimitLlmProWindow: process.env.RATE_LIMIT_LLM_PRO_WINDOW || '60 s',
      maxFileSizeMB: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10),
    };
  }

  /**
   * Check and consume quota (call before AI requests)
   */
  async checkAndConsume(): Promise<QuotaCheckResult> {
    // Skip in development unless explicitly enabled
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
      const { user, isPro } = await this.getUserAndPlan();

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

      // 1. LLM daily quota
      const dailyLimit = this.getDailyLimit(isPro);
      const { success: dailyOk, count, remaining } = await checkLLMUsage(user.id, dailyLimit);
      if (!dailyOk) {
        return {
          allowed: false,
          usage: count,
          limit: dailyLimit,
          remaining,
          isPro,
          error: `Daily limit reached (${count}/${dailyLimit}). Please upgrade to Pro for more.`,
        };
      }

      // 2. LLM per-window rate limit (chat/LLM endpoints only)
      const llmLimiter = isPro ? llmProRatelimit : llmFreeRatelimit;
      const { success: windowOk } = await llmLimiter.limit(user.id);
      if (!windowOk) {
        return {
          allowed: false,
          usage: count,
          limit: dailyLimit,
          remaining,
          isPro,
          error: 'Too many LLM requests in this time window. Please try again later.',
        };
      }

      return {
        allowed: true,
        usage: count,
        limit: dailyLimit,
        remaining,
        isPro,
      };
    } catch (error) {
      console.error('[QuotaService] Check failed:', error);
      // Fail open: allow if quota check fails
      return {
        allowed: true,
        usage: 0,
        limit: 999,
        remaining: 999,
        isPro: false,
      };
    }
  }

  /**
   * Enforce quota - throws if limit reached
   */
  async enforce(): Promise<QuotaCheckResult> {
    const result = await this.checkAndConsume();

    if (!result.allowed) {
      throw new QuotaExceededError(result.usage, result.limit);
    }

    return result;
  }

  // ==================== Private Methods ====================

  private async getUserAndPlan(): Promise<{ user: { id: string } | null; isPro: boolean }> {
    const user = await getCurrentUser();

    if (!user) {
      return { user: null, isPro: false };
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();

    const isPro =
      profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

    return { user, isPro };
  }

  private getDailyLimit(isPro: boolean): number {
    return isPro
      ? parseInt(process.env.LLM_LIMIT_DAILY_PRO || '30', 10)
      : parseInt(process.env.LLM_LIMIT_DAILY_FREE || '3', 10);
  }
}

// Singleton instance
let _quotaService: QuotaService | null = null;

export function getQuotaService(): QuotaService {
  if (!_quotaService) {
    _quotaService = new QuotaService();
  }
  return _quotaService;
}
