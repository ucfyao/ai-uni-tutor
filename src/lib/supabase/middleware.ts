import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';

/**
 * Single pass: create one server client, call getUser() once, build response with session refresh.
 * Returns { response, userId } so the proxy can use userId for rate limiting and return response.
 * This avoids calling getUser() twice (previously getUserIdFromRequest + updateSession each did one).
 */
export async function handleRequest(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null }> {
  const totalStart = performance.now();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const env = getEnv();
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
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
  });

  const authStart = performance.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authMs = performance.now() - authStart;
  const userId = user?.id ?? null;

  // If user is NOT logged in, and tries to visit a protected route, redirect to login.
  // We allow '/', '/zh', '/login', '/auth', '/share' for unauthenticated users.
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/zh' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/share');
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const totalMs = performance.now() - totalStart;
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set(
      'Server-Timing',
      `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
    );
    return { response: redirectResponse, userId };
  }

  const totalMs = performance.now() - totalStart;
  response.headers.set(
    'Server-Timing',
    `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
  );
  return { response, userId };
}
