import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Lazy: validated on first use so pages/tests without Stripe env don't crash at import. */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing. Please set it in your .env.local file.');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover',
      appInfo: {
        name: 'AI Uni Tutor',
        version: '0.1.0',
      },
    });
  }
  return _stripe;
}

/** @deprecated Prefer getStripe() for lazy validation. Kept for backward compatibility. */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});
