import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockQuotaService = {
  checkStatus: vi.fn(),
  getSystemLimits: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const MOCK_STATUS = {
  canSend: true,
  usage: 5,
  limit: 10,
  remaining: 5,
  isPro: false,
};

const MOCK_LIMITS = {
  dailyLimitFree: 10,
  dailyLimitPro: 100,
  rateLimitLlmFreeRequests: 3,
  rateLimitLlmFreeWindow: '60 s',
  rateLimitLlmProRequests: 60,
  rateLimitLlmProWindow: '60 s',
  maxFileSizeMB: 10,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/quota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns quota status and limits for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkStatus.mockResolvedValue(MOCK_STATUS);
    mockQuotaService.getSystemLimits.mockReturnValue(MOCK_LIMITS);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toEqual(MOCK_STATUS);
    expect(body.limits).toEqual(MOCK_LIMITS);
  });

  it('calls checkStatus with the authenticated user id', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkStatus.mockResolvedValue(MOCK_STATUS);
    mockQuotaService.getSystemLimits.mockReturnValue(MOCK_LIMITS);

    await GET();

    expect(mockQuotaService.checkStatus).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when checkStatus throws', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkStatus.mockRejectedValue(new Error('Redis down'));
    mockQuotaService.getSystemLimits.mockReturnValue(MOCK_LIMITS);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 when getSystemLimits throws', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkStatus.mockResolvedValue(MOCK_STATUS);
    mockQuotaService.getSystemLimits.mockImplementation(() => {
      throw new Error('Config error');
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('returns pro quota status for pro user', async () => {
    const proStatus = { ...MOCK_STATUS, isPro: true, limit: 100, remaining: 95 };
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkStatus.mockResolvedValue(proStatus);
    mockQuotaService.getSystemLimits.mockReturnValue(MOCK_LIMITS);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status.isPro).toBe(true);
    expect(body.status.limit).toBe(100);
  });
});
