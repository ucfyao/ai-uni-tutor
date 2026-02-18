'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ProfileEntity } from '@/lib/domain/models/Profile';
import { mapError } from '@/lib/errors';
import { getAdminService } from '@/lib/services/AdminService';
import { requireSuperAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ============================================================================
// Types
// ============================================================================

export interface AdminUserItem {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
  isActive: boolean;
}

// ============================================================================
// Schemas
// ============================================================================

const searchSchema = z.object({
  search: z.string().max(100).optional(),
});

const promoteSchema = z.object({
  userId: z.string().uuid(),
});

const demoteSchema = z.object({
  userId: z.string().uuid(),
});

const setCoursesSchema = z.object({
  adminId: z.string().uuid(),
  courseIds: z.array(z.string().uuid()),
});

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['user', 'admin']).optional(),
});

const disableUserSchema = z.object({
  userId: z.string().uuid(),
});

const listAllUsersSchema = z.object({
  search: z.string().max(100).optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
});

// ============================================================================
// Actions
// ============================================================================

export async function searchUsers(input: unknown): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const parsed = searchSchema.parse(input);
    const service = getAdminService();
    const users = await service.searchUsers(parsed.search);
    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function listAdmins(): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const service = getAdminService();
    const admins = await service.listAdmins();
    return {
      success: true,
      data: admins.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

const getAdminCourseIdsSchema = z.object({
  adminId: z.string().uuid(),
});

export async function getAdminCourseIds(input: unknown): Promise<ActionResult<string[]>> {
  try {
    await requireSuperAdmin();
    const parsed = getAdminCourseIdsSchema.parse(input);
    const service = getAdminService();
    const courseIds = await service.getAssignedCourseIds(parsed.adminId);
    return { success: true, data: courseIds };
  } catch (error) {
    return mapError(error);
  }
}

export async function promoteToAdmin(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = promoteSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot modify your own role' };
    }
    const service = getAdminService();
    await service.promoteToAdmin(parsed.userId);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function demoteToUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = demoteSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot demote yourself' };
    }
    const service = getAdminService();
    await service.demoteToUser(parsed.userId, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function setAdminCourses(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = setCoursesSchema.parse(input);
    const service = getAdminService();
    await service.setCourses(parsed.adminId, parsed.courseIds, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = updateUserSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot modify your own account' };
    }
    const service = getAdminService();
    if (parsed.fullName !== undefined) {
      await service.updateUserName(parsed.userId, parsed.fullName);
    }
    if (parsed.role !== undefined) {
      await service.updateUserRole(parsed.userId, parsed.role, user.id);
    }
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function disableUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = disableUserSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot disable yourself' };
    }
    const service = getAdminService();
    await service.disableUser(parsed.userId, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function listAllUsers(input: unknown): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const parsed = listAllUsersSchema.parse(input);
    const service = getAdminService();
    let users: ProfileEntity[];
    if (parsed.role) {
      users = await service.listByRole(parsed.role);
    } else if (parsed.search) {
      users = await service.searchUsers(parsed.search);
    } else {
      users = await service.searchUsers();
    }
    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isActive: u.isActive,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}
