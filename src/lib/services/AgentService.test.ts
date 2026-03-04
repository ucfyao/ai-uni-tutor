import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type {
  AgentApplicationEntity,
  AgentWalletEntity,
  ReferralCodeEntity,
  WithdrawalRequestEntity,
} from '@/types/referral';
import { AgentService } from './AgentService';
import type { ReferralService } from './ReferralService';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    promotionCodes: { create: vi.fn().mockResolvedValue({ id: 'promo_mock' }) },
  }),
}));

// ---------- Mock repositories ----------

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
    completeWithdrawalAtomic: vi.fn(),
    requestWithdrawalAtomic: vi.fn(),
    approveApplicationAtomic: vi.fn(),
    getDailyReferralTrend: vi.fn(),
    findWithdrawalById: vi.fn(),
  };
}

function createMockProfileRepo(): Pick<
  { [K in keyof ProfileRepository]: ReturnType<typeof vi.fn> },
  'updateRole'
> {
  return {
    updateRole: vi.fn(),
  };
}

function createMockReferralRepo(): Pick<
  { [K in keyof ReferralRepository]: ReturnType<typeof vi.fn> },
  'countByReferrerId'
> {
  return {
    countByReferrerId: vi.fn(),
  };
}

function createMockReferralService(): Pick<
  { [K in keyof ReferralService]: ReturnType<typeof vi.fn> },
  'generateCode'
> {
  return {
    generateCode: vi.fn(),
  };
}

// ---------- Test data ----------

const USER_ID = 'user-abc-123';
const ADMIN_ID = 'admin-xyz-789';
const APP_ID = 'app-001';

const APPLICATION: AgentApplicationEntity = {
  id: APP_ID,
  userId: USER_ID,
  fullName: 'Alice Student',
  university: 'Test University',
  contactInfo: { wechat: 'alice_wechat' },
  motivation: 'I want to help promote the platform.',
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-02-01'),
};

const WALLET: AgentWalletEntity = {
  id: 'wallet-001',
  userId: USER_ID,
  balance: 50,
  totalEarned: 100,
  totalWithdrawn: 50,
  updatedAt: new Date('2026-02-10'),
};

const AGENT_CODE: ReferralCodeEntity = {
  id: 'code-agent-001',
  userId: USER_ID,
  code: 'UT-AGENT1',
  type: 'agent',
  stripePromotionCodeId: null,
  institutionId: null,
  isActive: true,
  createdAt: new Date('2026-02-05'),
  updatedAt: new Date('2026-02-05'),
};

const PENDING_WITHDRAWAL: WithdrawalRequestEntity = {
  id: 'wd-001',
  walletId: 'wallet-001',
  userId: USER_ID,
  amount: 20,
  paymentMethod: { type: 'bank_transfer' },
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-02-15'),
};

// ---------- Tests ----------

