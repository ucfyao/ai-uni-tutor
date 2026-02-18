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
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
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

/** Require super_admin role or throw ForbiddenError. */
export async function requireSuperAdmin() {
  const { ForbiddenError } = await import('@/lib/errors');
  const user = await requireUser();
  const { getProfileRepository } = await import('@/lib/repositories');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') throw new ForbiddenError('Super admin access required');
  return user;
}

/** Require admin or super_admin role or throw ForbiddenError. */
export async function requireAnyAdmin(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  role: 'admin' | 'super_admin';
}> {
  const { ForbiddenError } = await import('@/lib/errors');
  const user = await requireUser();
  const { getProfileRepository } = await import('@/lib/repositories');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin')
    throw new ForbiddenError('Admin access required');
  return { user, role: profile.role };
}

/** Require course-level admin access: super_admin passes directly, admin checked against assignments. */
export async function requireCourseAdmin(courseId: string) {
  const { ForbiddenError } = await import('@/lib/errors');
  const { user, role } = await requireAnyAdmin();
  if (role === 'super_admin') return user;
  // admin: check course assignment
  const { getAdminRepository } = await import('@/lib/repositories/AdminRepository');
  const hasAccess = await getAdminRepository().hasCourseAccess(user.id, courseId);
  if (!hasAccess) throw new ForbiddenError('No access to this course');
  return user;
}

/** @deprecated Use requireSuperAdmin(), requireAnyAdmin(), or requireCourseAdmin() instead. */
export async function requireAdmin() {
  return (await requireAnyAdmin()).user;
}
