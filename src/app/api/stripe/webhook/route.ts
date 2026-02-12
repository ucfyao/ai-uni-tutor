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

  const supabase = await createClient();

  // Idempotency: skip already-processed events
  const { data: existing } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existing) {
    return new NextResponse(null, { status: 200 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event, supabase);
    } else if (event.type === 'invoice.payment_succeeded') {
      await handleInvoicePaymentSucceeded(event, supabase);
    } else if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionUpdated(event, supabase);
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event, supabase);
    }

    // Mark event as processed
    await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('stripe_events')
      .insert({ event_id: event.id, event_type: event.type });

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}

// ---------- Event Handlers ----------

async function handleCheckoutCompleted(
  event: Stripe.Event,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (!session?.metadata?.userId) {
    throw new Error('Missing userId in checkout session metadata');
  }

  if (!session.subscription) {
    throw new Error('Missing subscription in checkout session');
  }

  const subscription = (await stripe.subscriptions.retrieve(session.subscription as string)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', session.metadata.userId);

  if (error) {
    throw new Error(`Failed to update profile for checkout: ${error.message}`);
  }
}

async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice = event.data.object as any;

  if (!invoice.subscription) {
    return; // One-off invoice, not subscription-related
  }

  const subscription = (await stripe.subscriptions.retrieve(invoice.subscription as string)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update profile for invoice: ${error.message}`);
  }
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const subscription = event.data.object as Stripe.Subscription;

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status,
      current_period_end: new Date(
        (subscription as any).current_period_end * 1000, // eslint-disable-line @typescript-eslint/no-explicit-any
      ).toISOString(),
      stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update profile for subscription update: ${error.message}`);
  }
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const subscription = event.data.object as Stripe.Subscription;

  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      current_period_end: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update profile for subscription deletion: ${error.message}`);
  }
}
