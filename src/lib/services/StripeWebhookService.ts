/**
 * Stripe Webhook Service
 *
 * Orchestrates Stripe webhook event processing.
 * Uses StripeEventRepository for idempotency and ProfileService for subscription updates.
 */

import type Stripe from 'stripe';
import { getStripeEventRepository } from '@/lib/repositories/StripeEventRepository';
import type { StripeEventRepository } from '@/lib/repositories/StripeEventRepository';
import { getProfileService } from '@/lib/services/ProfileService';
import type { ProfileService } from '@/lib/services/ProfileService';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export class StripeWebhookService {
  private readonly eventRepo: StripeEventRepository;
  private readonly profileService: ProfileService;

  constructor(eventRepo?: StripeEventRepository, profileService?: ProfileService) {
    this.eventRepo = eventRepo ?? getStripeEventRepository();
    this.profileService = profileService ?? getProfileService();
  }

  /**
   * Process a verified Stripe event with idempotency.
   * Returns true if the event was processed, false if already handled.
   */
  async processEvent(event: Stripe.Event): Promise<boolean> {
    // Idempotency check
    if (await this.eventRepo.exists(event.id)) {
      return false;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event);
        break;
    }

    // Mark event as processed
    await this.eventRepo.record(event.id, event.type);
    return true;
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!session?.metadata?.userId) {
      throw new Error('Missing userId in checkout session metadata');
    }
    if (!session.subscription) {
      throw new Error('Missing subscription in checkout session');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe SDK types incomplete for current_period_end
    const subscription = (await getStripe().subscriptions.retrieve(
      session.subscription as string,
    )) as any;

    await this.profileService.updateSubscription(session.metadata.userId, {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });

    // Process referral reward (best-effort, non-blocking)
    try {
      const supabase = createAdminClient();
      const amountPaid = session.amount_total ? session.amount_total / 100 : undefined;
      await supabase.rpc('process_referral_payment', {
        p_referee_id: session.metadata.userId,
        p_stripe_subscription_id: subscription.id,
        p_payment_amount: amountPaid ?? null,
      });
    } catch (error) {
      console.error('Referral reward processing failed:', error);
    }
  }

  private async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = event.data.object as any;

    if (!invoice.subscription) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = (await getStripe().subscriptions.retrieve(
      invoice.subscription as string,
    )) as any;

    await this.profileService.updateSubscriptionBySubscriptionId(subscription.id, {
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    await this.profileService.updateSubscriptionBySubscriptionId(subscription.id, {
      subscription_status: subscription.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
    });
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    await this.profileService.updateSubscriptionBySubscriptionId(subscription.id, {
      subscription_status: 'canceled',
      current_period_end: new Date().toISOString(),
    });
  }

  private async handleChargeRefunded(event: Stripe.Event): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = event.data.object as any;

    if (!charge.customer) return;

    const invoiceId = charge.invoice as string | null;
    if (!invoiceId) return;

    let subscriptionId: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = (await getStripe().invoices.retrieve(invoiceId)) as any;
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
}

let _stripeWebhookService: StripeWebhookService | null = null;

export function getStripeWebhookService(): StripeWebhookService {
  if (!_stripeWebhookService) {
    _stripeWebhookService = new StripeWebhookService();
  }
  return _stripeWebhookService;
}
