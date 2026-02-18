'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
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
