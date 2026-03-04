import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommissionRepository } from '@/lib/repositories/CommissionRepository';
import type { ReferralConfigRepository } from '@/lib/repositories/ReferralConfigRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type { ReferralCodeEntity, ReferralEntity, ReferralWithReferee } from '@/types/referral';
import { ReferralService } from './ReferralService';

// ---------- Mock Stripe ----------

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    promotionCodes: {
      create: vi.fn().mockResolvedValue({ id: 'promo_mock_123' }),
    },
  }),
}));

// ---------- Mock repositories ----------

function createMockReferralRepo(): {
  [K in keyof ReferralRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findCodeByCode: vi.fn(),
    findCodeById: vi.fn(),
    findCodesByUserId: vi.fn(),
    createCode: vi.fn(),
    toggleCodeActive: vi.fn(),
    findReferralByRefereeId: vi.fn(),
    findReferralsByReferrerId: vi.fn(),
    createReferral: vi.fn(),
    updateReferralStatus: vi.fn(),
    countByReferrerId: vi.fn(),
    countByReferrerIds: vi.fn(),
  };
}

function createMockConfigRepo(): {
  [K in keyof ReferralConfigRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    getConfig: vi.fn(),
    getAllConfig: vi.fn(),
    updateConfig: vi.fn(),
  };
}

function createMockCommissionRepo(): {
  [K in keyof CommissionRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(),
    findByBeneficiaryId: vi.fn(),
    updateStatus: vi.fn(),
    sumByBeneficiary: vi.fn(),
    sumByBeneficiarySince: vi.fn(),
  };
}

// ---------- Test data ----------

const USER_ID = 'user-abc-123';
const REFEREE_ID = 'referee-def-456';
const CODE_ID = 'code-ghi-789';

