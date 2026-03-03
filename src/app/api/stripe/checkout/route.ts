import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getReferralRepository } from '@/lib/repositories';
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
    let referralCode: string | undefined;
    try {
      const body = await req.json();
      if (body.plan === 'semester') plan = 'semester';
      if (typeof body.referralCode === 'string' && body.referralCode.trim()) {
        referralCode = body.referralCode.trim();
      }
    } catch {
      // No body or invalid JSON — defaults
    }

    const priceId =
      plan === 'semester'
        ? process.env.STRIPE_PRICE_ID_SEMESTER
        : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return new NextResponse(`Stripe Price ID for ${plan} plan is missing`, { status: 500 });
    }

    // Look up referral code for Stripe discount
    let discounts: Array<{ promotion_code: string }> | undefined;
    if (referralCode) {
      try {
        const referralRepo = getReferralRepository();
        const codeEntity = await referralRepo.findCodeByCode(referralCode);
        if (codeEntity?.stripePromotionCodeId && codeEntity.isActive) {
          discounts = [{ promotion_code: codeEntity.stripePromotionCodeId }];
        }
      } catch (error) {
        console.error('Failed to look up referral code:', error);
        // Continue without discount — don't block checkout
      }
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
      ...(discounts ? { discounts } : {}),
      success_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/settings?success=true`,
      cancel_url: `${getEnv().NEXT_PUBLIC_SITE_URL}/settings?canceled=true`,
      metadata: {
        userId: user.id,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
