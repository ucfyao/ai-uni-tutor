import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindById = vi.fn();

vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => ({
    findById: (...args: unknown[]) => mockFindById(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy with 200 when Supabase is connected', async () => {
    mockFindById.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'healthy' });
  });

  it('returns degraded with 503 when repository throws an error', async () => {
    mockFindById.mockRejectedValue(new Error('connection refused'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded' });
  });

  it('calls findById with a dummy UUID', async () => {
    mockFindById.mockResolvedValue(null);

    await GET();

    expect(mockFindById).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000000');
  });

  it('does not expose internal details like timestamp or checks', async () => {
    mockFindById.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).not.toHaveProperty('timestamp');
    expect(body).not.toHaveProperty('checks');
  });
});
