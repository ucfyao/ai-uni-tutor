import { redirect } from 'next/navigation';
import Shell from '@/app/Shell';
import { getCurrentUser } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <Shell>{children}</Shell>;
}
