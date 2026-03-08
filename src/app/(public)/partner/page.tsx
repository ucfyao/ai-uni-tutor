import { getCurrentUser } from '@/lib/supabase/server';
import { PartnerPageClient } from './PartnerPageClient';

export default async function PartnerPage() {
  const user = await getCurrentUser();
  return <PartnerPageClient isAuthenticated={!!user} />;
}
