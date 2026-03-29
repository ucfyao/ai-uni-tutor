/**
 * Stripe Event Repository
 *
 * Manages stripe_events table for webhook idempotency.
 * Uses admin client (no user session in webhook context).
 */

import { DatabaseError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export class StripeEventRepository {
  async exists(eventId: string): Promise<boolean> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('stripe_events')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "not found" — that's expected, not an error
      throw new DatabaseError('Failed to check stripe event', error);
    }

    return !!data;
  }

  async record(eventId: string, eventType: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('stripe_events')
      .insert({ event_id: eventId, event_type: eventType });

    if (error) {
      throw new DatabaseError('Failed to record stripe event', error);
    }
  }
}

let _stripeEventRepository: StripeEventRepository | null = null;

export function getStripeEventRepository(): StripeEventRepository {
  if (!_stripeEventRepository) {
    _stripeEventRepository = new StripeEventRepository();
  }
  return _stripeEventRepository;
}
