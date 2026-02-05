import { NextResponse, type NextRequest } from 'next/server';
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
 * Proxy: rate limit (when production or ENABLE_RATELIMIT=true) then Supabase session refresh.
 * Uses a single handleRequest() so getUser() is only called once per request.
 * Anonymous: ratelimit (default 10 req/10s). Logged-in: proRatelimit (default 100 req/10s).
 */
export async function proxy(request: NextRequest) {
  const ip = getClientIp(request);

  const { response, userId } = await handleRequest(request);

  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATELIMIT === 'true') {
    const limiter = userId ? proRatelimit : ratelimit;
    const key = userId ?? ip;

    const { success } = await limiter.limit(key);

    if (!success) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
