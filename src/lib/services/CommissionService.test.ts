import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { CommissionRepository } from '@/lib/repositories/CommissionRepository';
import type { ReferralConfigRepository } from '@/lib/repositories/ReferralConfigRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type { ReferralCodeEntity, ReferralEntity, WithdrawalRequestEntity } from '@/types/referral';
import { CommissionService } from './CommissionService';
import type { ProfileService } from './ProfileService';

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
  };
}

function createMockAgentRepo(): {
  [K in keyof AgentRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    createApplication: vi.fn(),
    findApplicationByUserId: vi.fn(),
    findApplicationById: vi.fn(),
    listApplications: vi.fn(),
    updateApplication: vi.fn(),
    findWalletByUserId: vi.fn(),
    createWallet: vi.fn(),
    incrementWalletBalance: vi.fn(),
    listWithdrawals: vi.fn(),
    createWithdrawal: vi.fn(),
    updateWithdrawal: vi.fn(),
    rejectWithdrawalWithRefund: vi.fn(),
    requestWithdrawalAtomic: vi.fn(),
    approveApplicationAtomic: vi.fn(),
    getDailyReferralTrend: vi.fn(),
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

function createMockConfigRepo(): {
  [K in keyof ReferralConfigRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    getConfig: vi.fn(),
    getAllConfig: vi.fn(),
    updateConfig: vi.fn(),
  };
}

function createMockProfileService(): {
  [K in keyof ProfileService]: ReturnType<typeof vi.fn>;
} {
  return {
    getProfile: vi.fn(),
    getSubscriptionInfo: vi.fn(),
    updateProfile: vi.fn(),
    getStripeCustomerId: vi.fn(),
    updateStripeCustomerId: vi.fn(),
    updateSubscription: vi.fn(),
    updateSubscriptionBySubscriptionId: vi.fn(),
  };
}

// ---------- Test data ----------

const REFERRER_ID = 'referrer-abc-123';
const REFEREE_ID = 'referee-def-456';
const CODE_ID = 'code-ghi-789';

const USER_REFERRAL_CODE: ReferralCodeEntity = {
  id: CODE_ID,
  userId: REFERRER_ID,
  code: 'UT-USER01',
  type: 'user',
  stripePromotionCodeId: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const AGENT_REFERRAL_CODE: ReferralCodeEntity = {
  id: 'code-agent-001',
  userId: REFERRER_ID,
  code: 'UT-AGENT1',
  type: 'agent',
  stripePromotionCodeId: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const REFERRAL_ENTITY: ReferralEntity = {
  id: 'ref-001',
  referrerId: REFERRER_ID,
  refereeId: REFEREE_ID,
  referralCodeId: CODE_ID,
  status: 'paid',
  stripeSubscriptionId: 'sub_123',
  createdAt: new Date('2026-01-15'),
};

const WITHDRAWAL: WithdrawalRequestEntity = {
  id: 'wd-001',
  walletId: 'wallet-001',
  userId: REFERRER_ID,
  amount: 50,
  paymentMethod: { type: 'bank_transfer', account: '****1234' },
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-02-15'),
};

// ---------- Tests ----------

describe('CommissionService', () => {
  let service: CommissionService;
  let referralRepo: ReturnType<typeof createMockReferralRepo>;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;
  let commissionRepo: ReturnType<typeof createMockCommissionRepo>;
  let configRepo: ReturnType<typeof createMockConfigRepo>;
  let profileService: ReturnType<typeof createMockProfileService>;

  beforeEach(() => {
    vi.clearAllMocks();
    referralRepo = createMockReferralRepo();
    agentRepo = createMockAgentRepo();
    commissionRepo = createMockCommissionRepo();
    configRepo = createMockConfigRepo();
    profileService = createMockProfileService();
    service = new CommissionService(
      referralRepo as unknown as ReferralRepository,
      agentRepo as unknown as AgentRepository,
      commissionRepo as unknown as CommissionRepository,
      configRepo as unknown as ReferralConfigRepository,
      profileService as unknown as ProfileService,
    );
  });

  // ==================== processReferralReward ====================

  describe('processReferralReward', () => {
    it('should credit Pro days for user-type referral code', async () => {
      referralRepo.findCodeById.mockResolvedValue(USER_REFERRAL_CODE);
      configRepo.getConfig.mockResolvedValue(7);
      commissionRepo.create.mockResolvedValue({ id: 'comm-001' });
      profileService.getProfile.mockResolvedValue({
        id: REFERRER_ID,
        currentPeriodEnd: new Date('2026-03-01'),
        subscriptionStatus: 'active',
      });
      profileService.updateSubscription.mockResolvedValue(undefined);

      await service.processReferralReward(REFERRAL_ENTITY);

      expect(referralRepo.findCodeById).toHaveBeenCalledWith(CODE_ID);
      expect(commissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referralId: 'ref-001',
          beneficiaryId: REFERRER_ID,
          type: 'pro_days',
          amount: 7,
          currency: 'days',
        }),
      );
      expect(profileService.updateSubscription).toHaveBeenCalledWith(
        REFERRER_ID,
        expect.objectContaining({
          subscription_status: 'active',
        }),
      );
    });

    it('should return early for agent code without paymentAmount (fallback 0)', async () => {
      const agentReferral = {
        ...REFERRAL_ENTITY,
        referralCodeId: 'code-agent-001',
      };
      referralRepo.findCodeById.mockResolvedValue(AGENT_REFERRAL_CODE);
      configRepo.getConfig.mockResolvedValue(0.2);

      await service.processReferralReward(agentReferral);

      expect(commissionRepo.create).not.toHaveBeenCalled();
      expect(agentRepo.incrementWalletBalance).not.toHaveBeenCalled();
    });

    it('should credit cash for agent-type referral code with paymentAmount', async () => {
      const agentReferral = {
        ...REFERRAL_ENTITY,
        referralCodeId: 'code-agent-001',
      };
      referralRepo.findCodeById.mockResolvedValue(AGENT_REFERRAL_CODE);
      configRepo.getConfig.mockResolvedValue(0.2);
      commissionRepo.create.mockResolvedValue({ id: 'comm-002' });
      agentRepo.incrementWalletBalance.mockResolvedValue(undefined);

      await service.processReferralReward(agentReferral, 25);

      expect(commissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          referralId: 'ref-001',
          beneficiaryId: REFERRER_ID,
          type: 'cash',
          amount: 5, // 25 * 0.2
          currency: 'cny',
        }),
      );
      expect(agentRepo.incrementWalletBalance).toHaveBeenCalledWith(REFERRER_ID, 5);
    });

    it('should do nothing if referral code not found', async () => {
      referralRepo.findCodeById.mockResolvedValue(null);

      await service.processReferralReward(REFERRAL_ENTITY);

      expect(commissionRepo.create).not.toHaveBeenCalled();
    });
  });

  // ==================== creditProDays ====================

  describe('creditProDays', () => {
    it('should extend current period end by given days', async () => {
      // Use a far-future date so it's always ahead of 'now'
      const currentEnd = new Date('2027-06-01T00:00:00.000Z');
      profileService.getProfile.mockResolvedValue({
        id: REFERRER_ID,
        currentPeriodEnd: currentEnd,
        subscriptionStatus: 'active',
      });
      profileService.updateSubscription.mockResolvedValue(undefined);

      await service.creditProDays(REFERRER_ID, 7);

      expect(profileService.updateSubscription).toHaveBeenCalledWith(
        REFERRER_ID,
        expect.objectContaining({
          subscription_status: 'active',
          current_period_end: new Date(
            currentEnd.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
      );
    });

    it('should use current date as base if period already expired', async () => {
      profileService.getProfile.mockResolvedValue({
        id: REFERRER_ID,
        currentPeriodEnd: new Date('2025-01-01'), // past
        subscriptionStatus: 'expired',
      });
      profileService.updateSubscription.mockResolvedValue(undefined);

      await service.creditProDays(REFERRER_ID, 7);

      expect(profileService.updateSubscription).toHaveBeenCalledWith(
        REFERRER_ID,
        expect.objectContaining({
          subscription_status: 'active',
        }),
      );
      // The new end should be roughly now + 7 days (we just check it was called)
      const callArgs = profileService.updateSubscription.mock.calls[0][1];
      const newEnd = new Date(callArgs.current_period_end);
      const now = new Date();
      const diff = newEnd.getTime() - now.getTime();
      // Should be within ~7 days from now (allow small margin)
      expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    });

    it('should do nothing if profile not found', async () => {
      profileService.getProfile.mockResolvedValue(null);

      await service.creditProDays('nonexistent', 7);

      expect(profileService.updateSubscription).not.toHaveBeenCalled();
    });
  });

  // ==================== creditCash ====================

  describe('creditCash', () => {
    it('should delegate to agent repo', async () => {
      agentRepo.incrementWalletBalance.mockResolvedValue(undefined);

      await service.creditCash(REFERRER_ID, 5.0);

      expect(agentRepo.incrementWalletBalance).toHaveBeenCalledWith(REFERRER_ID, 5.0);
    });
  });

  // ==================== requestWithdrawal ====================

  describe('requestWithdrawal', () => {
    it('should delegate to atomic RPC and return created withdrawal', async () => {
      agentRepo.requestWithdrawalAtomic.mockResolvedValue('wd-001');
      agentRepo.listWithdrawals.mockResolvedValue([WITHDRAWAL]);

      const result = await service.requestWithdrawal(REFERRER_ID, 50, {
        type: 'bank_transfer',
      });

      expect(agentRepo.requestWithdrawalAtomic).toHaveBeenCalledWith(REFERRER_ID, 50, {
        type: 'bank_transfer',
      });
      expect(agentRepo.listWithdrawals).toHaveBeenCalledWith(REFERRER_ID);
      expect(result).toEqual(WITHDRAWAL);
    });

    it('should propagate RPC errors (e.g. insufficient balance)', async () => {
      agentRepo.requestWithdrawalAtomic.mockRejectedValue(new Error('Insufficient balance'));

      await expect(
        service.requestWithdrawal(REFERRER_ID, 50, { type: 'bank_transfer' }),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw if withdrawal not found after RPC', async () => {
      agentRepo.requestWithdrawalAtomic.mockResolvedValue('wd-missing');
      agentRepo.listWithdrawals.mockResolvedValue([]);

      await expect(
        service.requestWithdrawal(REFERRER_ID, 50, { type: 'bank_transfer' }),
      ).rejects.toThrow('Withdrawal created but not found');
    });
  });

  // ==================== approveWithdrawal ====================

  describe('approveWithdrawal', () => {
    it('should delegate to agent repo', async () => {
      agentRepo.updateWithdrawal.mockResolvedValue(undefined);

      await service.approveWithdrawal('wd-001', 'admin-123');

      expect(agentRepo.updateWithdrawal).toHaveBeenCalledWith('wd-001', {
        status: 'approved',
        reviewedBy: 'admin-123',
        reviewedAt: expect.any(Date),
      });
    });
  });

  // ==================== rejectWithdrawal ====================

  describe('rejectWithdrawal', () => {
    it('should delegate to agent repo rejectWithdrawalWithRefund', async () => {
      agentRepo.rejectWithdrawalWithRefund.mockResolvedValue(undefined);

      await service.rejectWithdrawal('wd-001', 'admin-123');

      expect(agentRepo.rejectWithdrawalWithRefund).toHaveBeenCalledWith('wd-001', 'admin-123');
    });
  });

  // ==================== completeWithdrawal ====================

  describe('completeWithdrawal', () => {
    it('should delegate to agent repo updateWithdrawal with completed status', async () => {
      agentRepo.updateWithdrawal.mockResolvedValue(undefined);

      await service.completeWithdrawal('wd-001', 'admin-123');

      expect(agentRepo.updateWithdrawal).toHaveBeenCalledWith('wd-001', {
        status: 'completed',
        reviewedBy: 'admin-123',
        reviewedAt: expect.any(Date),
      });
    });
  });

  // ==================== sumRewardDaysByBeneficiary ====================

  describe('sumRewardDaysByBeneficiary', () => {
    it('should delegate to commission repo', async () => {
      commissionRepo.sumByBeneficiary.mockResolvedValue(21);

      const result = await service.sumRewardDaysByBeneficiary(REFERRER_ID);

      expect(commissionRepo.sumByBeneficiary).toHaveBeenCalledWith(REFERRER_ID, 'pro_days');
      expect(result).toBe(21);
    });
  });
});
