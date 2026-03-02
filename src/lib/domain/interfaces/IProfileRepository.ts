/**
 * Repository Interface - Profile Repository
 *
 * Defines the contract for profile data access operations.
 */

import type { ProfileEntity, SubscriptionInfo, UpdateProfileDTO } from '@/types/profile';

export interface IProfileRepository {
  findById(id: string): Promise<ProfileEntity | null>;
  update(id: string, data: UpdateProfileDTO): Promise<void>;
  getSubscriptionInfo(userId: string): Promise<SubscriptionInfo>;
}
