import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProfileEntity,
  SubscriptionInfo,
  UpdateProfileDTO,
} from '@/lib/domain/models/Profile';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';
import { ProfileService } from './ProfileService';

// ---------- Mock repository ----------

function createMockProfileRepo(): {
  [K in keyof ProfileRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findById: vi.fn(),
    update: vi.fn(),
    getSubscriptionInfo: vi.fn(),
    getStripeCustomerId: vi.fn(),
    updateStripeCustomerId: vi.fn(),
    updateSubscription: vi.fn(),
    updateSubscriptionBySubscriptionId: vi.fn(),
    findByRole: vi.fn(),
    searchUsers: vi.fn(),
    updateRole: vi.fn(),
  };
}

// ---------- Test data ----------

const USER_ID = 'user-abc-123';

const PROFILE: ProfileEntity = {
  id: USER_ID,
  fullName: 'Alice Test',
  email: 'alice@test.com',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  stripePriceId: 'price_123',
  subscriptionStatus: 'active',
  currentPeriodEnd: new Date('2026-03-01'),
  role: 'user',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
};

const SUBSCRIPTION_INFO: SubscriptionInfo = {
  status: 'active',
  isPro: true,
  currentPeriodEnd: new Date('2026-03-01'),
};

// ---------- Tests ----------

describe('ProfileService', () => {
  let service: ProfileService;
  let repo: ReturnType<typeof createMockProfileRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockProfileRepo();
    service = new ProfileService(repo as unknown as ProfileRepository);
  });

  // ==================== getProfile ====================

  describe('getProfile', () => {
    it('should return profile when found', async () => {
      repo.findById.mockResolvedValue(PROFILE);

      const result = await service.getProfile(USER_ID);

      expect(repo.findById).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(PROFILE);
    });

    it('should return null when profile not found', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await service.getProfile('nonexistent');

      expect(repo.findById).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ==================== getSubscriptionInfo ====================

  describe('getSubscriptionInfo', () => {
    it('should return subscription info from repo', async () => {
      repo.getSubscriptionInfo.mockResolvedValue(SUBSCRIPTION_INFO);

      const result = await service.getSubscriptionInfo(USER_ID);

      expect(repo.getSubscriptionInfo).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(SUBSCRIPTION_INFO);
    });

    it('should return free-tier info for user without subscription', async () => {
      const freeInfo: SubscriptionInfo = {
        status: null,
        isPro: false,
        currentPeriodEnd: null,
      };
      repo.getSubscriptionInfo.mockResolvedValue(freeInfo);

      const result = await service.getSubscriptionInfo(USER_ID);

      expect(result.isPro).toBe(false);
      expect(result.status).toBeNull();
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    it('should delegate update to repo', async () => {
      repo.update.mockResolvedValue(undefined);
      const dto: UpdateProfileDTO = { fullName: 'Bob Updated' };

      await service.updateProfile(USER_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(USER_ID, dto);
    });

    it('should pass through stripe fields', async () => {
      repo.update.mockResolvedValue(undefined);
      const dto: UpdateProfileDTO = {
        stripeCustomerId: 'cus_new',
        stripeSubscriptionId: 'sub_new',
        stripePriceId: 'price_new',
        subscriptionStatus: 'trialing',
        currentPeriodEnd: new Date('2026-12-31'),
      };

      await service.updateProfile(USER_ID, dto);

      expect(repo.update).toHaveBeenCalledWith(USER_ID, dto);
    });

    it('should propagate repo errors', async () => {
      repo.update.mockRejectedValue(new Error('DB failure'));

      await expect(service.updateProfile(USER_ID, { fullName: 'X' })).rejects.toThrow('DB failure');
    });
  });
});
