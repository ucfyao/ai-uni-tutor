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

const mockFetchAll = vi.fn();
vi.mock('@/lib/services/AdminDashboardService', () => ({
  getAdminDashboardService: () => ({ fetchAll: mockFetchAll }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'admin@example.com' };

const MOCK_DASHBOARD_DATA = {
  stripe: {
    available: 100_00,
    pending: 50_00,
    currency: 'usd',
    activeSubscriptions: 3,
    monthlyRevenue: 200_00,
  },
  upstash: { monthlyRequests: 1000, monthlyBandwidth: 512, currentStorage: 128, monthlyBilling: 0 },
  gemini: { models: [], totalToday: 42, totalMonthly: 500, activeUsersToday: 5 },
  fetchedAt: '2026-02-21T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is a regular user', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'user' });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when user is admin (not super_admin)', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'admin' });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when profile is not found', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns dashboard data for super_admin', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'super_admin' });
    mockFetchAll.mockResolvedValue(MOCK_DASHBOARD_DATA);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(MOCK_DASHBOARD_DATA);
    expect(mockFindById).toHaveBeenCalledWith('user-1');
    expect(mockFetchAll).toHaveBeenCalledOnce();
  });

  it('returns 500 when service throws', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'super_admin' });
    mockFetchAll.mockRejectedValue(new Error('Service failure'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
