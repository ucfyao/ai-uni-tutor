/**
 * Profile Service
 *
 * Business logic layer for profile operations.
 * Uses ProfileRepository for data access.
 */

import type {
  ProfileEntity,
  SubscriptionInfo,
  UpdateProfileDTO,
} from '@/lib/domain/models/Profile';
import { getProfileRepository } from '@/lib/repositories';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';

export class ProfileService {
  private readonly profileRepo: ProfileRepository;

  constructor(profileRepo?: ProfileRepository) {
    this.profileRepo = profileRepo ?? getProfileRepository();
  }

  async getProfile(userId: string): Promise<ProfileEntity | null> {
    return this.profileRepo.findById(userId);
  }

  async getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
    return this.profileRepo.getSubscriptionInfo(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDTO): Promise<void> {
    await this.profileRepo.update(userId, dto);
  }

  async getStripeCustomerId(userId: string): Promise<string | null> {
    return this.profileRepo.getStripeCustomerId(userId);
  }

  async updateStripeCustomerId(userId: string, customerId: string): Promise<void> {
    await this.profileRepo.updateStripeCustomerId(userId, customerId);
  }

  async updateSubscription(
    userId: string,
    data: {
      stripe_subscription_id?: string | null;
      stripe_customer_id?: string;
      subscription_status: string;
      current_period_end?: string | null;
      stripe_price_id?: string | null;
    },
  ): Promise<void> {
    await this.profileRepo.updateSubscription(userId, data);
  }

  async updateSubscriptionBySubscriptionId(
    subscriptionId: string,
    data: {
      subscription_status: string;
      current_period_end?: string | null;
      stripe_price_id?: string | null;
    },
  ): Promise<void> {
    await this.profileRepo.updateSubscriptionBySubscriptionId(subscriptionId, data);
  }
}

let _profileService: ProfileService | null = null;

export function getProfileService(): ProfileService {
  if (!_profileService) {
    _profileService = new ProfileService();
  }
  return _profileService;
}
