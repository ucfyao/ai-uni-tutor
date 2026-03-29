import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { apiError } from '@/lib/api-response';
import { getStripeWebhookService } from '@/lib/services/StripeWebhookService';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('Stripe-Signature') as string;

  if (!signature) {
    return apiError('Missing Stripe-Signature header', 400, 'VALIDATION');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return apiError('Missing STRIPE_WEBHOOK_SECRET', 500, 'CONFIG_ERROR');
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return apiError('Webhook signature verification failed', 400, 'VALIDATION');
  }

  try {
    await getStripeWebhookService().processEvent(event);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    return apiError('Webhook handler failed', 500);
  }
}
