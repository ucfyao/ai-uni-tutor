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

const mockLlmLogService = {
  getRecentLogs: vi.fn(),
  getStats: vi.fn(),
  getLogs: vi.fn(),
  getUserCostSummary: vi.fn(),
};
vi.mock('@/lib/services/LlmLogService', () => ({
  getLlmLogService: () => mockLlmLogService,
}));

const mockGetAllConfiguredModels = vi.fn();
vi.mock('@/lib/gemini', () => ({
  getAllConfiguredModels: () => mockGetAllConfiguredModels(),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'admin@example.com' };

function makeRequest(params?: Record<string, string>): Request {
  const url = new URL('http://localhost/api/admin/llm-logs');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new Request(url.toString());
}

function setupSuperAdmin() {
  mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  mockFindById.mockResolvedValue({ id: 'user-1', role: 'super_admin' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/llm-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Authentication & Authorization
  // =========================================================================

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not super_admin', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'user' });

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

  // =========================================================================
  // mode=preview
  // =========================================================================

  it('returns logs and stats for mode=preview', async () => {
    setupSuperAdmin();
    const mockLogs = [{ id: 'log-1', call_type: 'chat' }];
    const mockStats = { totalCalls: 10, totalCost: 0.5 };
    mockLlmLogService.getRecentLogs.mockResolvedValue(mockLogs);
    mockLlmLogService.getStats.mockResolvedValue(mockStats);

    const response = await GET(makeRequest({ mode: 'preview' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toEqual(mockLogs);
    expect(body.stats).toEqual(mockStats);
    expect(mockLlmLogService.getRecentLogs).toHaveBeenCalledWith(20);
    expect(mockLlmLogService.getStats).toHaveBeenCalledWith(expect.any(String));
  });

  // =========================================================================
  // mode=user-costs
  // =========================================================================

  it('returns user cost summary for mode=user-costs', async () => {
    setupSuperAdmin();
    const mockUsers = [{ userId: 'u1', totalCost: 1.5 }];
    mockLlmLogService.getUserCostSummary.mockResolvedValue(mockUsers);

    const response = await GET(makeRequest({ mode: 'user-costs', timeRange: '7d' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toEqual(mockUsers);
    expect(body.timeRange).toBe('7d');
    expect(mockLlmLogService.getUserCostSummary).toHaveBeenCalledWith(expect.any(String));
  });

  it('defaults timeRange to 30d for mode=user-costs', async () => {
    setupSuperAdmin();
    mockLlmLogService.getUserCostSummary.mockResolvedValue([]);

    const response = await GET(makeRequest({ mode: 'user-costs' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.timeRange).toBe('30d');
  });

  // =========================================================================
  // Default mode (paginated logs)
  // =========================================================================

  it('returns paginated logs with stats and models for default mode', async () => {
    setupSuperAdmin();
    const mockResult = { logs: [{ id: 'log-1' }], total: 1 };
    const mockStats = { totalCalls: 100 };
    const mockModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];
    mockLlmLogService.getLogs.mockResolvedValue(mockResult);
    mockLlmLogService.getStats.mockResolvedValue(mockStats);
    mockGetAllConfiguredModels.mockReturnValue(mockModels);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.logs).toEqual(mockResult.logs);
    expect(body.total).toBe(1);
    expect(body.stats).toEqual(mockStats);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.models).toEqual(mockModels);
  });

  it('passes filter params to getLogs', async () => {
    setupSuperAdmin();
    mockLlmLogService.getLogs.mockResolvedValue({ logs: [], total: 0 });
    mockLlmLogService.getStats.mockResolvedValue({});
    mockGetAllConfiguredModels.mockReturnValue([]);

    await GET(
      makeRequest({
        callType: 'chat',
        status: 'success',
        model: 'gemini-2.5-flash',
        timeRange: '7d',
        page: '2',
        pageSize: '25',
      }),
    );

    expect(mockLlmLogService.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        callType: 'chat',
        status: 'success',
        model: 'gemini-2.5-flash',
        startTime: expect.any(String),
      }),
      2,
      25,
    );
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when service throws', async () => {
    setupSuperAdmin();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLlmLogService.getLogs.mockRejectedValue(new Error('DB error'));
    mockLlmLogService.getStats.mockRejectedValue(new Error('DB error'));

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    consoleSpy.mockRestore();
  });
});
