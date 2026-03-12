import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock createClient
const mockSignOut = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { signOut: mockSignOut },
    }),
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
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('should call supabase.auth.signOut', async () => {
    await signOut();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('should call revalidatePath with / and layout', async () => {
    await signOut();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('should call signOut before revalidatePath', async () => {
    const callOrder: string[] = [];
    mockSignOut.mockImplementation(() => {
      callOrder.push('signOut');
      return Promise.resolve({ error: null });
    });
    mockRevalidatePath.mockImplementation(() => {
      callOrder.push('revalidatePath');
    });

    await signOut();
    expect(callOrder).toEqual(['signOut', 'revalidatePath']);
  });
});