const CODE_ENTITY: ReferralCodeEntity = {
  id: CODE_ID,
  userId: USER_ID,
  code: 'UT-ABC123',
  type: 'user',
  stripePromotionCodeId: 'promo_123',
  institutionId: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const REFERRAL_ENTITY: ReferralEntity = {
  id: 'ref-001',
  referrerId: USER_ID,
  refereeId: REFEREE_ID,
  referralCodeId: CODE_ID,
  status: 'registered',
  stripeSubscriptionId: null,
  createdAt: new Date('2026-01-15'),
};

const REFERRAL_WITH_REFEREE: ReferralWithReferee = {
  id: 'ref-001',
  refereeId: REFEREE_ID,
  refereeName: 'Bob Test',
  refereeEmail: 'bob@test.com',
  status: 'registered',
  createdAt: new Date('2026-01-15'),
};

// ---------- Tests ----------

describe('ReferralService', () => {
  let service: ReferralService;
  let referralRepo: ReturnType<typeof createMockReferralRepo>;
  let configRepo: ReturnType<typeof createMockConfigRepo>;
  let commissionRepo: ReturnType<typeof createMockCommissionRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    referralRepo = createMockReferralRepo();
    configRepo = createMockConfigRepo();
    commissionRepo = createMockCommissionRepo();
    service = new ReferralService(
      referralRepo as unknown as ReferralRepository,
      configRepo as unknown as ReferralConfigRepository,
      commissionRepo as unknown as CommissionRepository,
    );
  });

  // ==================== generateCode ====================

  describe('generateCode', () => {
    it('should create a referral code with Stripe promotion code', async () => {
      const createdCode = { ...CODE_ENTITY };
      referralRepo.createCode.mockResolvedValue(createdCode);

      // Set env for Stripe coupon
      process.env.STRIPE_REFERRAL_COUPON_ID = 'coupon_test';

      const result = await service.generateCode(USER_ID, 'user');

      expect(referralRepo.createCode).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: 'user',
          stripePromotionCodeId: 'promo_mock_123',
        }),
      );
      expect(result).toEqual(createdCode);

      delete process.env.STRIPE_REFERRAL_COUPON_ID;
    });

    it('should create code without Stripe if no coupon ID', async () => {
      delete process.env.STRIPE_REFERRAL_COUPON_ID;
      const createdCode = { ...CODE_ENTITY, stripePromotionCodeId: null };
      referralRepo.createCode.mockResolvedValue(createdCode);

      const result = await service.generateCode(USER_ID, 'user');

      expect(referralRepo.createCode).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          type: 'user',
        }),
      );
      expect(result).toEqual(createdCode);
    });

    it('should generate code with UT- prefix', async () => {
      referralRepo.createCode.mockResolvedValue(CODE_ENTITY);

      await service.generateCode(USER_ID, 'agent');

      const callArgs = referralRepo.createCode.mock.calls[0][0];
      expect(callArgs.code).toMatch(/^UT-[A-Z0-9]+$/);
    });
  });

  // ==================== applyReferralCode ====================

  describe('applyReferralCode', () => {
    it('should create referral when valid code is applied', async () => {
      referralRepo.findCodeByCode.mockResolvedValue(CODE_ENTITY);
      referralRepo.findReferralByRefereeId.mockResolvedValue(null);
      referralRepo.createReferral.mockResolvedValue(undefined);

      await service.applyReferralCode(REFEREE_ID, 'UT-ABC123');

      expect(referralRepo.createReferral).toHaveBeenCalledWith({
        referrerId: USER_ID,
        refereeId: REFEREE_ID,
        referralCodeId: CODE_ID,
      });
    });

    it('should not create referral if code not found', async () => {
      referralRepo.findCodeByCode.mockResolvedValue(null);

      await service.applyReferralCode(REFEREE_ID, 'INVALID');

      expect(referralRepo.createReferral).not.toHaveBeenCalled();
    });

    it('should not create referral if code is inactive', async () => {
      referralRepo.findCodeByCode.mockResolvedValue({ ...CODE_ENTITY, isActive: false });

      await service.applyReferralCode(REFEREE_ID, 'UT-ABC123');

      expect(referralRepo.createReferral).not.toHaveBeenCalled();
    });

    it('should not allow self-referral', async () => {
      referralRepo.findCodeByCode.mockResolvedValue(CODE_ENTITY);

      await service.applyReferralCode(USER_ID, 'UT-ABC123');

      expect(referralRepo.createReferral).not.toHaveBeenCalled();
    });

    it('should not create duplicate referral', async () => {
      referralRepo.findCodeByCode.mockResolvedValue(CODE_ENTITY);
      referralRepo.findReferralByRefereeId.mockResolvedValue(REFERRAL_ENTITY);

      await service.applyReferralCode(REFEREE_ID, 'UT-ABC123');

      expect(referralRepo.createReferral).not.toHaveBeenCalled();
    });
  });

  // ==================== getReferralStats ====================

  describe('getReferralStats', () => {
    it('should aggregate referral statistics', async () => {
      referralRepo.countByReferrerId.mockResolvedValue({ total: 10, paid: 5 });
      commissionRepo.sumByBeneficiary.mockResolvedValue(35);

      const stats = await service.getReferralStats(USER_ID);

      expect(stats).toEqual({
        totalReferrals: 10,
        paidReferrals: 5,
        rewardedReferrals: 5,
        totalRewardDays: 35,
      });
    });

    it('should handle zero referrals', async () => {
      referralRepo.countByReferrerId.mockResolvedValue({ total: 0, paid: 0 });
      commissionRepo.sumByBeneficiary.mockResolvedValue(0);

      const stats = await service.getReferralStats(USER_ID);

      expect(stats.totalReferrals).toBe(0);
      expect(stats.totalRewardDays).toBe(0);
    });
  });

  // ==================== getMyReferrals ====================

  describe('getMyReferrals', () => {
    it('should delegate to repository', async () => {
      referralRepo.findReferralsByReferrerId.mockResolvedValue([REFERRAL_WITH_REFEREE]);

      const result = await service.getMyReferrals(USER_ID);

      expect(referralRepo.findReferralsByReferrerId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual([REFERRAL_WITH_REFEREE]);
    });
  });

  // ==================== getMyCodes ====================

  describe('getMyCodes', () => {
    it('should delegate to repository', async () => {
      referralRepo.findCodesByUserId.mockResolvedValue([CODE_ENTITY]);

      const result = await service.getMyCodes(USER_ID);

      expect(referralRepo.findCodesByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual([CODE_ENTITY]);
    });
  });

  // ==================== toggleCode ====================

  describe('toggleCode', () => {
    it('should verify ownership and delegate to repository', async () => {
      referralRepo.findCodesByUserId.mockResolvedValue([CODE_ENTITY]);
      referralRepo.toggleCodeActive.mockResolvedValue(undefined);

      await service.toggleCode(USER_ID, CODE_ID, false);

      expect(referralRepo.findCodesByUserId).toHaveBeenCalledWith(USER_ID);
      expect(referralRepo.toggleCodeActive).toHaveBeenCalledWith(CODE_ID, false);
    });

    it('should throw if code not owned by user', async () => {
      referralRepo.findCodesByUserId.mockResolvedValue([]);

      await expect(service.toggleCode(USER_ID, CODE_ID, false)).rejects.toThrow(
        'Referral code not found or not owned by user',
      );
    });
  });
});
