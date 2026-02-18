import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseEntity } from '@/lib/domain/models/Course';
import type { ProfileEntity } from '@/lib/domain/models/Profile';
import { ForbiddenError } from '@/lib/errors';
import type { AdminRepository } from '@/lib/repositories/AdminRepository';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';
import { AdminService } from './AdminService';

// ---------- Mock repositories ----------

function createMockAdminRepo(): {
  [K in keyof AdminRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    assignCourse: vi.fn(),
    removeCourse: vi.fn(),
    removeAllCourses: vi.fn(),
    setCourses: vi.fn(),
    getAssignedCourses: vi.fn(),
    hasCourseAccess: vi.fn(),
    getAssignedCourseIds: vi.fn(),
  };
}

function createMockProfileRepo(): Pick<
  { [K in keyof ProfileRepository]: ReturnType<typeof vi.fn> },
  'findById' | 'findByRole' | 'searchUsers' | 'updateRole'
> {
  return {
    findById: vi.fn(),
    findByRole: vi.fn(),
    searchUsers: vi.fn(),
    updateRole: vi.fn(),
  };
}

// ---------- Test data ----------

const SUPER_ADMIN_ID = 'super-admin-123';
const ADMIN_ID = 'admin-456';
const USER_ID = 'user-789';

const ADMIN_PROFILE: ProfileEntity = {
  id: ADMIN_ID,
  fullName: 'Admin User',
  email: 'admin@test.com',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  role: 'admin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
};

const USER_PROFILE: ProfileEntity = {
  id: USER_ID,
  fullName: 'Regular User',
  email: 'user@test.com',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  subscriptionStatus: null,
  currentPeriodEnd: null,
  role: 'user',
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-06-01'),
};

