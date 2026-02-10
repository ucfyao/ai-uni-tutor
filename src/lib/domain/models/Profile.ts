/**
 * Domain Models - Profile Entity
 *
 * Represents a user profile in the domain layer.
 * Independent of database implementation.
 */

export interface ProfileEntity {
  id: string;
  fullName: string | null;
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileDTO {
  fullName?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: Date;
}

export interface SubscriptionInfo {
  status: string | null;
  isPro: boolean;
  currentPeriodEnd: Date | null;
}
