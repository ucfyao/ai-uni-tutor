/**
 * Quota Service
 *
 * LLM-related access limits only: daily quota + per-window rate limit for chat/LLM endpoints.
 * DDoS (proxy) limits are separate; see proxy.ts and redis.ts.
 * Config from env with fallbacks. See .env.example.
 */

import { QuotaExceededError } from '@/lib/errors';
import { checkLLMUsage, getLLMUsage, llmFreeRatelimit, llmProRatelimit } from '@/lib/redis';
import { getProfileRepository } from '@/lib/repositories';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';

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
  private readonly profileRepo: ProfileRepository;

  constructor(profileRepo?: ProfileRepository) {
    this.profileRepo = profileRepo ?? getProfileRepository();
  }

  /**
   * Check quota status without consuming (for UI display)
   */
  async checkStatus(userId: string): Promise<QuotaStatus> {
    const isPro = await this.getIsPro(userId);

    const limit = this.getDailyLimit(isPro);
    const usage = await getLLMUsage(userId);
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
  async checkAndConsume(userId: string): Promise<QuotaCheckResult> {
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
      const isPro = await this.getIsPro(userId);
      const dailyLimit = this.getDailyLimit(isPro);

      // 1. Per-window rate limit first (auto-resets, no permanent cost)
      const llmLimiter = isPro ? llmProRatelimit : llmFreeRatelimit;
      const { success: windowOk } = await llmLimiter.limit(userId);
      if (!windowOk) {
        const usage = await getLLMUsage(userId);
        return {
          allowed: false,
          usage,
          limit: dailyLimit,
          remaining: Math.max(0, dailyLimit - usage),
          isPro,
          error: 'Too many LLM requests in this time window. Please try again later.',
        };
      }

      // 2. Daily quota (check-and-increment is atomic; only consumed after window check passes)
      const { success: dailyOk, count, remaining } = await checkLLMUsage(userId, dailyLimit);
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
  async enforce(userId: string): Promise<QuotaCheckResult> {
    const result = await this.checkAndConsume(userId);

    if (!result.allowed) {
      throw new QuotaExceededError(result.usage, result.limit);
    }

    return result;
  }

  // ==================== Private Methods ====================

  private async getIsPro(userId: string): Promise<boolean> {
    const { isPro } = await this.profileRepo.getSubscriptionInfo(userId);
    return isPro;
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
