import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimitEnabled } from '@/lib/env';
import { proRatelimit, ratelimit } from '@/lib/redis';
import { handleRequest } from '@/lib/supabase/middleware';

/** Get client IP from request (first IP in x-forwarded-for when behind proxies). */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return '127.0.0.1';
  const first = forwarded.split(',')[0]?.trim();
  return first ?? '127.0.0.1';
}

/**
 * Proxy: DDoS rate limit (all requests) + Supabase session refresh.
 * Anonymous: ratelimit (60/60s). Logged-in: proRatelimit (100/10s).
 * LLM limits (daily + per-window) are in QuotaService for chat/LLM endpoints only.
 */
export async function proxy(request: NextRequest) {
  const ip = getClientIp(request);

  const { response, userId } = await handleRequest(request);

  if (isRateLimitEnabled()) {
    const limiter = userId ? proRatelimit : ratelimit;
    const key = userId ?? ip;

    try {
      const { success } = await limiter.limit(key);
      if (!success) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    } catch (error) {
      // Fail open: avoid taking down the whole app if Upstash/Redis is misconfigured or unreachable.
      // QuotaService already fails open for LLM limits; this keeps proxy-level DDoS limiting consistent.
      console.error('[proxy] ratelimit failed:', error);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
