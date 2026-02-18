import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import { AdminUsersClient } from './AdminUsersClient';

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') redirect('/admin/knowledge');

  return <AdminUsersClient currentUserId={user.id} />;
}
