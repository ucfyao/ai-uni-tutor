import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import AgentDashboardClient from './AgentDashboardClient';

export default async function AgentDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'agent' && profile?.role !== 'super_admin') redirect('/study');

  return <AgentDashboardClient />;
}
