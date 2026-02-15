import { NextRequest, NextResponse } from 'next/server';
import { getProfileService } from '@/lib/services/ProfileService';
import { stripe } from '@/lib/stripe';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const profileService = getProfileService();
    const stripeCustomerId = await profileService.getStripeCustomerId(user.id);

    if (!stripeCustomerId) {
      return new NextResponse('No active subscription', { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_PORTAL]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
