import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { InstitutionRepository } from '@/lib/repositories/InstitutionRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type {
  InstitutionEntity,
  InstitutionInviteEntity,
  InstitutionMemberEntity,
} from '@/types/institution';
import type { AgentWalletEntity, WithdrawalRequestEntity } from '@/types/referral';
import { InstitutionService } from './InstitutionService';

// ---------- Mock repositories ----------

function createMockInstitutionRepo(): {
  [K in keyof InstitutionRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    createAtomic: vi.fn(),
    findById: vi.fn(),
    findByAdminId: vi.fn(),
    listAll: vi.fn(),
    update: vi.fn(),
    listMembers: vi.fn(),
    findMemberByUserId: vi.fn(),
    acceptInviteAtomic: vi.fn(),
    removeMemberAtomic: vi.fn(),
    getAmbassadorStats: vi.fn(),
    createInvite: vi.fn(),
    listInvites: vi.fn(),
    findInviteByCode: vi.fn(),
    toggleInvite: vi.fn(),
  };
}

function createMockAgentRepo(): Pick<
  { [K in keyof AgentRepository]: ReturnType<typeof vi.fn> },
  'findWalletByUserId' | 'listWithdrawals'
> {
  return {
    findWalletByUserId: vi.fn(),
    listWithdrawals: vi.fn(),
  };
}

function createMockReferralRepo(): Pick<
  { [K in keyof ReferralRepository]: ReturnType<typeof vi.fn> },
  'countByReferrerId' | 'countByReferrerIds'
> {
  return {
    countByReferrerId: vi.fn(),
    countByReferrerIds: vi.fn(),
  };
}

// ---------- Test data ----------

const ADMIN_ID = 'admin-abc-123';
const INSTITUTION_ID = 'inst-001';
const USER_ID = 'user-def-456';
const INVITE_ID = 'invite-001';

