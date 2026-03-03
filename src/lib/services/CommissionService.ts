/**
 * Commission Service
 *
 * Business logic for processing referral rewards (Pro days or cash commissions),
 * crediting wallets, and managing withdrawal requests.
 */

import {
  getAgentRepository,
  getCommissionRepository,
  getReferralConfigRepository,
  getReferralRepository,
} from '@/lib/repositories';
import type { AgentRepository } from '@/lib/repositories/AgentRepository';
import type { CommissionRepository } from '@/lib/repositories/CommissionRepository';
import type { ReferralConfigRepository } from '@/lib/repositories/ReferralConfigRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import type { ReferralEntity, WithdrawalRequestEntity } from '@/types/referral';

import type { ProfileService } from './ProfileService';
import { getProfileService } from './ProfileService';

export class CommissionService {
  private readonly referralRepo: ReferralRepository;
  private readonly agentRepo: AgentRepository;
  private readonly commissionRepo: CommissionRepository;
  private readonly configRepo: ReferralConfigRepository;
  private readonly _profileService?: ProfileService;

  constructor(
    referralRepo?: ReferralRepository,
    agentRepo?: AgentRepository,
    commissionRepo?: CommissionRepository,
    configRepo?: ReferralConfigRepository,
    profileService?: ProfileService,
  ) {
    this.referralRepo = referralRepo ?? getReferralRepository();
    this.agentRepo = agentRepo ?? getAgentRepository();
    this.commissionRepo = commissionRepo ?? getCommissionRepository();
    this.configRepo = configRepo ?? getReferralConfigRepository();
    this._profileService = profileService;
  }

  private getProfileService(): ProfileService {
    return this._profileService ?? getProfileService();
  }

  async processReferralReward(referral: ReferralEntity): Promise<void> {
    const codeEntity = await this.referralRepo.findCodeByCode(referral.referralCodeId);
    // If not found by code string, try to infer type from context.
    // The referral stores referralCodeId which is the UUID, not the code string.
    // We need to look up the code by the referral's referralCodeId to determine type.
    // Since findCodeByCode expects the code string, we need to get it differently.
    // For now, load all codes for the referrer and match by ID.
    const referrerCodes = await this.referralRepo.findCodesByUserId(referral.referrerId);
    const code = codeEntity ?? referrerCodes.find((c) => c.id === referral.referralCodeId);

    if (!code) return;

    if (code.type === 'user') {
      const rewardDays = await this.configRepo.getConfig('user_reward_days');
      await this.commissionRepo.create({
        referralId: referral.id,
        beneficiaryId: referral.referrerId,
        type: 'pro_days',
        amount: rewardDays,
        currency: 'days',
      });
      await this.creditProDays(referral.referrerId, rewardDays);
    } else if (code.type === 'agent') {
      const commissionRate = await this.configRepo.getConfig('agent_commission_rate');
      // Use a fixed base amount for MVP (e.g. subscription price ~$10)
      const baseAmount = 10;
      const cashAmount = baseAmount * commissionRate;
      await this.commissionRepo.create({
        referralId: referral.id,
        beneficiaryId: referral.referrerId,
        type: 'cash',
        amount: cashAmount,
        currency: 'usd',
      });
      await this.creditCash(referral.referrerId, cashAmount);
    }
  }

  async creditProDays(userId: string, days: number): Promise<void> {
    const profileService = this.getProfileService();
    const profile = await profileService.getProfile(userId);
    if (!profile) return;

    const now = new Date();
    const currentEnd = profile.currentPeriodEnd && profile.currentPeriodEnd > now
      ? profile.currentPeriodEnd
      : now;
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

    await profileService.updateSubscription(userId, {
      subscription_status: 'active',
      current_period_end: newEnd.toISOString(),
    });
  }

  async creditCash(userId: string, amount: number): Promise<void> {
    await this.agentRepo.incrementWalletBalance(userId, amount);
  }

  async requestWithdrawal(
    userId: string,
    amount: number,
    paymentMethod: Record<string, unknown>,
  ): Promise<WithdrawalRequestEntity> {
    const wallet = await this.agentRepo.findWalletByUserId(userId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const minWithdrawal = await this.configRepo.getConfig('min_withdrawal_amount');
    if (amount < minWithdrawal) {
      throw new Error(`Minimum withdrawal amount is ${minWithdrawal}`);
    }
    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from wallet immediately (pending withdrawal)
    await this.agentRepo.incrementWalletBalance(userId, -amount);

    return this.agentRepo.createWithdrawal({
      walletId: wallet.id,
      userId,
      amount,
      paymentMethod,
    });
  }

  async approveWithdrawal(id: string, adminId: string): Promise<void> {
    await this.agentRepo.updateWithdrawal(id, {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    });
  }

  async sumRewardDaysByBeneficiary(userId: string): Promise<number> {
    return this.commissionRepo.sumByBeneficiary(userId, 'pro_days');
  }
}

let _commissionService: CommissionService | null = null;

export function getCommissionService(): CommissionService {
  if (!_commissionService) {
    _commissionService = new CommissionService();
  }
  return _commissionService;
}
