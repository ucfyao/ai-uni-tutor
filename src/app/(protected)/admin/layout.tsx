import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/study');

  return <>{children}</>;
}
