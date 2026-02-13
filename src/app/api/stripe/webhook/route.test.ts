import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock('@/lib/stripe', () => ({
  stripe: new Proxy({} as any, {
    get(_, prop) {
      if (prop === 'webhooks') {
        return {
          constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
        };
      }
      if (prop === 'subscriptions') {
        return {
          retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
        };
      }
      return undefined;
    },
  }),
}));

// Mock `next/headers` — the route uses `headers()` to read Stripe-Signature
const mockHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(async () => ({
    get: (key: string) => mockHeaders.get(key) ?? null,
  })),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body = 'raw-webhook-body', signature?: string): NextRequest {
  if (signature) {
    mockHeaders.set('Stripe-Signature', signature);
  } else {
    mockHeaders.delete('Stripe-Signature');
  }

  return new NextRequest(
    new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'Stripe-Signature': signature } : {}),
      },
    }),
  );
}

/** Helper to set up the idempotency check (stripe_events table). */
function setupIdempotency(existing: boolean) {
  // The first `from` call is for stripe_events idempotency check
  // We track call order to differentiate stripe_events from profiles
  if (existing) {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: '1' } });
  } else {
    mockSupabase.single.mockResolvedValueOnce({ data: null });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');
    mockHeaders.clear();

    // Reset chainable mocks
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
  });

  // =========================================================================
  // Signature validation
  // =========================================================================

  describe('signature validation', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const response = await POST(makeRequest('body', undefined));

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('Missing Stripe-Signature header');
    });

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Missing STRIPE_WEBHOOK_SECRET');
    });

    it('returns 400 when constructEvent throws (invalid signature)', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const response = await POST(makeRequest('body', 'invalid_signature'));

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Webhook Error');
      expect(text).toContain('Signature verification failed');
    });

    it('calls constructEvent with raw body, signature, and secret', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_test',
        type: 'unknown.event',
        data: { object: {} },
      });
      setupIdempotency(false);

      await POST(makeRequest('raw-body-content', 'sig_test_123'));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        'raw-body-content',
        'sig_test_123',
        'whsec_test_secret',
      );
    });
  });

  // =========================================================================
  // Idempotency
  // =========================================================================

  describe('idempotency', () => {
    it('returns 200 and skips processing when event was already processed', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_already_processed',
        type: 'checkout.session.completed',
        data: { object: {} },
      });
      setupIdempotency(true);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);

      // Should NOT update profiles
      // The from('profiles').update() should not be called after the idempotency check
      // But from('stripe_events') is called for the check.
      // We verify subscriptions.retrieve was not called (proves handler was skipped)
      expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // checkout.session.completed
  // =========================================================================

  describe('checkout.session.completed', () => {
    it('updates profile with subscription details', async () => {
      const mockEvent = {
        id: 'evt_checkout_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: 'sub_123',
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_123',
        customer: 'cus_456',
        status: 'active',
        current_period_end: 1735689600, // 2025-01-01
      });

      // profile update result
      mockSupabase.eq.mockReturnThis();
      mockSupabase.update.mockReturnThis();

      // We need the second from().update().eq() chain to return success
      // The mock chain resolves via the `then` mechanism,
      // but since these are chainable mocks that return `this`, the await
      // on the chain resolves to the chain itself, which has no `error`.
      // We need single() for stripe_events check and then thenable for update.
      // Let's override eq to return a promise-like for the update chain
      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        // First eq: stripe_events select chain (ends with .single())
        // Second eq: profiles update chain (await resolves directly)
        if (eqCallCount >= 2) {
          return Promise.resolve({ data: null, error: null });
        }
        return mockSupabase;
      });

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_123');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_subscription_id: 'sub_123',
          stripe_customer_id: 'cus_456',
          subscription_status: 'active',
        }),
      );
    });

    it('throws error when userId is missing from session metadata', async () => {
      const mockEvent = {
        id: 'evt_no_user',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {},
            subscription: 'sub_123',
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Webhook handler failed');
    });

    it('throws error when subscription is missing from checkout session', async () => {
      const mockEvent = {
        id: 'evt_no_sub',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: null,
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Webhook handler failed');
    });
  });

  // =========================================================================
  // customer.subscription.updated
  // =========================================================================

  describe('customer.subscription.updated', () => {
    it('updates profile with new subscription status and period end', async () => {
      const mockEvent = {
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_789',
            status: 'past_due',
            current_period_end: 1740000000,
            items: {
              data: [{ price: { id: 'price_new' } }],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({ data: null, error: null });
        }
        return mockSupabase;
      });

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'past_due',
          stripe_price_id: 'price_new',
        }),
      );
    });
  });

  // =========================================================================
  // customer.subscription.deleted
  // =========================================================================

  describe('customer.subscription.deleted', () => {
    it('marks subscription as canceled in profile', async () => {
      const mockEvent = {
        id: 'evt_sub_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_canceled',
            status: 'canceled',
            current_period_end: 1740000000,
            items: { data: [] },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({ data: null, error: null });
        }
        return mockSupabase;
      });

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'canceled',
        }),
      );
    });
  });

  // =========================================================================
  // Unknown event type
  // =========================================================================

  describe('unknown event type', () => {
    it('returns 200 for unhandled event types', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_unknown',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });
      setupIdempotency(false);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
    });

    it('records unhandled events in stripe_events table', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_unknown_2',
        type: 'charge.succeeded',
        data: { object: {} },
      });
      setupIdempotency(false);

      await POST(makeRequest('body', 'sig_test'));

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'evt_unknown_2',
          event_type: 'charge.succeeded',
        }),
      );
    });
  });

  // =========================================================================
  // Event processing records
  // =========================================================================

  describe('event processing', () => {
    it('inserts event into stripe_events table after successful processing', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_to_record',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_xyz',
            status: 'canceled',
            current_period_end: 1740000000,
            items: { data: [] },
          },
        },
      });
      setupIdempotency(false);

      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({ data: null, error: null });
        }
        return mockSupabase;
      });

      await POST(makeRequest('body', 'sig_test'));

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        event_id: 'evt_to_record',
        event_type: 'customer.subscription.deleted',
      });
    });
  });

  // =========================================================================
  // Handler errors
  // =========================================================================

  describe('handler errors', () => {
    it('returns 500 when a handler throws an error', async () => {
      const mockEvent = {
        id: 'evt_handler_fail',
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: 'user-1' },
            subscription: 'sub_fail',
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      mockSubscriptionsRetrieve.mockRejectedValue(new Error('Stripe API error'));

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Webhook handler failed');
    });

    it('returns 500 when profile update returns an error', async () => {
      const mockEvent = {
        id: 'evt_db_fail',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_db_fail',
            status: 'active',
            current_period_end: 1740000000,
            items: { data: [{ price: { id: 'price_x' } }] },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      setupIdempotency(false);

      let eqCallCount = 0;
      mockSupabase.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({
            data: null,
            error: { message: 'Row not found' },
          });
        }
        return mockSupabase;
      });

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Webhook handler failed');
    });
  });
});
