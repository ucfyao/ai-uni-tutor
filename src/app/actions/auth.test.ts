import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AuthService
const mockSignOut = vi.fn();
vi.mock('@/lib/services/AuthService', () => ({
  getAuthService: () => ({ signOut: mockSignOut }),
}));

// Mock revalidatePath
const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { signOut } = await import('./auth');

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it('should call AuthService.signOut', async () => {
    const result = await signOut();
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, data: undefined });
  });

  it('should call revalidatePath with / and layout', async () => {
    await signOut();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('should call signOut before revalidatePath', async () => {
    const callOrder: string[] = [];
    mockSignOut.mockImplementation(() => {
      callOrder.push('signOut');
      return Promise.resolve();
    });
    mockRevalidatePath.mockImplementation(() => {
      callOrder.push('revalidatePath');
    });

    await signOut();
    expect(callOrder).toEqual(['signOut', 'revalidatePath']);
  });

  it('should return error on failure', async () => {
    mockSignOut.mockRejectedValue(new Error('sign out failed'));
    const result = await signOut();
    expect(result.success).toBe(false);
  });
});
