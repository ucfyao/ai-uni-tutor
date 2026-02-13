import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
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
    // Reset the chain defaults
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
  });

  it('returns healthy with 200 when Supabase is connected', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'healthy' });
  });

  it('returns degraded with 503 when Supabase returns an error', async () => {
    mockSupabase.limit.mockResolvedValue({ error: { message: 'connection refused' } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded' });
  });

  it('returns degraded with 503 when Supabase throws an exception', async () => {
    mockSupabase.limit.mockRejectedValue(new Error('Network error'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'degraded' });
  });

  it('queries the profiles table with limit 1', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    await GET();

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(mockSupabase.select).toHaveBeenCalledWith('id');
    expect(mockSupabase.limit).toHaveBeenCalledWith(1);
  });

  it('does not expose internal details like timestamp or checks', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const response = await GET();
    const body = await response.json();

    expect(body).not.toHaveProperty('timestamp');
    expect(body).not.toHaveProperty('checks');
  });
});
