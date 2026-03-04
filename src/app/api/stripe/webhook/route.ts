import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getProfileService } from '@/lib/services/ProfileService';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

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
  } catch {
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency: skip already-processed events
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existing) {
    return new NextResponse(null, { status: 200 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event);
    } else if (event.type === 'invoice.payment_succeeded') {
      await handleInvoicePaymentSucceeded(event);
    } else if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionUpdated(event);
    } else if (event.type === 'customer.subscription.deleted') {
      await handleSubscriptionDeleted(event);
    } else if (event.type === 'charge.refunded') {
      await handleChargeRefunded(event);
    }

    // Mark event as processed
    await supabase.from('stripe_events').insert({ event_id: event.id, event_type: event.type });

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }
}

// ---------- Event Handlers ----------

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  if (!session?.metadata?.userId) {
    throw new Error('Missing userId in checkout session metadata');
  }

  if (!session.subscription) {
    throw new Error('Missing subscription in checkout session');
  }

  const subscription = (await stripe.subscriptions.retrieve(session.subscription as string)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Stripe SDK types incomplete for current_period_end
  const profileService = getProfileService();

  await profileService.updateSubscription(session.metadata.userId, {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    subscription_status: subscription.status,
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
  });

  // Process referral reward if applicable (bypass RLS via SECURITY DEFINER RPC)
  try {
    const supabase = createAdminClient();
    const amountPaid = session.amount_total ? session.amount_total / 100 : undefined;
    await supabase.rpc('process_referral_payment', {
      p_referee_id: session.metadata.userId,
      p_stripe_subscription_id: subscription.id,
      p_payment_amount: amountPaid ?? null,
    });
  } catch (error) {
    // Log but don't fail the webhook — referral is best-effort
    console.error('Referral reward processing failed:', error);
  }
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoice = event.data.object as any; // Stripe SDK types incomplete for invoice.subscription

  if (!invoice.subscription) {
    return; // One-off invoice, not subscription-related
  }

  const subscription = (await stripe.subscriptions.retrieve(invoice.subscription as string)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Stripe SDK types incomplete for current_period_end
  const profileService = getProfileService();

  await profileService.updateSubscriptionBySubscriptionId(subscription.id, {
    subscription_status: subscription.status,
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
  });
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const profileService = getProfileService();

  await profileService.updateSubscriptionBySubscriptionId(subscription.id, {
    subscription_status: subscription.status,
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
  });
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const profileService = getProfileService();

  await profileService.updateSubscriptionBySubscriptionId(subscription.id, {
    subscription_status: 'canceled',
    current_period_end: new Date().toISOString(),
  });
}

async function handleChargeRefunded(event: Stripe.Event) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK types incomplete for charge.invoice
  const charge = event.data.object as any;

  if (!charge.customer) return;

  const invoiceId = charge.invoice as string | null;
  if (!invoiceId) return;

  let subscriptionId: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK types incomplete for invoice.subscription
    const invoice = (await stripe.invoices.retrieve(invoiceId)) as any;
    subscriptionId = invoice.subscription as string | undefined;
  } catch {
    return;
  }

  if (!subscriptionId) return;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', charge.customer as string)
    .single();

  if (!profile) return;

  try {
    await supabase.rpc('clawback_referral_commission', {
      p_referee_id: profile.id,
      p_stripe_subscription_id: subscriptionId,
    });
  } catch (error) {
    console.error('Commission clawback failed:', error);
  }
}
