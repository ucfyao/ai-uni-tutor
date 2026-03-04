import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import InstitutionDashboardClient from './InstitutionDashboardClient';

export default async function InstitutionDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'institution_admin' && profile?.role !== 'super_admin') redirect('/study');

  return <InstitutionDashboardClient />;
}
