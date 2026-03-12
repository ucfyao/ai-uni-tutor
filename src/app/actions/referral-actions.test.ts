import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockReferralService = {
  generateCode: vi.fn(),
  getMyReferrals: vi.fn(),
  getReferralStats: vi.fn(),
  applyReferralCode: vi.fn(),
  getMyCodes: vi.fn(),
};
vi.mock('@/lib/services/ReferralService', () => ({
  getReferralService: () => mockReferralService,
}));

const mockConfigRepo = { getAllConfig: vi.fn() };
vi.mock('@/lib/repositories/ReferralConfigRepository', () => ({
  getReferralConfigRepository: () => mockConfigRepo,
}));

vi.mock('@/lib/errors', () => ({
  mapError: (err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : 'Internal server error',
    code: 'INTERNAL',
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────────

const {
  generateReferralCode,
  getMyReferrals,
  getReferralStats,
  applyReferralAtSignup,
  getReferralConfigPublic,
  getMyCodes,
} = await import('./referral-actions');

// ── Constants ──────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('referral-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  // ─── generateReferralCode ──────────────────────────────────────────────────

  describe('generateReferralCode', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await generateReferralCode();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns code on success', async () => {
      const mockCode = { id: 'c-1', code: 'REF123', type: 'user' };
      mockReferralService.generateCode.mockResolvedValue(mockCode);

      const result = await generateReferralCode();

      expect(result).toEqual({ success: true, data: mockCode });
      expect(mockReferralService.generateCode).toHaveBeenCalledWith('user-1', 'user');
    });

    it('returns mapped error when service throws', async () => {
      mockReferralService.generateCode.mockRejectedValue(new Error('limit reached'));
      const result = await generateReferralCode();
      expect(result.success).toBe(false);
    });
  });

  // ─── getMyReferrals ────────────────────────────────────────────────────────

  describe('getMyReferrals', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getMyReferrals();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns referrals on success', async () => {
      const mockReferrals = [
        { id: 'r-1', refereeEmail: 'a@b.com' },
        { id: 'r-2', refereeEmail: 'c@d.com' },
      ];
      mockReferralService.getMyReferrals.mockResolvedValue(mockReferrals);

      const result = await getMyReferrals();

      expect(result).toEqual({ success: true, data: mockReferrals });
      expect(mockReferralService.getMyReferrals).toHaveBeenCalledWith('user-1');
    });

    it('returns mapped error when service throws', async () => {
      mockReferralService.getMyReferrals.mockRejectedValue(new Error('fail'));
      const result = await getMyReferrals();
      expect(result.success).toBe(false);
    });
  });

  // ─── getReferralStats ──────────────────────────────────────────────────────

  describe('getReferralStats', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getReferralStats();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns stats on success', async () => {
      const mockStats = { totalReferrals: 5, activeReferrals: 3 };
      mockReferralService.getReferralStats.mockResolvedValue(mockStats);

      const result = await getReferralStats();

      expect(result).toEqual({ success: true, data: mockStats });
      expect(mockReferralService.getReferralStats).toHaveBeenCalledWith('user-1');
    });

    it('returns mapped error when service throws', async () => {
      mockReferralService.getReferralStats.mockRejectedValue(new Error('fail'));
      const result = await getReferralStats();
      expect(result.success).toBe(false);
    });
  });

  // ─── applyReferralAtSignup ─────────────────────────────────────────────────

  describe('applyReferralAtSignup', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await applyReferralAtSignup('CODE123');
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error for empty code', async () => {
      const result = await applyReferralAtSignup('');
      expect(result).toEqual({ success: false, error: 'Invalid referral code' });
    });

    it('returns success when code applied', async () => {
      mockReferralService.applyReferralCode.mockResolvedValue(undefined);

      const result = await applyReferralAtSignup('VALID_CODE');

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockReferralService.applyReferralCode).toHaveBeenCalledWith('user-1', 'VALID_CODE');
    });

    it('returns mapped error when service throws', async () => {
      mockReferralService.applyReferralCode.mockRejectedValue(new Error('invalid code'));
      const result = await applyReferralAtSignup('BAD');
      expect(result.success).toBe(false);
    });
  });

  // ─── getReferralConfigPublic (public, no auth) ─────────────────────────────

  describe('getReferralConfigPublic', () => {
    it('returns config without requiring auth', async () => {
      mockGetCurrentUser.mockResolvedValue(null); // no auth, should still work
      const mockConfig = {
        user_reward_days: 7,
        referee_discount_percent: 10,
        agent_commission_percent: 15,
        min_withdrawal_amount: 50,
      };
      mockConfigRepo.getAllConfig.mockResolvedValue(mockConfig);

      const result = await getReferralConfigPublic();

      expect(result).toEqual({
        success: true,
        data: {
          user_reward_days: 7,
          referee_discount_percent: 10,
        },
      });
    });

    it('returns mapped error when repo throws', async () => {
      mockConfigRepo.getAllConfig.mockRejectedValue(new Error('fail'));
      const result = await getReferralConfigPublic();
      expect(result.success).toBe(false);
    });
  });

  // ─── getMyCodes ─────────────────────────────────────────────────────────────

  describe('getMyCodes', () => {
    it('returns Unauthorized when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const result = await getMyCodes();
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns codes on success', async () => {
      const mockCodes = [
        { id: 'c-1', code: 'REF1' },
        { id: 'c-2', code: 'REF2' },
      ];
      mockReferralService.getMyCodes.mockResolvedValue(mockCodes);

      const result = await getMyCodes();

      expect(result).toEqual({ success: true, data: mockCodes });
      expect(mockReferralService.getMyCodes).toHaveBeenCalledWith('user-1');
    });

    it('returns mapped error when service throws', async () => {
      mockReferralService.getMyCodes.mockRejectedValue(new Error('fail'));
      const result = await getMyCodes();
      expect(result.success).toBe(false);
    });
  });
});
