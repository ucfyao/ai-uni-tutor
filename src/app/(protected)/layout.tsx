import { redirect } from 'next/navigation';
import React from 'react';
import { getChatSessions } from '@/app/actions/chat';
import type { ProfileData } from '@/app/actions/user';
import { getProfile } from '@/app/actions/user';
import ShellServer from '@/app/ShellServer';
import { Providers } from '@/components/Providers';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ChatSession } from '@/types/index';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  let initialSessions: ChatSession[] = [];
  let initialProfile: ProfileData | null = null;

  try {
    [initialSessions, initialProfile] = await Promise.all([getChatSessions(), getProfile()]);
  } catch (e) {
    console.error('Failed to fetch initial data', e);
  }

  return (
    <Providers initialSessions={initialSessions} initialProfile={initialProfile}>
      <ShellServer>{children}</ShellServer>
    </Providers>
  );
}
