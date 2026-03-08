import { redirect } from 'next/navigation';
import React from 'react';
import { getChatSessions } from '@/app/actions/chat';
import { getProfile } from '@/app/actions/user';
import ShellServer from '@/app/ShellServer';
import { Providers } from '@/components/Providers';
import { FloatingReferralButton } from '@/components/referral/FloatingReferralButton';
import { ReferralCapture } from '@/components/referral/ReferralCapture';
import { mergeProtectedInitialData } from '@/lib/protected-initial-data';
import { getCurrentUser } from '@/lib/supabase/server';
import { withTimeout } from '@/lib/with-timeout';

const INITIAL_DATA_TIMEOUT_MS = 8000;

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const [sessionsResult, profileResult] = await Promise.allSettled([
    withTimeout(getChatSessions(), INITIAL_DATA_TIMEOUT_MS, 'initial chat sessions fetch'),
    withTimeout(getProfile(), INITIAL_DATA_TIMEOUT_MS, 'initial profile fetch'),
  ]);
  const { initialSessions, initialProfile } = mergeProtectedInitialData(
    sessionsResult,
    profileResult,
  );

  if (sessionsResult.status === 'rejected') {
    console.error('Failed to fetch initial sessions', sessionsResult.reason);
  }
  if (profileResult.status === 'rejected') {
    console.error('Failed to fetch initial profile', profileResult.reason);
  }

  return (
    <Providers initialSessions={initialSessions} initialProfile={initialProfile}>
      <ReferralCapture />
      <FloatingReferralButton />
      <ShellServer>{children}</ShellServer>
    </Providers>
  );
}
