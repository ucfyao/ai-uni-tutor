import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role Supabase client that bypasses RLS.
 * Use ONLY in server-side code that needs elevated privileges
 * (e.g., webhook handlers, background jobs).
 */
export function createAdminClient() {
  const env = getEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient<Database>(env.SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
