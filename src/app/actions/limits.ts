'use server';

export type AccessLimits = {
  dailyLimitFree: number;
  dailyLimitPro: number;
  rateLimitFreeRequests: number;
  rateLimitFreeWindow: string;
  rateLimitProRequests: number;
  rateLimitProWindow: string;
  maxFileSizeMB: number;
};

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

export async function getDailyUsage() {
  const { createClient } = await import('@/lib/supabase/server');
  const { getLLMUsage } = await import('@/lib/redis');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  return await getLLMUsage(user.id);
}

export type QuotaStatus = {
  canSend: boolean;
  usage: number;
  limit: number;
  remaining: number;
  isPro: boolean;
};

/**
 * Check if user can send a message (pre-flight check before API call)
 */
export async function checkQuotaBeforeSend(): Promise<QuotaStatus> {
  const { createClient } = await import('@/lib/supabase/server');
  const { getLLMUsage } = await import('@/lib/redis');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { canSend: false, usage: 0, limit: 0, remaining: 0, isPro: false };
  }

  // Get user's subscription status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single();

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const limit = isPro
    ? parseInt(process.env.LLM_LIMIT_DAILY_PRO || '100')
    : parseInt(process.env.LLM_LIMIT_DAILY_FREE || '10');

  const usage = await getLLMUsage(user.id);
  const remaining = Math.max(0, limit - usage);
  const canSend = usage < limit;

  return { canSend, usage, limit, remaining, isPro };
}
