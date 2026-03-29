import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdatePassword = vi.fn();
vi.mock('@/lib/services/AuthService', () => ({
  getAuthService: () => ({
    updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
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
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('8 characters'),
      code: 'VALIDATION',
    });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('returns error for password missing uppercase', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'lowercase1!', confirmPassword: 'lowercase1!' }),
    );
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('uppercase'),
      code: 'VALIDATION',
    });
  });

  it('returns error for password missing number', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass!', confirmPassword: 'StrongPass!' }),
    );
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('number'),
      code: 'VALIDATION',
    });
  });

  it('returns error for password missing special character', async () => {
    const result = await updatePassword(
      buildFormData({ password: 'StrongPass1', confirmPassword: 'StrongPass1' }),
    );
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('special'),
      code: 'VALIDATION',
    });
  });

  it('returns error when passwords do not match', async () => {
    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: 'Different1!' }),
    );
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('do not match'),
      code: 'VALIDATION',
    });
  });

  it('calls AuthService.updatePassword with new password on valid input', async () => {
    mockUpdatePassword.mockResolvedValue(undefined);

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockUpdatePassword).toHaveBeenCalledWith(VALID_PASSWORD);
  });

  it('redirects to /study on success', async () => {
    mockUpdatePassword.mockResolvedValue(undefined);

    await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockRedirect).toHaveBeenCalledWith('/study');
  });

  it('returns error on AuthService failure', async () => {
    mockUpdatePassword.mockRejectedValue(new AppError('VALIDATION', 'Session expired'));

    const result = await updatePassword(
      buildFormData({ password: VALID_PASSWORD, confirmPassword: VALID_PASSWORD }),
    );

    expect(result).toEqual({ success: false, error: 'Session expired', code: 'VALIDATION' });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
