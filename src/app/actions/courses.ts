'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getCourseService } from '@/lib/services/CourseService';
import { getCurrentUser, requireSuperAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ============================================================================
// Schemas
// ============================================================================

const createUniversitySchema = z.object({
  name: z.string().min(1).max(255),
  shortName: z.string().min(1).max(10),
  logoUrl: z.string().url().nullable().optional(),
});

const updateUniversitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  shortName: z.string().min(1).max(10).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

const createCourseSchema = z.object({
  universityId: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
});

const updateCourseSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
});

// ============================================================================
// Public reads (authenticated)
// ============================================================================

export interface UniversityListItem {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
}

export interface CourseListItem {
  id: string;
  universityId: string;
  code: string;
  name: string;
}

export async function fetchUniversities(): Promise<ActionResult<UniversityListItem[]>> {
  try {
    await getCurrentUser();
    const service = getCourseService();
    const entities = await service.getAllUniversities();
    return {
      success: true,
      data: entities.map((u) => ({
        id: u.id,
        name: u.name,
        shortName: u.shortName,
        logoUrl: u.logoUrl,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function fetchCourses(universityId?: string): Promise<ActionResult<CourseListItem[]>> {
  try {
    await getCurrentUser();
    const service = getCourseService();
    const entities = universityId
      ? await service.getCoursesByUniversity(universityId)
      : await service.getAllCourses();
    return {
      success: true,
      data: entities.map((c) => ({
        id: c.id,
        universityId: c.universityId,
        code: c.code,
        name: c.name,
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

// ============================================================================
// Admin mutations
// ============================================================================

export async function createUniversity(input: unknown): Promise<ActionResult<UniversityListItem>> {
  try {
    await requireSuperAdmin();
    const parsed = createUniversitySchema.parse(input);
    const service = getCourseService();
    const entity = await service.createUniversity(parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        logoUrl: entity.logoUrl,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateUniversity(
  id: string,
  input: unknown,
): Promise<ActionResult<UniversityListItem>> {
  try {
    await requireSuperAdmin();
    const parsed = updateUniversitySchema.parse(input);
    const service = getCourseService();
    const entity = await service.updateUniversity(id, parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        logoUrl: entity.logoUrl,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteUniversity(id: string): Promise<ActionResult<void>> {
  try {
    await requireSuperAdmin();
    const service = getCourseService();
    await service.deleteUniversity(id);
    revalidatePath('/admin/courses');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function createCourse(input: unknown): Promise<ActionResult<CourseListItem>> {
  try {
    await requireSuperAdmin();
    const parsed = createCourseSchema.parse(input);
    const service = getCourseService();
    const entity = await service.createCourse(parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        universityId: entity.universityId,
        code: entity.code,
        name: entity.name,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function updateCourse(
  id: string,
  input: unknown,
): Promise<ActionResult<CourseListItem>> {
  try {
    await requireSuperAdmin();
    const parsed = updateCourseSchema.parse(input);
    const service = getCourseService();
    const entity = await service.updateCourse(id, parsed);
    revalidatePath('/admin/courses');
    return {
      success: true,
      data: {
        id: entity.id,
        universityId: entity.universityId,
        code: entity.code,
        name: entity.name,
      },
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteCourse(id: string): Promise<ActionResult<void>> {
  try {
    await requireSuperAdmin();
    const service = getCourseService();
    await service.deleteCourse(id);
    revalidatePath('/admin/courses');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
