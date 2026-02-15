import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getProfileService } from '@/lib/services/ProfileService';
import { stripe } from '@/lib/stripe';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const profileService = getProfileService();
    let stripeCustomerId = await profileService.getStripeCustomerId(user.id);

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await profileService.updateStripeCustomerId(user.id, customer.id);
    }

    // Determine which price to use based on plan parameter
    let plan: string = 'monthly';
    try {
      const body = await req.json();
      if (body.plan === 'semester') plan = 'semester';
    } catch {
      // No body or invalid JSON — default to monthly
    }

    const priceId =
      plan === 'semester'
        ? process.env.STRIPE_PRICE_ID_SEMESTER
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return new NextResponse(`Stripe Price ID for ${plan} plan is missing`, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      billing_address_collection: 'auto',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/settings?success=true`,
      cancel_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/settings?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
