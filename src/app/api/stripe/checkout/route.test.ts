import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockProfileService = {
  getStripeCustomerId: vi.fn(),
  updateStripeCustomerId: vi.fn(),
};
vi.mock('@/lib/services/ProfileService', () => ({
  getProfileService: () => mockProfileService,
}));

const mockStripe = {
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
};

vi.mock('@/lib/stripe', () => ({
  stripe: new Proxy({} as any, {
    get(_, prop) {
      return (mockStripe as any)[prop];
    },
  }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function createRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    ...(body
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', 'price_monthly_123');
    vi.stubEnv('STRIPE_PRICE_ID_SEMESTER', 'price_semester_456');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await POST(createRequest());

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Unauthorized');
    });
  });

  // =========================================================================
  // Missing STRIPE_PRICE_ID
  // =========================================================================

  describe('missing price ID', () => {
    it('returns 500 when monthly price ID is not set', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      vi.stubEnv('STRIPE_PRICE_ID_MONTHLY', '');
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');

      const response = await POST(createRequest());

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain('monthly');
    });

    it('returns 500 when semester price ID is not set', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      vi.stubEnv('STRIPE_PRICE_ID_SEMESTER', '');
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');

      const response = await POST(createRequest({ plan: 'semester' }));

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toContain('semester');
    });
  });

  // =========================================================================
  // Plan selection
  // =========================================================================

  describe('plan selection', () => {
    it('defaults to monthly when no body is provided', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest());

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_monthly_123', quantity: 1 }],
        }),
      );
    });

    it('uses monthly price when plan is monthly', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest({ plan: 'monthly' }));

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_monthly_123', quantity: 1 }],
        }),
      );
    });

    it('uses semester price when plan is semester', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest({ plan: 'semester' }));

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_semester_456', quantity: 1 }],
        }),
      );
    });
  });

  // =========================================================================
  // Existing Stripe customer
  // =========================================================================

  describe('existing Stripe customer', () => {
    it('uses existing stripe_customer_id from profile', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      const response = await POST(createRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.url).toBe('https://checkout.stripe.com/session/cs_test');

      // Should NOT create a new customer
      expect(mockStripe.customers.create).not.toHaveBeenCalled();

      // Should create checkout session with existing customer
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
          mode: 'subscription',
        }),
      );
    });

    it('creates checkout session with correct success and cancel URLs', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest());

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://example.com/settings?success=true',
          cancel_url: 'https://example.com/settings?canceled=true',
        }),
      );
    });

    it('includes userId in session metadata', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest());

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { userId: 'user-1' },
        }),
      );
    });
  });

  // =========================================================================
  // New Stripe customer
  // =========================================================================

  describe('new Stripe customer', () => {
    it('creates a new Stripe customer when profile has no stripe_customer_id', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue(null);
      mockProfileService.updateStripeCustomerId.mockResolvedValue(undefined);
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      const response = await POST(createRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.url).toBe('https://checkout.stripe.com/session/cs_test');

      // Should create a new customer
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { userId: 'user-1' },
      });

      // Should update profile with new customer ID
      expect(mockProfileService.updateStripeCustomerId).toHaveBeenCalledWith('user-1', 'cus_new');

      // Should use new customer ID for checkout
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_new',
        }),
      );
    });
  });

  // =========================================================================
  // Default site URL
  // =========================================================================

  describe('default site URL', () => {
    it('uses localhost:3000 as default when NEXT_PUBLIC_SITE_URL is not set', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest());

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'http://localhost:3000/settings?success=true',
          cancel_url: 'http://localhost:3000/settings?canceled=true',
        }),
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('returns 500 when Stripe API throws an error', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe API rate limit'));

      const response = await POST(createRequest());

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal Error');
    });

    it('returns 500 when customer creation fails', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue(null);
      mockProfileService.updateStripeCustomerId.mockResolvedValue(undefined);
      mockStripe.customers.create.mockRejectedValue(new Error('Stripe customer creation failed'));

      const response = await POST(createRequest());

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal Error');
    });
  });

  // =========================================================================
  // Billing address
  // =========================================================================

  describe('billing configuration', () => {
    it('sets billing_address_collection to auto', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST(createRequest());

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_address_collection: 'auto',
        }),
      );
    });
  });
});
