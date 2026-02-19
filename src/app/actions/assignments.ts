'use server';

import { z } from 'zod';
import { ForbiddenError } from '@/lib/errors';
import { getAssignmentService } from '@/lib/services/AssignmentService';
import { requireAnyAdmin, requireAssignmentAccess } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ── Schemas ──

const createEmptySchema = z.object({
  title: z.string().min(1).max(255),
  universityId: z.string().uuid(),
  courseId: z.string().uuid(),
});

const addItemSchema = z.object({
  assignmentId: z.string().uuid(),
  type: z.string().max(50).optional().default(''),
  content: z.string().min(1),
  referenceAnswer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  points: z.number().min(0).optional().default(0),
  difficulty: z.string().max(50).optional().default(''),
});

// ── Actions ──

export async function createEmptyAssignment(
  input: z.infer<typeof createEmptySchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user } = await requireAnyAdmin();
    const parsed = createEmptySchema.parse(input);

    // Look up university short name and course code for denormalized fields
    const { getCourseRepository } = await import('@/lib/repositories/CourseRepository');
    const courseRepo = getCourseRepository();
    const course = await courseRepo.findById(parsed.courseId);

    const { getUniversityRepository } = await import('@/lib/repositories/UniversityRepository');
    const uniRepo = getUniversityRepository();
    const university = await uniRepo.findById(parsed.universityId);

    const service = getAssignmentService();
    const id = await service.createEmpty(user.id, {
      title: parsed.title,
      school: university?.shortName ?? null,
      course: course?.code ?? null,
      courseId: parsed.courseId,
    });

    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: 'Admin access required' };
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input' };
    }
    console.error('createEmptyAssignment error:', error);
    return { success: false, error: 'Failed to create assignment' };
  }
}

export async function addAssignmentItem(
  input: z.infer<typeof addItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = addItemSchema.parse(input);

    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    const item = await service.addItem(parsed.assignmentId, {
      type: parsed.type,
      content: parsed.content,
      referenceAnswer: parsed.referenceAnswer,
      explanation: parsed.explanation,
      points: parsed.points,
      difficulty: parsed.difficulty,
    });

    return { success: true, data: { id: item.id } };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { success: false, error: 'No access to this assignment' };
    }
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input' };
    }
    console.error('addAssignmentItem error:', error);
    return { success: false, error: 'Failed to add item' };
  }
}