const INSTITUTION: InstitutionEntity = {
  id: INSTITUTION_ID,
  name: 'Test University Partners',
  adminId: ADMIN_ID,
  commissionRate: 0.2,
  contactInfo: { email: 'admin@test.edu' },
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const INVITE: InstitutionInviteEntity = {
  id: INVITE_ID,
  institutionId: INSTITUTION_ID,
  inviteCode: 'INV-ABC123',
  createdBy: ADMIN_ID,
  maxUses: null,
  usedCount: 0,
  expiresAt: null,
  isActive: true,
  createdAt: new Date('2026-01-15'),
};

const MEMBER: InstitutionMemberEntity = {
  id: 'member-001',
  institutionId: INSTITUTION_ID,
  userId: USER_ID,
  status: 'active',
  invitedAt: new Date('2026-02-01'),
  joinedAt: new Date('2026-02-01'),
};

const WALLET: AgentWalletEntity = {
  id: 'wallet-001',
  userId: ADMIN_ID,
  balance: 200,
  totalEarned: 500,
  totalWithdrawn: 300,
  updatedAt: new Date('2026-02-10'),
};

const PENDING_WITHDRAWAL: WithdrawalRequestEntity = {
  id: 'wd-001',
  walletId: 'wallet-001',
  userId: ADMIN_ID,
  amount: 50,
  paymentMethod: { type: 'bank_transfer' },
  status: 'pending',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: new Date('2026-02-15'),
};

// ---------- Tests ----------

describe('InstitutionService', () => {
  let service: InstitutionService;
  let institutionRepo: ReturnType<typeof createMockInstitutionRepo>;
  let agentRepo: ReturnType<typeof createMockAgentRepo>;
  let referralRepo: ReturnType<typeof createMockReferralRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    institutionRepo = createMockInstitutionRepo();
    agentRepo = createMockAgentRepo();
    referralRepo = createMockReferralRepo();
    service = new InstitutionService(
      institutionRepo as unknown as InstitutionRepository,
      agentRepo as unknown as AgentRepository,
      referralRepo as unknown as ReferralRepository,
    );
  });

  // ==================== createInstitution ====================

  describe('createInstitution', () => {
    it('should delegate to repo createAtomic', async () => {
      institutionRepo.createAtomic.mockResolvedValue(INSTITUTION_ID);

      const result = await service.createInstitution({
        name: 'Test University Partners',
        adminId: ADMIN_ID,
        commissionRate: 0.2,
      });

      expect(institutionRepo.createAtomic).toHaveBeenCalledWith({
        name: 'Test University Partners',
        adminId: ADMIN_ID,
        commissionRate: 0.2,
      });
      expect(result).toBe(INSTITUTION_ID);
    });
  });

  // ==================== createInvite ====================

  describe('createInvite', () => {
    it('should generate INV- prefix code and delegate to repo', async () => {
      institutionRepo.createInvite.mockResolvedValue(INVITE);

      const result = await service.createInvite(INSTITUTION_ID, ADMIN_ID, {
        maxUses: 10,
      });

      expect(institutionRepo.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionId: INSTITUTION_ID,
          createdBy: ADMIN_ID,
          maxUses: 10,
        }),
      );
      // Verify the invite code starts with INV-
      const callArgs = institutionRepo.createInvite.mock.calls[0][0];
      expect(callArgs.inviteCode).toMatch(/^INV-[A-Z0-9]+$/);
      expect(result).toEqual(INVITE);
    });
  });

  // ==================== toggleInvite ====================

  describe('toggleInvite', () => {
    it('should verify ownership before toggling', async () => {
      institutionRepo.listInvites.mockResolvedValue([INVITE]);
      institutionRepo.toggleInvite.mockResolvedValue(undefined);

      await service.toggleInvite(INSTITUTION_ID, INVITE_ID, false);

      expect(institutionRepo.listInvites).toHaveBeenCalledWith(INSTITUTION_ID);
      expect(institutionRepo.toggleInvite).toHaveBeenCalledWith(INVITE_ID, false);
    });

    it('should throw if invite not owned by institution', async () => {
      institutionRepo.listInvites.mockResolvedValue([]);

      await expect(service.toggleInvite(INSTITUTION_ID, 'unknown-invite', true)).rejects.toThrow(
        'Invite not found or not owned by this institution',
      );

      expect(institutionRepo.toggleInvite).not.toHaveBeenCalled();
    });
  });

  // ==================== acceptInvite ====================

  describe('acceptInvite', () => {
    it('should delegate to atomic RPC', async () => {
      institutionRepo.acceptInviteAtomic.mockResolvedValue('member-new');

      const result = await service.acceptInvite('INV-ABC123');

      expect(institutionRepo.acceptInviteAtomic).toHaveBeenCalledWith('INV-ABC123');
      expect(result).toBe('member-new');
    });
  });

  // ==================== removeMember ====================

  describe('removeMember', () => {
    it('should delegate to atomic RPC', async () => {
      institutionRepo.findById.mockResolvedValue(INSTITUTION);
      institutionRepo.removeMemberAtomic.mockResolvedValue(undefined);

      await service.removeMember(INSTITUTION_ID, USER_ID);

      expect(institutionRepo.removeMemberAtomic).toHaveBeenCalledWith(INSTITUTION_ID, USER_ID);
    });

    it('should throw if trying to remove institution admin', async () => {
      institutionRepo.findById.mockResolvedValue(INSTITUTION);

      await expect(service.removeMember(INSTITUTION_ID, ADMIN_ID)).rejects.toThrow(
        'Cannot remove institution admin',
      );
      expect(institutionRepo.removeMemberAtomic).not.toHaveBeenCalled();
    });
  });

  // ==================== getDashboard ====================

  describe('getDashboard', () => {
    it('should aggregate stats correctly', async () => {
      institutionRepo.findByAdminId.mockResolvedValue(INSTITUTION);
      institutionRepo.listMembers.mockResolvedValue([
        MEMBER,
        { ...MEMBER, id: 'member-002', userId: 'user-ghi-789' },
      ]);
      referralRepo.countByReferrerIds.mockResolvedValue(
        new Map([
          [USER_ID, { total: 10, paid: 5 }],
          ['user-ghi-789', { total: 8, paid: 3 }],
        ]),
      );
      agentRepo.findWalletByUserId.mockResolvedValue(WALLET);
      agentRepo.listWithdrawals.mockResolvedValue([PENDING_WITHDRAWAL]);

      const result = await service.getDashboard(ADMIN_ID);

      expect(result).toEqual({
        totalAmbassadors: 2,
        teamReferrals: 18,
        paidConversions: 8,
        totalIncome: 500,
        walletBalance: 200,
        pendingWithdrawals: 50,
      });
    });

    it('should throw if institution not found', async () => {
      institutionRepo.findByAdminId.mockResolvedValue(null);

      await expect(service.getDashboard(ADMIN_ID)).rejects.toThrow('Institution not found');
    });

    it('should handle missing wallet and no members', async () => {
      institutionRepo.findByAdminId.mockResolvedValue(INSTITUTION);
      institutionRepo.listMembers.mockResolvedValue([]);
      referralRepo.countByReferrerIds.mockResolvedValue(new Map());
      agentRepo.findWalletByUserId.mockResolvedValue(null);
      agentRepo.listWithdrawals.mockResolvedValue([]);

      const result = await service.getDashboard(ADMIN_ID);

      expect(referralRepo.countByReferrerIds).toHaveBeenCalledWith([]);
      expect(result).toEqual({
        totalAmbassadors: 0,
        teamReferrals: 0,
        paidConversions: 0,
        totalIncome: 0,
        walletBalance: 0,
        pendingWithdrawals: 0,
      });
    });

    it('should only count active members as ambassadors', async () => {
      institutionRepo.findByAdminId.mockResolvedValue(INSTITUTION);
      institutionRepo.listMembers.mockResolvedValue([
        MEMBER,
        { ...MEMBER, id: 'member-002', userId: 'user-suspended', status: 'suspended' },
      ]);
      referralRepo.countByReferrerIds.mockResolvedValue(
        new Map([[USER_ID, { total: 5, paid: 2 }]]),
      );
      agentRepo.findWalletByUserId.mockResolvedValue(WALLET);
      agentRepo.listWithdrawals.mockResolvedValue([]);

      const result = await service.getDashboard(ADMIN_ID);

      // Only 1 active member, suspended member excluded
      expect(result.totalAmbassadors).toBe(1);
      expect(referralRepo.countByReferrerIds).toHaveBeenCalledTimes(1);
      expect(referralRepo.countByReferrerIds).toHaveBeenCalledWith([USER_ID]);
    });
  });

  // ==================== getMembership ====================

  describe('getMembership', () => {
    it('should delegate to repo findMemberByUserId', async () => {
      institutionRepo.findMemberByUserId.mockResolvedValue(MEMBER);

      const result = await service.getMembership(USER_ID);

      expect(institutionRepo.findMemberByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(MEMBER);
    });

    it('should return null if no membership', async () => {
      institutionRepo.findMemberByUserId.mockResolvedValue(null);

      const result = await service.getMembership('nonexistent');

      expect(result).toBeNull();
    });
  });
});
