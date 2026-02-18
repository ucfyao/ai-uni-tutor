import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') redirect('/study');

  return <>{children}</>;
}
