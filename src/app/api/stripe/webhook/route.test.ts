import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

const mockProcessEvent = vi.fn();
vi.mock('@/lib/services/StripeWebhookService', () => ({
  getStripeWebhookService: () => ({
    processEvent: (...args: unknown[]) => mockProcessEvent(...args),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');
    mockHeaders.clear();
  });

  // =========================================================================
  // Signature validation
  // =========================================================================

  describe('signature validation', () => {
    it('returns 400 when Stripe-Signature header is missing', async () => {
      const response = await POST(makeRequest('body', undefined));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: 'Missing Stripe-Signature header', code: 'VALIDATION' });
    });

    it('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: 'Missing STRIPE_WEBHOOK_SECRET', code: 'CONFIG_ERROR' });
    });

    it('returns 400 when constructEvent throws (invalid signature)', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const response = await POST(makeRequest('body', 'invalid_signature'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: 'Webhook signature verification failed', code: 'VALIDATION' });
    });

    it('calls constructEvent with raw body, signature, and secret', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_test',
        type: 'unknown.event',
        data: { object: {} },
      });
      mockProcessEvent.mockResolvedValue(undefined);

      await POST(makeRequest('raw-body-content', 'sig_test_123'));

      expect(mockConstructEvent).toHaveBeenCalledWith(
        'raw-body-content',
        'sig_test_123',
        'whsec_test_secret',
      );
    });
  });

  // =========================================================================
  // Event processing delegation to StripeWebhookService
  // =========================================================================

  describe('event processing', () => {
    it('delegates to StripeWebhookService.processEvent and returns 200', async () => {
      const mockEvent = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(mockEvent);
      mockProcessEvent.mockResolvedValue(undefined);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
      expect(mockProcessEvent).toHaveBeenCalledWith(mockEvent);
    });

    it('returns 200 for unhandled event types', async () => {
      const mockEvent = {
        id: 'evt_unknown',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(mockEvent);
      mockProcessEvent.mockResolvedValue(undefined);

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(200);
      expect(mockProcessEvent).toHaveBeenCalledWith(mockEvent);
    });
  });

  // =========================================================================
  // Handler errors
  // =========================================================================

  describe('handler errors', () => {
    it('returns 500 when processEvent throws an error', async () => {
      const mockEvent = {
        id: 'evt_handler_fail',
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(mockEvent);
      mockProcessEvent.mockRejectedValue(new Error('Stripe API error'));

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: 'Webhook handler failed', code: 'INTERNAL' });
    });

    it('returns 500 when service throws during subscription update', async () => {
      const mockEvent = {
        id: 'evt_db_fail',
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_fail' } },
      };
      mockConstructEvent.mockReturnValue(mockEvent);
      mockProcessEvent.mockRejectedValue(new Error('Row not found'));

      const response = await POST(makeRequest('body', 'sig_test'));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: 'Webhook handler failed', code: 'INTERNAL' });
    });
  });
});
