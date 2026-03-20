import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/supabase/server';
import { PartnerPageClient } from './PartnerPageClient';

export const metadata: Metadata = {
  title: 'Partner Program — AI Uni Tutor',
  description:
    'Join the AI Uni Tutor partner program. Earn rewards by referring students and helping grow the academic AI community.',
  openGraph: {
    title: 'Partner Program — AI Uni Tutor',
    description:
      'Join the AI Uni Tutor partner program. Earn rewards by referring students and helping grow the academic AI community.',
    siteName: 'AI Uni Tutor',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Partner Program — AI Uni Tutor',
    description:
      'Join the AI Uni Tutor partner program. Earn rewards by referring students and helping grow the academic AI community.',
  },
};

export default async function PartnerPage() {
  const user = await getCurrentUser();
  return <PartnerPageClient isAuthenticated={!!user} />;
}
