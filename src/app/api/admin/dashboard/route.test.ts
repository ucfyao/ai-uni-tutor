import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockFindById = vi.fn();
vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => ({ findById: mockFindById }),
}));

const mockFetchStripeData = vi.fn();
const mockFetchUpstashData = vi.fn();
const mockFetchGeminiData = vi.fn();
const mockFetchAll = vi.fn();
vi.mock('@/lib/services/AdminDashboardService', () => ({
  getAdminDashboardService: () => ({
    fetchStripeData: mockFetchStripeData,
    fetchUpstashData: mockFetchUpstashData,
    fetchGeminiData: mockFetchGeminiData,
    fetchAll: mockFetchAll,
  }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'admin@example.com' };

function makeRequest(service?: string) {
  const url = service
    ? `http://localhost/api/admin/dashboard?service=${service}`
    : 'http://localhost/api/admin/dashboard';
  return new Request(url);
}

function setupSuperAdmin() {
  mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  mockFindById.mockResolvedValue({ id: 'user-1', role: 'super_admin' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is a regular user', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'user' });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when user is admin (not super_admin)', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'admin' });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when profile is not found', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns all dashboard data when no service param', async () => {
    setupSuperAdmin();
    const mockData = { stripe: {}, upstash: {}, gemini: {}, fetchedAt: '2026-02-21T00:00:00Z' };
    mockFetchAll.mockResolvedValue(mockData);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockData);
    expect(mockFetchAll).toHaveBeenCalledOnce();
  });

  it('returns stripe data when service=stripe', async () => {
    setupSuperAdmin();
    const stripeData = { available: 10000, pending: 5000, currency: 'usd' };
    mockFetchStripeData.mockResolvedValue(stripeData);

    const response = await GET(makeRequest('stripe'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(stripeData);
    expect(mockFetchStripeData).toHaveBeenCalledOnce();
    expect(mockFetchAll).not.toHaveBeenCalled();
  });

  it('returns upstash data when service=upstash', async () => {
    setupSuperAdmin();
    const upstashData = { monthlyRequests: 1000, plan: 'free' };
    mockFetchUpstashData.mockResolvedValue(upstashData);

    const response = await GET(makeRequest('upstash'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstashData);
    expect(mockFetchUpstashData).toHaveBeenCalledOnce();
  });

  it('returns gemini data when service=gemini', async () => {
    setupSuperAdmin();
    const geminiData = { models: [], totalToday: 10 };
    mockFetchGeminiData.mockResolvedValue(geminiData);

    const response = await GET(makeRequest('gemini'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(geminiData);
    expect(mockFetchGeminiData).toHaveBeenCalledOnce();
  });

  it('returns 400 for invalid service param', async () => {
    setupSuperAdmin();

    const response = await GET(makeRequest('invalid'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid service');
  });

  it('returns 500 when service throws', async () => {
    setupSuperAdmin();
    mockFetchStripeData.mockRejectedValue(new Error('Service failure'));

    const response = await GET(makeRequest('stripe'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
