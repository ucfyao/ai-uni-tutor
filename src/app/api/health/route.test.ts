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

  it('returns healthy when Supabase is connected', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.supabase).toBe('ok');
    expect(body.timestamp).toBeTypeOf('number');
  });

  it('returns degraded when Supabase returns an error', async () => {
    mockSupabase.limit.mockResolvedValue({ error: { message: 'connection refused' } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.supabase).toBe('error');
  });

  it('returns degraded when Supabase throws an exception', async () => {
    mockSupabase.limit.mockRejectedValue(new Error('Network error'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.supabase).toBe('error');
  });

  it('queries the profiles table with limit 1', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    await GET();

    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(mockSupabase.select).toHaveBeenCalledWith('id');
    expect(mockSupabase.limit).toHaveBeenCalledWith(1);
  });

  it('includes a numeric timestamp in every response', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const before = Date.now();
    const response = await GET();
    const body = await response.json();
    const after = Date.now();

    expect(body.timestamp).toBeGreaterThanOrEqual(before);
    expect(body.timestamp).toBeLessThanOrEqual(after);
  });
});
