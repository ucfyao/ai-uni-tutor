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
};
vi.mock('@/lib/services/ProfileService', () => ({
  getProfileService: () => mockProfileService,
}));

const mockStripe = {
  billingPortal: {
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
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/stripe/portal', {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
  });

  it('returns 400 when user has no stripe_customer_id', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockProfileService.getStripeCustomerId.mockResolvedValue(null);

    const response = await POST(createRequest());

    expect(response.status).toBe(400);
  });

  it('creates a portal session and returns URL', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe('https://billing.stripe.com/session/bps_test');
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'https://example.com/settings',
    });
  });

  it('uses localhost as fallback when NEXT_PUBLIC_SITE_URL is not set', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
    mockStripe.billingPortal.sessions.create.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    await POST(createRequest());

    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_existing',
      return_url: 'http://localhost:3000/settings',
    });
  });

  it('returns 500 when Stripe API throws', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockProfileService.getStripeCustomerId.mockResolvedValue('cus_existing');
    mockStripe.billingPortal.sessions.create.mockRejectedValue(new Error('Stripe error'));

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
  });
});
