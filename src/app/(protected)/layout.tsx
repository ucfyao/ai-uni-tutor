import { redirect } from 'next/navigation';
import React from 'react';
import ShellServer from '@/app/ShellServer';
import { getCurrentUser } from '@/lib/supabase/server';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <ShellServer>{children}</ShellServer>;
}
