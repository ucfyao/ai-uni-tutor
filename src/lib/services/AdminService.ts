/**
 * Admin Service
 *
 * Business logic for admin role management and course permission assignment.
 */

import type { ProfileEntity } from '@/lib/domain/models/Profile';
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
    const profile = await this.profileRepo.findById(userId);
    if (!profile) throw new ForbiddenError('User not found');
    if (profile.role !== 'user') {
      throw new ForbiddenError(`Cannot promote: user already has role '${profile.role}'`);
    }
    await this.profileRepo.updateRole(userId, 'admin');
  }

  /** Demote admin to user. Order: remove courses first, then change role.
   *  Mid-state (admin with no courses) is safe — no excess permissions. */
  async demoteToUser(adminId: string, requesterId: string): Promise<void> {
    if (adminId === requesterId) {
      throw new ForbiddenError('Cannot demote yourself');
    }
    const profile = await this.profileRepo.findById(adminId);
    if (!profile) throw new ForbiddenError('User not found');
    if (profile.role !== 'admin') {
      throw new ForbiddenError(`Cannot demote: user has role '${profile.role}', expected 'admin'`);
    }
    await this.adminRepo.removeAllCourses(adminId);
    await this.profileRepo.updateRole(adminId, 'user');
  }

  /** Atomically replace admin's course assignments (all-or-nothing via DB RPC). */
  async setCourses(adminId: string, courseIds: string[], assignedBy: string): Promise<void> {
    const profile = await this.profileRepo.findById(adminId);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      throw new ForbiddenError('Target user is not an admin');
    }
    const uniqueIds = [...new Set(courseIds)];
    await this.adminRepo.setCourses(adminId, uniqueIds, assignedBy);
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    return this.adminRepo.getAssignedCourseIds(adminId);
  }

  async listAdmins(): Promise<ProfileEntity[]> {
    const [admins, superAdmins] = await Promise.all([
      this.profileRepo.findByRole('admin'),
      this.profileRepo.findByRole('super_admin'),
    ]);
    return [...superAdmins, ...admins];
  }

  async searchUsers(search?: string): Promise<ProfileEntity[]> {
    return this.profileRepo.searchUsers(search);
  }
}

let _adminService: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!_adminService) {
    _adminService = new AdminService();
  }
  return _adminService;
}
