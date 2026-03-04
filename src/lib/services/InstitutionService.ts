/**
 * Institution Service
 *
 * Business logic for institution management, invite system,
 * and ambassador team operations.
 */

import {
  getAgentRepository,
  getInstitutionRepository,
  getReferralRepository,
} from '@/lib/repositories';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { InstitutionRepository } from '@/lib/repositories/InstitutionRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type {
  AmbassadorStats,
  InstitutionDashboardStats,
  InstitutionEntity,
  InstitutionInviteEntity,
  InstitutionMemberEntity,
} from '@/types/institution';

export class InstitutionService {
  private readonly institutionRepo: InstitutionRepository;
  private readonly agentRepo: AgentRepository;
  private readonly referralRepo: ReferralRepository;

  constructor(
    institutionRepo?: InstitutionRepository,
    agentRepo?: AgentRepository,
    referralRepo?: ReferralRepository,
  ) {
    this.institutionRepo = institutionRepo ?? getInstitutionRepository();
    this.agentRepo = agentRepo ?? getAgentRepository();
    this.referralRepo = referralRepo ?? getReferralRepository();
  }

  // ── Institution CRUD (admin) ─────────────────────────────────

  async createInstitution(input: {
    name: string;
    adminId: string;
    commissionRate?: number;
    contactInfo?: Record<string, unknown>;
  }): Promise<string> {
    return this.institutionRepo.createAtomic(input);
  }

  async getInstitution(id: string): Promise<InstitutionEntity | null> {
    return this.institutionRepo.findById(id);
  }

  async getInstitutionByAdmin(adminId: string): Promise<InstitutionEntity | null> {
    return this.institutionRepo.findByAdminId(adminId);
  }

  async listInstitutions(isActive?: boolean): Promise<InstitutionEntity[]> {
    return this.institutionRepo.listAll(isActive);
  }

  async updateInstitution(
    id: string,
    updates: {
      name?: string;
      commissionRate?: number;
      contactInfo?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<void> {
    return this.institutionRepo.update(id, updates);
  }

  // ── Invites ──────────────────────────────────────────────────

  async createInvite(
    institutionId: string,
    createdBy: string,
    options?: { maxUses?: number; expiresAt?: Date },
  ): Promise<InstitutionInviteEntity> {
    const base = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteCode = `INV-${base}`;
    return this.institutionRepo.createInvite({
      institutionId,
      inviteCode,
      createdBy,
      maxUses: options?.maxUses,
      expiresAt: options?.expiresAt,
    });
  }

  async listInvites(institutionId: string): Promise<InstitutionInviteEntity[]> {
    return this.institutionRepo.listInvites(institutionId);
  }

  async toggleInvite(institutionId: string, inviteId: string, isActive: boolean): Promise<void> {
    const invites = await this.institutionRepo.listInvites(institutionId);
    const owned = invites.find((i) => i.id === inviteId);
    if (!owned) throw new Error('Invite not found or not owned by this institution');
    return this.institutionRepo.toggleInvite(inviteId, isActive);
  }

  async getInviteByCode(code: string): Promise<InstitutionInviteEntity | null> {
    return this.institutionRepo.findInviteByCode(code);
  }

  // ── Members ──────────────────────────────────────────────────

  async acceptInvite(inviteCode: string): Promise<string> {
    return this.institutionRepo.acceptInviteAtomic(inviteCode);
  }

  async listMembers(institutionId: string): Promise<InstitutionMemberEntity[]> {
    return this.institutionRepo.listMembers(institutionId);
  }

  async removeMember(institutionId: string, userId: string): Promise<void> {
    const institution = await this.institutionRepo.findById(institutionId);
    if (institution?.adminId === userId) {
      throw new Error('Cannot remove institution admin');
    }
    return this.institutionRepo.removeMemberAtomic(institutionId, userId);
  }

  async getMembership(userId: string): Promise<InstitutionMemberEntity | null> {
    return this.institutionRepo.findMemberByUserId(userId);
  }

  // ── Dashboard ────────────────────────────────────────────────

  async getDashboard(adminId: string): Promise<InstitutionDashboardStats> {
    const institution = await this.institutionRepo.findByAdminId(adminId);
    if (!institution) throw new Error('Institution not found');

    const members = await this.institutionRepo.listMembers(institution.id);
    const activeMembers = members.filter((m) => m.status === 'active');

    const memberIds = activeMembers.map((m) => m.userId);
    const referralCounts = await this.referralRepo.countByReferrerIds(memberIds);
    let teamReferrals = 0;
    let paidConversions = 0;
    for (const [, c] of referralCounts) {
      teamReferrals += c.total;
      paidConversions += c.paid;
    }

    const wallet = await this.agentRepo.findWalletByUserId(adminId);
    const withdrawals = await this.agentRepo.listWithdrawals(adminId);
    const pendingWithdrawals = withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    return {
      totalAmbassadors: activeMembers.length,
      teamReferrals,
      paidConversions,
      totalIncome: wallet?.totalEarned ?? 0,
      walletBalance: wallet?.balance ?? 0,
      pendingWithdrawals,
    };
  }

  async getAmbassadorStats(institutionId: string): Promise<AmbassadorStats[]> {
    return this.institutionRepo.getAmbassadorStats(institutionId);
  }
}

let _institutionService: InstitutionService | null = null;

export function getInstitutionService(): InstitutionService {
  if (!_institutionService) {
    _institutionService = new InstitutionService();
  }
  return _institutionService;
}
