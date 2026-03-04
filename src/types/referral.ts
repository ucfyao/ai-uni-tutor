/**
 * Domain Models - Referral & Campus Agent System
 *
 * Type definitions for the referral program and campus agent system.
 * Domain entities use camelCase and Date types.
 */

// ── String literal types ──────────────────────────────────────────────

export type ReferralCodeType = 'user' | 'agent';

export type ReferralStatus = 'registered' | 'paid' | 'rewarded';

export type CommissionType = 'pro_days' | 'cash';

export type CommissionStatus = 'pending' | 'credited' | 'paid_out' | 'clawed_back';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

// ── Domain entities ───────────────────────────────────────────────────

export interface ReferralCodeEntity {
  id: string;
  userId: string;
  code: string;
  type: ReferralCodeType;
  stripePromotionCodeId: string | null;
  institutionId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralEntity {
  id: string;
  referrerId: string;
  refereeId: string;
  referralCodeId: string;
  status: ReferralStatus;
  stripeSubscriptionId: string | null;
  createdAt: Date;
}

export interface CommissionEntity {
  id: string;
  referralId: string;
  beneficiaryId: string;
  type: CommissionType;
  amount: number;
  currency: string;
  status: CommissionStatus;
  stripeInvoiceId: string | null;
  createdAt: Date;
}

export interface AgentApplicationEntity {
  id: string;
  userId: string;
  fullName: string;
  university: string;
  contactInfo: Record<string, unknown>;
  motivation: string;
  status: ApplicationStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface AgentWalletEntity {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  updatedAt: Date;
}

export interface WithdrawalRequestEntity {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  paymentMethod: Record<string, unknown>;
  status: WithdrawalStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

// ── Config ────────────────────────────────────────────────────────────

export interface ReferralConfigMap {
  user_reward_days: number;
  agent_commission_rate: number;
  min_withdrawal_amount: number;
  referee_discount_percent: number;
}

// ── Derived / aggregate types ─────────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number;
  paidReferrals: number;
  rewardedReferrals: number;
  totalRewardDays: number;
}

export interface AgentDashboardStats {
  totalReferrals: number;
  paidReferrals: number;
  totalEarned: number;
  walletBalance: number;
  pendingWithdrawals: number;
}

export interface ReferralWithReferee {
  id: string;
  refereeId: string;
  refereeName: string | null;
  refereeEmail: string | null;
  status: ReferralStatus;
  createdAt: Date;
}
