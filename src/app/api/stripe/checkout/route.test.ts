import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  createClient: vi.fn().mockResolvedValue(mockSupabase),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_PRICE_ID', 'price_test_123');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');

    // Default chain resets
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await POST();

      expect(response.status).toBe(401);
      const text = await response.text();
      expect(text).toBe('Unauthorized');
    });
  });

  // =========================================================================
  // Missing STRIPE_PRICE_ID
  // =========================================================================

  describe('missing price ID', () => {
    it('returns 500 when STRIPE_PRICE_ID is not set', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      vi.stubEnv('STRIPE_PRICE_ID', '');
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });

      const response = await POST();

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Stripe Price ID is missing');
    });
  });

  // =========================================================================
  // Existing Stripe customer
  // =========================================================================

  describe('existing Stripe customer', () => {
    it('uses existing stripe_customer_id from profile', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      const response = await POST();
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

    it('creates checkout session with correct line items', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST();

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: 'price_test_123',
              quantity: 1,
            },
          ],
        }),
      );
    });

    it('creates checkout session with correct success and cancel URLs', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST();

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: 'https://example.com/settings?success=true',
          cancel_url: 'https://example.com/settings?canceled=true',
        }),
      );
    });

    it('includes userId in session metadata', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST();

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
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: null },
      });
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new',
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.url).toBe('https://checkout.stripe.com/session/cs_test');

      // Should create a new customer
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        metadata: { userId: 'user-1' },
      });

      // Should update profile with new customer ID
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        stripe_customer_id: 'cus_new',
      });

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
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST();

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
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe API rate limit'));

      const response = await POST();

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal Error');
    });

    it('returns 500 when customer creation fails', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: null },
      });
      mockStripe.customers.create.mockRejectedValue(new Error('Stripe customer creation failed'));

      const response = await POST();

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
      mockSupabase.single.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session/cs_test',
      });

      await POST();

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_address_collection: 'auto',
        }),
      );
    });
  });
});
