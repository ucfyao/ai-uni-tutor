import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

/**
 * Get the current user's id from the request (for rate limiting etc.).
 * Uses request cookies only; does not modify response.
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op: we only need to read the session for rate limit key
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
