/**
 * Agent Service
 *
 * Business logic for campus agent applications, wallets, and dashboard stats.
 * Coordinates with AgentRepository, ProfileRepository, and ReferralService.
 */

import {
  getAgentRepository,
  getProfileRepository,
  getReferralRepository,
} from '@/lib/repositories';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type {
  AgentApplicationEntity,
  AgentDashboardStats,
  AgentWalletEntity,
  ApplicationStatus,
  WithdrawalRequestEntity,
} from '@/types/referral';
import type { ReferralService } from './ReferralService';
import { getReferralService } from './ReferralService';

export class AgentService {
  private readonly agentRepo: AgentRepository;
  private readonly profileRepo: ProfileRepository;
  private readonly referralRepo: ReferralRepository;
  private readonly _referralService?: ReferralService;

  constructor(
    agentRepo?: AgentRepository,
    profileRepo?: ProfileRepository,
    referralRepo?: ReferralRepository,
    referralService?: ReferralService,
  ) {
    this.agentRepo = agentRepo ?? getAgentRepository();
    this.profileRepo = profileRepo ?? getProfileRepository();
    this.referralRepo = referralRepo ?? getReferralRepository();
    this._referralService = referralService;
  }

  private getReferralService(): ReferralService {
    return this._referralService ?? getReferralService();
  }

  async submitApplication(
    userId: string,
    data: {
      fullName: string;
      university: string;
      contactInfo: Record<string, unknown>;
      motivation: string;
    },
  ): Promise<AgentApplicationEntity> {
    const existing = await this.agentRepo.findApplicationByUserId(userId);
    if (existing && existing.status === 'pending') {
      throw new Error('You already have a pending application');
    }

    return this.agentRepo.createApplication({
      userId,
      fullName: data.fullName,
      university: data.university,
      contactInfo: data.contactInfo,
      motivation: data.motivation,
    });
  }

  async getApplication(userId: string): Promise<AgentApplicationEntity | null> {
    return this.agentRepo.findApplicationByUserId(userId);
  }

  async reviewApplication(id: string, adminId: string, decision: ApplicationStatus): Promise<void> {
    if (decision === 'approved') {
      const agentUserId = await this.agentRepo.approveApplicationAtomic(id, adminId);

      try {
        await this.getReferralService().generateCode(agentUserId, 'agent');
      } catch (error) {
        console.error('Failed to generate agent code after approval:', error);
      }
    } else {
      await this.agentRepo.updateApplication(id, {
        status: decision,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      });
    }
  }

  async getWallet(userId: string): Promise<AgentWalletEntity | null> {
    return this.agentRepo.findWalletByUserId(userId);
  }

  async getDashboard(userId: string): Promise<AgentDashboardStats> {
    const wallet = await this.agentRepo.findWalletByUserId(userId);
    const counts = await this.referralRepo.countByReferrerId(userId);
    const withdrawals = await this.agentRepo.listWithdrawals(userId);
    const pendingWithdrawals = withdrawals
      .filter((w) => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    return {
      totalReferrals: counts.total,
      paidReferrals: counts.paid,
      totalEarned: wallet?.totalEarned ?? 0,
      walletBalance: wallet?.balance ?? 0,
      pendingWithdrawals,
    };
  }

  async getDailyTrend(userId: string, days: number): Promise<{ date: string; count: number }[]> {
    return this.agentRepo.getDailyReferralTrend(userId, days);
  }

  async listApplications(status?: ApplicationStatus): Promise<AgentApplicationEntity[]> {
    return this.agentRepo.listApplications(status);
  }

  async listWithdrawals(userId?: string): Promise<WithdrawalRequestEntity[]> {
    return this.agentRepo.listWithdrawals(userId);
  }
}

let _agentService: AgentService | null = null;

export function getAgentService(): AgentService {
  if (!_agentService) {
    _agentService = new AgentService();
  }
  return _agentService;
}
