import React from 'react';
import { getInviteInfo } from '@/app/actions/institution-actions';
import { getCurrentUser } from '@/lib/supabase/server';
import { JoinPageClient } from './JoinPageClient';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { code } = await params;
  const [user, inviteResult] = await Promise.all([getCurrentUser(), getInviteInfo(code)]);

  const inviteInfo = inviteResult.success && inviteResult.data ? inviteResult.data : null;

  return <JoinPageClient code={code} inviteInfo={inviteInfo} isLoggedIn={!!user} />;
}
