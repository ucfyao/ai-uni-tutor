import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { getEnv } from '@/lib/env';
import { getProfileService } from '@/lib/services/ProfileService';
import { stripe } from '@/lib/stripe';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const profileService = getProfileService();
    const stripeCustomerId = await profileService.getStripeCustomerId(user.id);

    if (!stripeCustomerId) {
      return apiError('No active subscription', 400, 'VALIDATION');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_PORTAL]', error);
    return apiError('Internal Error', 500);
  }
}
