import { NextResponse, type NextRequest } from 'next/server';
import { proRatelimit, ratelimit } from '@/lib/redis';
import { getUserIdFromRequest, updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATELIMIT === 'true') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
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
  }
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
