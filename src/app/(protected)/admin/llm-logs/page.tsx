import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import { LlmLogsClient } from './LlmLogsClient';

export default async function LlmLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') redirect('/');

  return <LlmLogsClient />;
}
