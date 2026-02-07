import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let stripeCustomerId = profile?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Ideally should update profile here, but we can do it via webhook or lazily
      await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
    }

    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return new NextResponse('Stripe Price ID is missing', { status: 500 });
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
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/settings?canceled=true`,
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
