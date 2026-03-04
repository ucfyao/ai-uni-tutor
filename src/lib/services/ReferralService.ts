/**
 * Referral Service
 *
 * Business logic for referral code generation, application, and stats.
 * Uses ReferralRepository for data access.
 */

import {
  getCommissionRepository,
  getReferralConfigRepository,
  getReferralRepository,
} from '@/lib/repositories';
import type { CommissionRepository } from '@/lib/repositories/CommissionRepository';
import type { ReferralConfigRepository } from '@/lib/repositories/ReferralConfigRepository';
import type { ReferralRepository } from '@/lib/repositories/ReferralRepository';
import { getStripe } from '@/lib/stripe';
import type {
  ReferralCodeEntity,
  ReferralCodeType,
  ReferralStats,
  ReferralWithReferee,
} from '@/types/referral';

export class ReferralService {
  private readonly referralRepo: ReferralRepository;
  private readonly configRepo: ReferralConfigRepository;
  private readonly commissionRepo: CommissionRepository;

  constructor(
    referralRepo?: ReferralRepository,
    configRepo?: ReferralConfigRepository,
    commissionRepo?: CommissionRepository,
  ) {
    this.referralRepo = referralRepo ?? getReferralRepository();
    this.configRepo = configRepo ?? getReferralConfigRepository();
    this.commissionRepo = commissionRepo ?? getCommissionRepository();
  }

  async generateCode(userId: string, type: ReferralCodeType): Promise<ReferralCodeEntity> {
    const base = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `UT-${base}`;

    let stripePromotionCodeId: string | undefined;
    try {
      const stripe = getStripe();
      const couponId = process.env.STRIPE_REFERRAL_COUPON_ID;
      if (couponId) {
        const promoCode = await stripe.promotionCodes.create({
          promotion: { coupon: couponId, type: 'coupon' },
          code,
          max_redemptions: 1,
          metadata: { userId, type },
        });
        stripePromotionCodeId = promoCode.id;
      }
    } catch (error) {
      console.error('Failed to create Stripe promotion code:', error);
    }

    return this.referralRepo.createCode({ userId, code, type, stripePromotionCodeId });
  }

  async applyReferralCode(refereeId: string, code: string): Promise<void> {
    const codeEntity = await this.referralRepo.findCodeByCode(code);
    if (!codeEntity || !codeEntity.isActive) return;
    if (codeEntity.userId === refereeId) return; // no self-referral
    const existing = await this.referralRepo.findReferralByRefereeId(refereeId);
    if (existing) return; // already referred
    await this.referralRepo.createReferral({
      referrerId: codeEntity.userId,
      refereeId,
      referralCodeId: codeEntity.id,
    });
  }

  async getMyReferrals(userId: string): Promise<ReferralWithReferee[]> {
    return this.referralRepo.findReferralsByReferrerId(userId);
  }

  async getReferralStats(userId: string): Promise<ReferralStats> {
    const counts = await this.referralRepo.countByReferrerId(userId);
    const totalRewardDays = await this.commissionRepo.sumByBeneficiary(userId, 'pro_days');
    return {
      totalReferrals: counts.total,
      paidReferrals: counts.paid,
      rewardedReferrals: counts.paid, // paid includes rewarded
      totalRewardDays,
    };
  }

  async getMyCodes(userId: string): Promise<ReferralCodeEntity[]> {
    return this.referralRepo.findCodesByUserId(userId);
  }

  async toggleCode(userId: string, codeId: string, isActive: boolean): Promise<void> {
    // Verify ownership before toggling
    const codes = await this.referralRepo.findCodesByUserId(userId);
    const owned = codes.find((c) => c.id === codeId);
    if (!owned) {
      throw new Error('Referral code not found or not owned by user');
    }
    await this.referralRepo.toggleCodeActive(codeId, isActive);
  }
}

let _referralService: ReferralService | null = null;

export function getReferralService(): ReferralService {
  if (!_referralService) {
    _referralService = new ReferralService();
  }
  return _referralService;
}
