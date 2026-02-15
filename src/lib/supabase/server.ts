import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/** Per-request cached Supabase server client; deduplicates instances when multiple server code paths call createClient() in the same request. */
export const createClient = cache(async (): Promise<SupabaseClient<Database>> => {
  const cookieStore = await cookies();
  const env = getEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // Session refresh happens in proxy.
          }
        },
      },
    },
  );
});

/** Per-request cached user; deduplicates getUser() when multiple actions/components need it in the same request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Require authenticated user or throw UnauthorizedError. */
export async function requireUser() {
  const { UnauthorizedError } = await import('@/lib/errors');
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Require admin role or throw ForbiddenError. */
export async function requireAdmin() {
  const { ForbiddenError } = await import('@/lib/errors');
  const user = await requireUser();
  const { getProfileRepository } = await import('@/lib/repositories');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'admin') throw new ForbiddenError('Admin access required');
  return user;
}
