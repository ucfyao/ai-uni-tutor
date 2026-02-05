import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Single pass: create one server client, call getUser() once, build response with session refresh.
 * Returns { response, userId } so the proxy can use userId for rate limiting and return response.
 * This avoids calling getUser() twice (previously getUserIdFromRequest + updateSession each did one).
 */
export async function handleRequest(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/share')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return { response: NextResponse.redirect(url), userId };
  }

  return { response, userId };
}

/**
 * Get the current user's id from the request (for rate limiting etc.).
 * Uses request cookies only; does not modify response.
 * Prefer using handleRequest() in the proxy so getUser() is only called once per request.
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

/**
 * @deprecated Use handleRequest() in the proxy to avoid double getUser(). Kept for backwards compatibility.
 */
export async function updateSession(request: NextRequest) {
  const { response } = await handleRequest(request);
  return response;
}