const COURSE_A: CourseEntity = {
  id: 'course-a',
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to CS',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const COURSE_B: CourseEntity = {
  id: 'course-b',
  universityId: 'uni-1',
  code: 'CS201',
  name: 'Data Structures',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ---------- Tests ----------

describe('AdminService', () => {
  let service: AdminService;
  let adminRepo: ReturnType<typeof createMockAdminRepo>;
  let profileRepo: ReturnType<typeof createMockProfileRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    adminRepo = createMockAdminRepo();
    profileRepo = createMockProfileRepo();
    service = new AdminService(
      adminRepo as unknown as AdminRepository,
      profileRepo as unknown as ProfileRepository,
    );
  });

  // ==================== promoteToAdmin ====================

  describe('promoteToAdmin', () => {
    it('should update user role to admin', async () => {
      profileRepo.findById.mockResolvedValue(USER_PROFILE);
      profileRepo.updateRole.mockResolvedValue(undefined);

      await service.promoteToAdmin(USER_ID);

      expect(profileRepo.findById).toHaveBeenCalledWith(USER_ID);
      expect(profileRepo.updateRole).toHaveBeenCalledWith(USER_ID, 'admin');
    });

    it('should throw if user not found', async () => {
      profileRepo.findById.mockResolvedValue(null);

      await expect(service.promoteToAdmin('nonexistent')).rejects.toThrow(ForbiddenError);
    });

    it('should throw if user is already admin', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);

      await expect(service.promoteToAdmin(ADMIN_ID)).rejects.toThrow(
        "Cannot promote: user already has role 'admin'",
      );
    });
  });

  // ==================== demoteToUser ====================

  describe('demoteToUser', () => {
    it('should remove courses then update role', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.removeAllCourses.mockResolvedValue(undefined);
      profileRepo.updateRole.mockResolvedValue(undefined);

      await service.demoteToUser(ADMIN_ID, SUPER_ADMIN_ID);

      expect(profileRepo.findById).toHaveBeenCalledWith(ADMIN_ID);
      expect(adminRepo.removeAllCourses).toHaveBeenCalledWith(ADMIN_ID);
      expect(profileRepo.updateRole).toHaveBeenCalledWith(ADMIN_ID, 'user');
    });

    it('should call removeAllCourses before updateRole', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      const callOrder: string[] = [];
      adminRepo.removeAllCourses.mockImplementation(async () => {
        callOrder.push('removeAllCourses');
      });
      profileRepo.updateRole.mockImplementation(async () => {
        callOrder.push('updateRole');
      });

      await service.demoteToUser(ADMIN_ID, SUPER_ADMIN_ID);

      expect(callOrder).toEqual(['removeAllCourses', 'updateRole']);
    });

    it('should throw ForbiddenError when demoting self', async () => {
      await expect(service.demoteToUser(ADMIN_ID, ADMIN_ID)).rejects.toThrow(ForbiddenError);
      await expect(service.demoteToUser(ADMIN_ID, ADMIN_ID)).rejects.toThrow(
        'Cannot demote yourself',
      );
    });

    it('should throw if target user is not admin', async () => {
      profileRepo.findById.mockResolvedValue(USER_PROFILE);

      await expect(service.demoteToUser(USER_ID, SUPER_ADMIN_ID)).rejects.toThrow(
        "Cannot demote: user has role 'user', expected 'admin'",
      );
    });

    it('should throw if target user is super_admin', async () => {
      const superAdminProfile: ProfileEntity = {
        ...ADMIN_PROFILE,
        id: SUPER_ADMIN_ID,
        role: 'super_admin',
      };
      profileRepo.findById.mockResolvedValue(superAdminProfile);

      await expect(service.demoteToUser(SUPER_ADMIN_ID, 'other-admin')).rejects.toThrow(
        "Cannot demote: user has role 'super_admin', expected 'admin'",
      );
      expect(profileRepo.updateRole).not.toHaveBeenCalled();
      expect(adminRepo.removeAllCourses).not.toHaveBeenCalled();
    });
  });

  // ==================== assignCourses ====================

  describe('assignCourses', () => {
    it('should assign each course', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.assignCourse.mockResolvedValue(undefined);

      await service.assignCourses(ADMIN_ID, ['course-a', 'course-b'], SUPER_ADMIN_ID);

      expect(adminRepo.assignCourse).toHaveBeenCalledTimes(2);
      expect(adminRepo.assignCourse).toHaveBeenCalledWith(ADMIN_ID, 'course-a', SUPER_ADMIN_ID);
      expect(adminRepo.assignCourse).toHaveBeenCalledWith(ADMIN_ID, 'course-b', SUPER_ADMIN_ID);
    });

    it('should handle empty array', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);

      await service.assignCourses(ADMIN_ID, [], SUPER_ADMIN_ID);

      expect(adminRepo.assignCourse).not.toHaveBeenCalled();
    });

    it('should throw if target is not admin', async () => {
      profileRepo.findById.mockResolvedValue(USER_PROFILE);

      await expect(service.assignCourses(USER_ID, ['course-a'], SUPER_ADMIN_ID)).rejects.toThrow(
        'Target user is not an admin',
      );
    });
  });

  // ==================== removeCourses ====================

  describe('removeCourses', () => {
    it('should remove each course', async () => {
      adminRepo.removeCourse.mockResolvedValue(undefined);

      await service.removeCourses(ADMIN_ID, ['course-a', 'course-b']);

      expect(adminRepo.removeCourse).toHaveBeenCalledTimes(2);
      expect(adminRepo.removeCourse).toHaveBeenCalledWith(ADMIN_ID, 'course-a');
      expect(adminRepo.removeCourse).toHaveBeenCalledWith(ADMIN_ID, 'course-b');
    });
  });

  // ==================== setCourses ====================

  describe('setCourses', () => {
    it('should delegate to atomic repo.setCourses', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.setCourses.mockResolvedValue(undefined);

      await service.setCourses(ADMIN_ID, ['course-b', 'course-c'], SUPER_ADMIN_ID);

      expect(adminRepo.setCourses).toHaveBeenCalledWith(
        ADMIN_ID,
        ['course-b', 'course-c'],
        SUPER_ADMIN_ID,
      );
    });

    it('should handle setting to empty', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.setCourses.mockResolvedValue(undefined);

      await service.setCourses(ADMIN_ID, [], SUPER_ADMIN_ID);

      expect(adminRepo.setCourses).toHaveBeenCalledWith(ADMIN_ID, [], SUPER_ADMIN_ID);
    });

    it('should throw if target is not admin', async () => {
      profileRepo.findById.mockResolvedValue(USER_PROFILE);

      await expect(service.setCourses(USER_ID, ['course-a'], SUPER_ADMIN_ID)).rejects.toThrow(
        'Target user is not an admin',
      );
      expect(adminRepo.setCourses).not.toHaveBeenCalled();
    });

    it('should deduplicate courseIds before passing to repo', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.setCourses.mockResolvedValue(undefined);

      await service.setCourses(
        ADMIN_ID,
        ['course-a', 'course-b', 'course-a'],
        SUPER_ADMIN_ID,
      );

      expect(adminRepo.setCourses).toHaveBeenCalledWith(
        ADMIN_ID,
        ['course-a', 'course-b'],
        SUPER_ADMIN_ID,
      );
    });
  });

  // ==================== getAssignedCourses ====================

  describe('getAssignedCourses', () => {
    it('should delegate to admin repo', async () => {
      adminRepo.getAssignedCourses.mockResolvedValue([COURSE_A, COURSE_B]);

      const result = await service.getAssignedCourses(ADMIN_ID);

      expect(adminRepo.getAssignedCourses).toHaveBeenCalledWith(ADMIN_ID);
      expect(result).toEqual([COURSE_A, COURSE_B]);
    });
  });

  // ==================== getAssignedCourseIds ====================

  describe('getAssignedCourseIds', () => {
    it('should delegate to admin repo', async () => {
      adminRepo.getAssignedCourseIds.mockResolvedValue(['course-a', 'course-b']);

      const result = await service.getAssignedCourseIds(ADMIN_ID);

      expect(adminRepo.getAssignedCourseIds).toHaveBeenCalledWith(ADMIN_ID);
      expect(result).toEqual(['course-a', 'course-b']);
    });
  });

  // ==================== listAdmins ====================

  describe('listAdmins', () => {
    it('should fetch profiles with both admin and super_admin roles', async () => {
      const superAdminProfile: ProfileEntity = {
        ...ADMIN_PROFILE,
        id: SUPER_ADMIN_ID,
        role: 'super_admin',
        fullName: 'Super Admin',
      };
      profileRepo.findByRole.mockImplementation(async (role: string) => {
        if (role === 'admin') return [ADMIN_PROFILE];
        if (role === 'super_admin') return [superAdminProfile];
        return [];
      });

      const result = await service.listAdmins();

      expect(profileRepo.findByRole).toHaveBeenCalledWith('admin');
      expect(profileRepo.findByRole).toHaveBeenCalledWith('super_admin');
      // super_admins first, then admins
      expect(result).toEqual([superAdminProfile, ADMIN_PROFILE]);
    });
  });

  // ==================== searchUsers ====================

  describe('searchUsers', () => {
    it('should delegate search to profile repo', async () => {
      profileRepo.searchUsers.mockResolvedValue([USER_PROFILE, ADMIN_PROFILE]);

      const result = await service.searchUsers('test');

      expect(profileRepo.searchUsers).toHaveBeenCalledWith('test');
      expect(result).toHaveLength(2);
    });

    it('should handle undefined search term', async () => {
      profileRepo.searchUsers.mockResolvedValue([]);

      await service.searchUsers(undefined);

      expect(profileRepo.searchUsers).toHaveBeenCalledWith(undefined);
    });
  });

  // ==================== getAdminWithCourses ====================

  describe('getAdminWithCourses', () => {
    it('should return profile and courses for admin', async () => {
      profileRepo.findById.mockResolvedValue(ADMIN_PROFILE);
      adminRepo.getAssignedCourses.mockResolvedValue([COURSE_A]);

      const result = await service.getAdminWithCourses(ADMIN_ID);

      expect(result).toEqual({ profile: ADMIN_PROFILE, courses: [COURSE_A] });
    });

    it('should return null for non-admin user', async () => {
      profileRepo.findById.mockResolvedValue(USER_PROFILE);

      const result = await service.getAdminWithCourses(USER_ID);

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      profileRepo.findById.mockResolvedValue(null);

      const result = await service.getAdminWithCourses('nonexistent');

      expect(result).toBeNull();
    });
  });

});
