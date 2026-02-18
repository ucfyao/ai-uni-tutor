import { createClient } from '@supabase/supabase-js';

export const TEST_ACCOUNTS = {
  user: {
    email: process.env.E2E_USER_EMAIL || 'e2e-user@test.local',
    password: process.env.E2E_USER_PASSWORD || '',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@test.local',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
  superAdmin: {
    email: process.env.E2E_SUPER_ADMIN_EMAIL || 'e2e-superadmin@test.local',
    password: process.env.E2E_SUPER_ADMIN_PASSWORD || '',
  },
} as const;

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
  }
  return createClient(url, key);
}
