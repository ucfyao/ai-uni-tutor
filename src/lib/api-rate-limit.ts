import { NextRequest, NextResponse } from 'next/server';
import { proRatelimit, ratelimit } from '@/lib/redis';
import { getUserIdFromRequest } from '@/lib/supabase/middleware';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || '127.0.0.1';
}

/**
 * Call at the start of API handlers.
 * Returns 429 response if rate limit exceeded, null otherwise (proceed).
 */
export async function checkApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_RATELIMIT !== 'true') {
    return null;
  }
  const ip = getClientIp(request);
  let userId: string | null = null;
  try {
    userId = await getUserIdFromRequest(request);
  } catch {
    /* fallback to IP */
  }
  const limiter = userId ? proRatelimit : ratelimit;
  const key = userId ?? ip;
  const { success } = await limiter.limit(key);
  if (!success) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }
  return null;
}
