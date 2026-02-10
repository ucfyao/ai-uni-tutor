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
}

let _profileService: ProfileService | null = null;

export function getProfileService(): ProfileService {
  if (!_profileService) {
    _profileService = new ProfileService();
  }
  return _profileService;
}
