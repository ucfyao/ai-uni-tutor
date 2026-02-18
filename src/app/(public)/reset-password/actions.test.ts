import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { updateUser: mockUpdateUser },
  }),
}));

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { updatePassword } = await import('./actions');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

const VALID_PASSWORD = 'StrongPass1!';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updatePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error for password too short', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'Ab1!', confirmPassword: 'Ab1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('8 characters') });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('returns error for password missing uppercase', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'lowercase1!', confirmPassword: 'lowercase1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('uppercase') });
  });

  it('returns error for password missing number', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass!', confirmPassword: 'StrongPass!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('number') });
  });

  it('returns error for password missing special character', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass1', confirmPassword: 'StrongPass1' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('special') });
  });

  it('returns error when passwords do not match', async () => {
    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: 'Different1!' }),
    );
    expect(result).toEqual({ error: expect.stringContaining('do not match') });
  });

  it('calls updateUser with new password on valid input', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: VALID_PASSWORD });
  });

  it('redirects to /study on success', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockRedirect).toHaveBeenCalledWith('/study');
  });

  it('returns error on Supabase failure', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: 'Session expired' },
    });

    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(result).toEqual({ error: 'Session expired' });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
