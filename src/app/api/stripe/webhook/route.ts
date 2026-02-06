import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('Stripe-Signature') as string;

  if (!signature) {
    return new NextResponse('Missing Stripe-Signature header', { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse('Missing STRIPE_WEBHOOK_SECRET', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = event.data.object as any;

  const supabase = await createClient();
  const db = supabase as any;

  if (event.type === 'checkout.session.completed') {
    const subscription = (await stripe.subscriptions.retrieve(
      session.subscription as string,
    )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (!session?.metadata?.userId) {
      return new NextResponse('User ID is required', { status: 400 });
    }

    await db
      .from('profiles')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        subscription_status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('id', session.metadata.userId);
  }

  if (event.type === 'invoice.payment_succeeded') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = event.data.object as any;
    const subscription = (await stripe.subscriptions.retrieve(
      invoice.subscription as string,
    )) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    await db
      .from('profiles')
      .update({
        subscription_status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  if (event.type === 'customer.subscription.updated') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = event.data.object as any;

    await db
      .from('profiles')
      .update({
        subscription_status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        stripe_price_id: subscription.items.data[0].price.id,
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  if (event.type === 'customer.subscription.deleted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = event.data.object as any;

    await db
      .from('profiles')
      .update({
        subscription_status: 'canceled', // or subscription.status which should be 'canceled'
        current_period_end: new Date().toISOString(), // Expire immediately or keep until period end? Usually deleted means gone.
      })
      .eq('stripe_subscription_id', subscription.id);
  }

  return new NextResponse(null, { status: 200 });
}
