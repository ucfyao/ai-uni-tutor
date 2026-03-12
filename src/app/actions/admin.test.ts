import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
const mockRequireSuperAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  requireSuperAdmin: () => mockRequireSuperAdmin(),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockProfileRepo = { findById: vi.fn() };
vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => mockProfileRepo,
}));

const mockAdminService = {
  getAssignedCourseIds: vi.fn(),
  setCourses: vi.fn(),
  updateUserName: vi.fn(),
  updateUserRole: vi.fn(),
  disableUser: vi.fn(),
  listByRole: vi.fn(),
  searchUsers: vi.fn(),
};
vi.mock('@/lib/services/AdminService', () => ({
  getAdminService: () => mockAdminService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------

const { getAdminCourseIds, setAdminCourses, updateUser, disableUser, listAllUsers } =
  await import('./admin');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee', email: 'admin@test.com' };
const OTHER_USER_ID = '11111111-2222-3333-8444-555555555555';

function setupSuperAdmin() {
  mockRequireSuperAdmin.mockResolvedValue(MOCK_USER);
}

function setupUnauthorized() {
  mockRequireSuperAdmin.mockRejectedValue(new UnauthorizedError());
}

function setupForbidden() {
  mockRequireSuperAdmin.mockRejectedValue(new ForbiddenError('Super admin access required'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuperAdmin();
  });

  // =========================================================================
  // getAdminCourseIds
  // =========================================================================
  describe('getAdminCourseIds', () => {
    it('should return course IDs for a valid admin', async () => {
      const courseIds = ['c1111111-1111-1111-8111-111111111111'];
      mockAdminService.getAssignedCourseIds.mockResolvedValue(courseIds);

      const result = await getAdminCourseIds({ adminId: OTHER_USER_ID });

      expect(result).toEqual({ success: true, data: courseIds });
      expect(mockAdminService.getAssignedCourseIds).toHaveBeenCalledWith(OTHER_USER_ID);
    });

    it('should return UNAUTHORIZED when user is not logged in', async () => {
      setupUnauthorized();

      const result = await getAdminCourseIds({ adminId: OTHER_USER_ID });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return FORBIDDEN when user is not super_admin', async () => {
      setupForbidden();

      const result = await getAdminCourseIds({ adminId: OTHER_USER_ID });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should return error for invalid adminId (not UUID)', async () => {
      const result = await getAdminCourseIds({ adminId: 'not-a-uuid' });

      expect(result.success).toBe(false);
      expect(mockAdminService.getAssignedCourseIds).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockAdminService.getAssignedCourseIds.mockRejectedValue(new Error('DB error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getAdminCourseIds({ adminId: OTHER_USER_ID });

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // setAdminCourses
  // =========================================================================
  describe('setAdminCourses', () => {
    const validInput = {
      adminId: OTHER_USER_ID,
      courseIds: ['c1111111-1111-1111-8111-111111111111'],
    };

    it('should set courses and revalidate path', async () => {
      mockAdminService.setCourses.mockResolvedValue(undefined);

      const result = await setAdminCourses(validInput);

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockAdminService.setCourses).toHaveBeenCalledWith(
        OTHER_USER_ID,
        validInput.courseIds,
        MOCK_USER.id,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users');
    });

    it('should return UNAUTHORIZED when user is not logged in', async () => {
      setupUnauthorized();

      const result = await setAdminCourses(validInput);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return error for invalid input', async () => {
      const result = await setAdminCourses({ adminId: 'bad', courseIds: ['bad'] });

      expect(result.success).toBe(false);
      expect(mockAdminService.setCourses).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockAdminService.setCourses.mockRejectedValue(new Error('DB error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await setAdminCourses(validInput);

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // updateUser
  // =========================================================================
  describe('updateUser', () => {
    it('should update user name', async () => {
      mockAdminService.updateUserName.mockResolvedValue(undefined);

      const result = await updateUser({ userId: OTHER_USER_ID, fullName: 'New Name' });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockAdminService.updateUserName).toHaveBeenCalledWith(OTHER_USER_ID, 'New Name');
      expect(mockAdminService.updateUserRole).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users');
    });

    it('should update user role', async () => {
      mockAdminService.updateUserRole.mockResolvedValue(undefined);

      const result = await updateUser({ userId: OTHER_USER_ID, role: 'admin' });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        OTHER_USER_ID,
        'admin',
        MOCK_USER.id,
      );
      expect(mockAdminService.updateUserName).not.toHaveBeenCalled();
    });

    it('should update both name and role', async () => {
      mockAdminService.updateUserName.mockResolvedValue(undefined);
      mockAdminService.updateUserRole.mockResolvedValue(undefined);

      const result = await updateUser({
        userId: OTHER_USER_ID,
        fullName: 'New Name',
        role: 'admin',
      });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockAdminService.updateUserName).toHaveBeenCalled();
      expect(mockAdminService.updateUserRole).toHaveBeenCalled();
    });

    it('should prevent modifying own account', async () => {
      const result = await updateUser({ userId: MOCK_USER.id, fullName: 'Sneaky' });

      expect(result).toEqual({ success: false, error: 'Cannot modify your own account' });
      expect(mockAdminService.updateUserName).not.toHaveBeenCalled();
    });

    it('should return UNAUTHORIZED when not logged in', async () => {
      setupUnauthorized();

      const result = await updateUser({ userId: OTHER_USER_ID, fullName: 'Name' });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return error for invalid userId', async () => {
      const result = await updateUser({ userId: 'not-uuid', fullName: 'Name' });

      expect(result.success).toBe(false);
      expect(mockAdminService.updateUserName).not.toHaveBeenCalled();
    });

    it('should return error for invalid role value', async () => {
      const result = await updateUser({ userId: OTHER_USER_ID, role: 'super_admin' as never });

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // disableUser
  // =========================================================================
  describe('disableUser', () => {
    it('should disable a user', async () => {
      mockAdminService.disableUser.mockResolvedValue(undefined);

      const result = await disableUser({ userId: OTHER_USER_ID });

      expect(result).toEqual({ success: true, data: undefined });
      expect(mockAdminService.disableUser).toHaveBeenCalledWith(OTHER_USER_ID, MOCK_USER.id);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users');
    });

    it('should prevent disabling yourself', async () => {
      const result = await disableUser({ userId: MOCK_USER.id });

      expect(result).toEqual({ success: false, error: 'Cannot disable yourself' });
      expect(mockAdminService.disableUser).not.toHaveBeenCalled();
    });

    it('should return UNAUTHORIZED when not logged in', async () => {
      setupUnauthorized();

      const result = await disableUser({ userId: OTHER_USER_ID });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return error for invalid userId', async () => {
      const result = await disableUser({ userId: 'bad-uuid' });

      expect(result.success).toBe(false);
      expect(mockAdminService.disableUser).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockAdminService.disableUser.mockRejectedValue(new Error('Failed'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await disableUser({ userId: OTHER_USER_ID });

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // listAllUsers
  // =========================================================================
  describe('listAllUsers', () => {
    const mockUsers = [
      {
        id: OTHER_USER_ID,
        fullName: 'Test User',
        email: 'user@test.com',
        role: 'user',
        createdAt: new Date('2024-01-01'),
        isActive: true,
      },
    ];

    it('should list users by role', async () => {
      mockAdminService.listByRole.mockResolvedValue(mockUsers);

      const result = await listAllUsers({ role: 'user' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual({
          id: OTHER_USER_ID,
          fullName: 'Test User',
          email: 'user@test.com',
          role: 'user',
          createdAt: '2024-01-01T00:00:00.000Z',
          isActive: true,
        });
      }
      expect(mockAdminService.listByRole).toHaveBeenCalledWith('user');
    });

    it('should search users by term', async () => {
      mockAdminService.searchUsers.mockResolvedValue(mockUsers);

      const result = await listAllUsers({ search: 'test' });

      expect(result.success).toBe(true);
      expect(mockAdminService.searchUsers).toHaveBeenCalledWith('test');
    });

    it('should list all users when no filters provided', async () => {
      mockAdminService.searchUsers.mockResolvedValue(mockUsers);

      const result = await listAllUsers({});

      expect(result.success).toBe(true);
      expect(mockAdminService.searchUsers).toHaveBeenCalledWith();
    });

    it('should prioritize role filter over search', async () => {
      mockAdminService.listByRole.mockResolvedValue(mockUsers);

      await listAllUsers({ role: 'admin', search: 'test' });

      expect(mockAdminService.listByRole).toHaveBeenCalledWith('admin');
      expect(mockAdminService.searchUsers).not.toHaveBeenCalled();
    });

    it('should return UNAUTHORIZED when not logged in', async () => {
      setupUnauthorized();

      const result = await listAllUsers({});

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return FORBIDDEN for non-super-admin', async () => {
      setupForbidden();

      const result = await listAllUsers({});

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should handle service errors', async () => {
      mockAdminService.searchUsers.mockRejectedValue(new Error('DB error'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await listAllUsers({});

      expect(result.success).toBe(false);
    });
  });
});
