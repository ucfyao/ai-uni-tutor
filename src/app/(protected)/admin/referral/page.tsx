import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import { AdminReferralClient } from './AdminReferralClient';

export default async function AdminReferralPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') redirect('/study');

  return <AdminReferralClient />;
}
