import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FULL_NAME_MAX_LENGTH, FULL_NAME_MIN_LENGTH } from '@/constants/profile';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockProfileService = {
  updateProfile: vi.fn(),
  getProfile: vi.fn(),
};
vi.mock('@/lib/services/ProfileService', () => ({
  getProfileService: () => mockProfileService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks are registered)
// ---------------------------------------------------------------------------

const { updateProfileFields, getProfile } = await import('./user');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const MOCK_PROFILE = {
  id: 'user-1',
  fullName: 'John Doe',
  email: 'test@example.com',
  subscriptionStatus: 'active',
  currentPeriodEnd: new Date('2025-12-31T00:00:00Z'),
  createdAt: new Date('2025-01-15T00:00:00Z'),
};

const EXPECTED_PROFILE_DATA = {
  id: 'user-1',
  full_name: 'John Doe',
  email: 'test@example.com',
  subscription_status: 'active',
  current_period_end: '2025-12-31T00:00:00.000Z',
  created_at: '2025-01-15T00:00:00.000Z',
  role: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('User Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  // =========================================================================
  // updateProfileFields
  // =========================================================================
  describe('updateProfileFields', () => {
    it('should update full name and return profile data', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const result = await updateProfileFields({ fullName: 'Jane Doe' });

      expect(result).toEqual({ success: true, data: EXPECTED_PROFILE_DATA });
      expect(mockProfileService.updateProfile).toHaveBeenCalledWith('user-1', {
        fullName: 'Jane Doe',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/personalization');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await updateProfileFields({ fullName: 'Jane Doe' });

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(mockProfileService.updateProfile).not.toHaveBeenCalled();
    });

    it('should return error for name exceeding max length', async () => {
      const longName = 'A'.repeat(FULL_NAME_MAX_LENGTH + 1);

      const result = await updateProfileFields({ fullName: longName });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain(`at most ${FULL_NAME_MAX_LENGTH}`);
      }
    });

    it('should accept name at exact max length', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const exactName = 'A'.repeat(FULL_NAME_MAX_LENGTH);
      const result = await updateProfileFields({ fullName: exactName });

      expect(result.success).toBe(true);
    });

    it('should accept name at exact min length', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const minName = 'A'.repeat(FULL_NAME_MIN_LENGTH);
      const result = await updateProfileFields({ fullName: minName });

      expect(result.success).toBe(true);
    });

    it('should allow empty fullName (treated as undefined, no update)', async () => {
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const result = await updateProfileFields({ fullName: '' });

      expect(result.success).toBe(true);
      // When fullName is empty string, the zod preprocess converts it to undefined
      // so updateProfile should NOT be called
      expect(mockProfileService.updateProfile).not.toHaveBeenCalled();
    });

    it('should allow undefined fullName (no update)', async () => {
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const result = await updateProfileFields({});

      expect(result.success).toBe(true);
      expect(mockProfileService.updateProfile).not.toHaveBeenCalled();
    });

    it('should return error when profileService.updateProfile throws', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockProfileService.updateProfile.mockRejectedValue(new Error('DB failure'));

      const result = await updateProfileFields({ fullName: 'Jane Doe' });

      expect(result).toEqual({ success: false, error: 'Failed to update profile' });
    });

    it('should return error when profile cannot be reloaded', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue(null);

      const result = await updateProfileFields({ fullName: 'Jane Doe' });

      expect(result).toEqual({ success: false, error: 'Failed to reload profile' });
    });

    it('should handle null currentPeriodEnd in profile', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue({
        ...MOCK_PROFILE,
        currentPeriodEnd: null,
      });

      const result = await updateProfileFields({ fullName: 'Jane' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_period_end).toBeNull();
      }
    });

    it('should trim whitespace from fullName', async () => {
      mockProfileService.updateProfile.mockResolvedValue(undefined);
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      await updateProfileFields({ fullName: '  Jane Doe  ' });

      expect(mockProfileService.updateProfile).toHaveBeenCalledWith('user-1', {
        fullName: 'Jane Doe',
      });
    });
  });

  // =========================================================================
  // getProfile
  // =========================================================================
  describe('getProfile', () => {
    it('should return profile data for authenticated user', async () => {
      mockProfileService.getProfile.mockResolvedValue(MOCK_PROFILE);

      const result = await getProfile();

      expect(result).toEqual(EXPECTED_PROFILE_DATA);
      expect(mockProfileService.getProfile).toHaveBeenCalledWith('user-1');
    });

    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getProfile();

      expect(result).toBeNull();
      expect(mockProfileService.getProfile).not.toHaveBeenCalled();
    });

    it('should return null when profile is not found', async () => {
      mockProfileService.getProfile.mockResolvedValue(null);

      const result = await getProfile();

      expect(result).toBeNull();
    });

    it('should handle null currentPeriodEnd', async () => {
      mockProfileService.getProfile.mockResolvedValue({
        ...MOCK_PROFILE,
        currentPeriodEnd: null,
      });

      const result = await getProfile();

      expect(result).not.toBeNull();
      if (result) {
        expect(result.current_period_end).toBeNull();
      }
    });

    it('should handle null subscription status', async () => {
      mockProfileService.getProfile.mockResolvedValue({
        ...MOCK_PROFILE,
        subscriptionStatus: null,
      });

      const result = await getProfile();

      expect(result).not.toBeNull();
      if (result) {
        expect(result.subscription_status).toBeNull();
      }
    });
  });
});
