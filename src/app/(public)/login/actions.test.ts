import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockResetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  }),
}));

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn().mockReturnValue({
    NEXT_PUBLIC_SITE_URL: 'https://example.com',
  }),
  resetEnvCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { requestPasswordReset } = await import('./actions');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for invalid email', async () => {
    const formData = new FormData();
    formData.append('email', 'not-an-email');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ error: expect.any(String) });
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('calls resetPasswordForEmail with correct params', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    await requestPasswordReset(formData);

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://example.com/auth/callback?next=/reset-password',
    });
  });

  it('returns success message regardless of email existence', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ success: true });
  });

  it('returns error on Supabase failure', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    });
    const formData = new FormData();
    formData.append('email', 'user@example.com');

    const result = await requestPasswordReset(formData);

    expect(result).toEqual({ error: 'Rate limit exceeded' });
  });
});