describe('AgentService', () => {
  let service: AgentService;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;
  let profileRepo: ReturnType<typeof createMockProfileRepo>;
  let referralRepo: ReturnType<typeof createMockReferralRepo>;
  let referralService: ReturnType<typeof createMockReferralService>;

  beforeEach(() => {
    vi.clearAllMocks();
    agentRepo = createMockAgentRepo();
    profileRepo = createMockProfileRepo();
    referralRepo = createMockReferralRepo();
    referralService = createMockReferralService();
    service = new AgentService(
      agentRepo as unknown as AgentRepository,
      profileRepo as unknown as ProfileRepository,
      referralRepo as unknown as ReferralRepository,
      referralService as unknown as ReferralService,
    );
  });

  // ==================== submitApplication ====================

  describe('submitApplication', () => {
    it('should create a new application', async () => {
      agentRepo.findApplicationByUserId.mockResolvedValue(null);
      agentRepo.createApplication.mockResolvedValue(APPLICATION);

      const result = await service.submitApplication(USER_ID, {
        fullName: 'Alice Student',
        university: 'Test University',
        contactInfo: { wechat: 'alice_wechat' },
        motivation: 'I want to help promote the platform.',
      });

      expect(agentRepo.createApplication).toHaveBeenCalledWith({
        userId: USER_ID,
        fullName: 'Alice Student',
        university: 'Test University',
        contactInfo: { wechat: 'alice_wechat' },
        motivation: 'I want to help promote the platform.',
      });
      expect(result).toEqual(APPLICATION);
    });

    it('should throw if user already has a pending application', async () => {
      agentRepo.findApplicationByUserId.mockResolvedValue(APPLICATION);

      await expect(
        service.submitApplication(USER_ID, {
          fullName: 'Alice Student',
          university: 'Test University',
          contactInfo: {},
          motivation: 'Motivation',
        }),
      ).rejects.toThrow('You already have a pending application');
    });

    it('should allow reapplication if previous was rejected', async () => {
      agentRepo.findApplicationByUserId.mockResolvedValue({
        ...APPLICATION,
        status: 'rejected',
      });
      agentRepo.createApplication.mockResolvedValue(APPLICATION);

      const result = await service.submitApplication(USER_ID, {
        fullName: 'Alice Student',
        university: 'Test University',
        contactInfo: {},
        motivation: 'Motivation',
      });

      expect(agentRepo.createApplication).toHaveBeenCalled();
      expect(result).toEqual(APPLICATION);
    });
  });

  // ==================== getApplication ====================

  describe('getApplication', () => {
    it('should return application if found', async () => {
      agentRepo.findApplicationByUserId.mockResolvedValue(APPLICATION);

      const result = await service.getApplication(USER_ID);

      expect(result).toEqual(APPLICATION);
    });

    it('should return null if no application', async () => {
      agentRepo.findApplicationByUserId.mockResolvedValue(null);

      const result = await service.getApplication(USER_ID);

      expect(result).toBeNull();
    });
  });

  // ==================== reviewApplication ====================

  describe('reviewApplication', () => {
    it('should approve application atomically and generate code', async () => {
      agentRepo.approveApplicationAtomic.mockResolvedValue(USER_ID);
      referralService.generateCode.mockResolvedValue(AGENT_CODE);

      await service.reviewApplication(APP_ID, ADMIN_ID, 'approved');

      expect(agentRepo.approveApplicationAtomic).toHaveBeenCalledWith(APP_ID, ADMIN_ID);
      expect(referralService.generateCode).toHaveBeenCalledWith(USER_ID, 'agent');
      // Should NOT call the non-atomic methods
      expect(agentRepo.updateApplication).not.toHaveBeenCalled();
      expect(profileRepo.updateRole).not.toHaveBeenCalled();
      expect(agentRepo.createWallet).not.toHaveBeenCalled();
    });

    it('should reject application without side effects', async () => {
      agentRepo.updateApplication.mockResolvedValue(undefined);

      await service.reviewApplication(APP_ID, ADMIN_ID, 'rejected');

      expect(agentRepo.updateApplication).toHaveBeenCalledWith(APP_ID, {
        status: 'rejected',
        reviewedBy: ADMIN_ID,
        reviewedAt: expect.any(Date),
      });
      expect(profileRepo.updateRole).not.toHaveBeenCalled();
      expect(agentRepo.createWallet).not.toHaveBeenCalled();
      expect(referralService.generateCode).not.toHaveBeenCalled();
    });
  });

  // ==================== getWallet ====================

  describe('getWallet', () => {
    it('should return wallet if found', async () => {
      agentRepo.findWalletByUserId.mockResolvedValue(WALLET);

      const result = await service.getWallet(USER_ID);

      expect(result).toEqual(WALLET);
    });

    it('should return null if no wallet', async () => {
      agentRepo.findWalletByUserId.mockResolvedValue(null);

      const result = await service.getWallet(USER_ID);

      expect(result).toBeNull();
    });
  });

  // ==================== getDashboard ====================

  describe('getDashboard', () => {
    it('should aggregate dashboard stats', async () => {
      agentRepo.findWalletByUserId.mockResolvedValue(WALLET);
      referralRepo.countByReferrerId.mockResolvedValue({ total: 15, paid: 8 });
      agentRepo.listWithdrawals.mockResolvedValue([PENDING_WITHDRAWAL]);

      const result = await service.getDashboard(USER_ID);

      expect(result).toEqual({
        totalReferrals: 15,
        paidReferrals: 8,
        totalEarned: 100,
        walletBalance: 50,
        pendingWithdrawals: 20,
      });
    });

    it('should handle missing wallet', async () => {
      agentRepo.findWalletByUserId.mockResolvedValue(null);
      referralRepo.countByReferrerId.mockResolvedValue({ total: 0, paid: 0 });
      agentRepo.listWithdrawals.mockResolvedValue([]);

      const result = await service.getDashboard(USER_ID);

      expect(result).toEqual({
        totalReferrals: 0,
        paidReferrals: 0,
        totalEarned: 0,
        walletBalance: 0,
        pendingWithdrawals: 0,
      });
    });

    it('should sum only pending withdrawals', async () => {
      agentRepo.findWalletByUserId.mockResolvedValue(WALLET);
      referralRepo.countByReferrerId.mockResolvedValue({ total: 5, paid: 3 });
      agentRepo.listWithdrawals.mockResolvedValue([
        PENDING_WITHDRAWAL,
        { ...PENDING_WITHDRAWAL, id: 'wd-002', status: 'approved', amount: 30 },
        { ...PENDING_WITHDRAWAL, id: 'wd-003', status: 'pending', amount: 10 },
      ]);

      const result = await service.getDashboard(USER_ID);

      expect(result.pendingWithdrawals).toBe(30); // 20 + 10, approved excluded
    });
  });

  // ==================== getDailyTrend ====================

  describe('getDailyTrend', () => {
    it('should delegate to agent repo getDailyReferralTrend', async () => {
      const trendData = [
        { date: '2026-03-01', count: 3 },
        { date: '2026-03-02', count: 1 },
      ];
      agentRepo.getDailyReferralTrend.mockResolvedValue(trendData);

      const result = await service.getDailyTrend(USER_ID, 30);

      expect(agentRepo.getDailyReferralTrend).toHaveBeenCalledWith(USER_ID, 30);
      expect(result).toEqual(trendData);
    });
  });

  // ==================== listApplications ====================

  describe('listApplications', () => {
    it('should delegate to agent repo', async () => {
      agentRepo.listApplications.mockResolvedValue([APPLICATION]);

      const result = await service.listApplications('pending');

      expect(agentRepo.listApplications).toHaveBeenCalledWith('pending');
      expect(result).toEqual([APPLICATION]);
    });
  });

  // ==================== listWithdrawals ====================

  describe('listWithdrawals', () => {
    it('should delegate to agent repo', async () => {
      agentRepo.listWithdrawals.mockResolvedValue([PENDING_WITHDRAWAL]);

      const result = await service.listWithdrawals(USER_ID);

      expect(agentRepo.listWithdrawals).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual([PENDING_WITHDRAWAL]);
    });
  });
});
