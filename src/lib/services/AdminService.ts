/**
 * Admin Service
 *
 * Business logic for admin role management and course permission assignment.
 */

import type { CourseEntity } from '@/lib/domain/models/Course';
import type { ProfileEntity, UserRole } from '@/lib/domain/models/Profile';
import { ForbiddenError } from '@/lib/errors';
import { getProfileRepository } from '@/lib/repositories';
import { getAdminRepository } from '@/lib/repositories/AdminRepository';
import type { AdminRepository } from '@/lib/repositories/AdminRepository';
import type { ProfileRepository } from '@/lib/repositories/ProfileRepository';

export class AdminService {
  private readonly adminRepo: AdminRepository;
  private readonly profileRepo: ProfileRepository;

  constructor(adminRepo?: AdminRepository, profileRepo?: ProfileRepository) {
    this.adminRepo = adminRepo ?? getAdminRepository();
    this.profileRepo = profileRepo ?? getProfileRepository();
  }

  async promoteToAdmin(userId: string): Promise<void> {
    await this.profileRepo.updateRole(userId, 'admin');
  }

  /** Demote admin to user. Order: remove courses first, then change role.
   *  Mid-state (admin with no courses) is safe — no excess permissions. */
  async demoteToUser(adminId: string, requesterId: string): Promise<void> {
    if (adminId === requesterId) {
      throw new ForbiddenError('Cannot demote yourself');
    }
    await this.adminRepo.removeAllCourses(adminId);
    await this.profileRepo.updateRole(adminId, 'user');
  }

  async assignCourses(adminId: string, courseIds: string[], assignedBy: string): Promise<void> {
    for (const courseId of courseIds) {
      await this.adminRepo.assignCourse(adminId, courseId, assignedBy);
    }
  }

  async removeCourses(adminId: string, courseIds: string[]): Promise<void> {
    for (const courseId of courseIds) {
      await this.adminRepo.removeCourse(adminId, courseId);
    }
  }

  async setCourses(adminId: string, courseIds: string[], assignedBy: string): Promise<void> {
    const currentIds = await this.adminRepo.getAssignedCourseIds(adminId);
    const toAdd = courseIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !courseIds.includes(id));

    for (const id of toRemove) {
      await this.adminRepo.removeCourse(adminId, id);
    }
    for (const id of toAdd) {
      await this.adminRepo.assignCourse(adminId, id, assignedBy);
    }
  }

  async getAssignedCourses(adminId: string): Promise<CourseEntity[]> {
    return this.adminRepo.getAssignedCourses(adminId);
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    return this.adminRepo.getAssignedCourseIds(adminId);
  }

  async listAdmins(): Promise<ProfileEntity[]> {
    return this.profileRepo.findByRole('admin');
  }

  async searchUsers(search?: string): Promise<ProfileEntity[]> {
    return this.profileRepo.searchUsers(search);
  }

  async getAdminWithCourses(
    adminId: string,
  ): Promise<{ profile: ProfileEntity; courses: CourseEntity[] } | null> {
    const profile = await this.profileRepo.findById(adminId);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return null;
    const courses = await this.adminRepo.getAssignedCourses(adminId);
    return { profile, courses };
  }

  /** Get available course IDs for an admin.
   *  super_admin: returns all course IDs from courses table.
   *  admin: returns assigned course IDs only. */
  async getAvailableCourseIds(userId: string, role: UserRole): Promise<string[]> {
    if (role === 'super_admin') {
      const { getCourseService } = await import('@/lib/services/CourseService');
      const courses = await getCourseService().getAllCourses();
      return courses.map((c) => c.id);
    }
    return this.adminRepo.getAssignedCourseIds(userId);
  }
}

let _adminService: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!_adminService) {
    _adminService = new AdminService();
  }
  return _adminService;
}
