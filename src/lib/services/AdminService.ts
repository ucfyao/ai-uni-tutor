/**
 * Admin Service
 *
 * Business logic for admin role management and course permission assignment.
 */

import type { CourseEntity } from '@/lib/domain/models/Course';
import { getAdminRepository } from '@/lib/repositories/AdminRepository';
import type { AdminRepository } from '@/lib/repositories/AdminRepository';

export class AdminService {
  private readonly adminRepo: AdminRepository;

  constructor(adminRepo?: AdminRepository) {
    this.adminRepo = adminRepo ?? getAdminRepository();
  }

  async getAssignedCourses(adminId: string): Promise<CourseEntity[]> {
    return this.adminRepo.getAssignedCourses(adminId);
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    return this.adminRepo.getAssignedCourseIds(adminId);
  }
}

let _adminService: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!_adminService) {
    _adminService = new AdminService();
  }
  return _adminService;
}
