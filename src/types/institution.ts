/**
 * Domain Models - Institution Management System
 *
 * Type definitions for institutions, members, and invites.
 */

export type InstitutionMemberStatus = 'active' | 'suspended' | 'removed';

export interface InstitutionEntity {
  id: string;
  name: string;
  adminId: string;
  commissionRate: number;
  contactInfo: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstitutionMemberEntity {
  id: string;
  institutionId: string;
  userId: string;
  status: InstitutionMemberStatus;
  invitedAt: Date;
  joinedAt: Date | null;
}

export interface InstitutionInviteEntity {
  id: string;
  institutionId: string;
  inviteCode: string;
  createdBy: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface InstitutionDashboardStats {
  totalAmbassadors: number;
  teamReferrals: number;
  paidConversions: number;
  totalIncome: number;
  walletBalance: number;
  pendingWithdrawals: number;
}

export interface AmbassadorStats {
  userId: string;
  fullName: string | null;
  email: string | null;
  referralCount: number;
  paidCount: number;
  status: InstitutionMemberStatus;
  joinedAt: Date | null;
}
