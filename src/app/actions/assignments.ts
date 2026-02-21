'use server';

import { z } from 'zod';
import type { AssignmentItemEntity } from '@/lib/domain/models/Assignment';
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

// ── New schemas ──

const renameSchema = z.object({
  assignmentId: z.string().uuid(),
  title: z.string().min(1).max(255),
});

const fetchItemsSchema = z.object({
  assignmentId: z.string().uuid(),
});

const updateItemsSchema = z.object({
  assignmentId: z.string().uuid(),
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      content: z.string().min(1),
      metadata: z.record(z.string(), z.unknown()),
    }),
  ),
  deletedIds: z.array(z.string().uuid()),
});

// ── New actions ──

export async function renameAssignment(
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult<null>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = renameSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    await service.rename(parsed.assignmentId, parsed.title);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('renameAssignment error:', error);
    return { success: false, error: 'Failed to rename assignment' };
  }
}

export async function fetchAssignmentItems(
  input: z.infer<typeof fetchItemsSchema>,
): Promise<ActionResult<AssignmentItemEntity[]>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = fetchItemsSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    const items = await service.getItems(parsed.assignmentId);
    return { success: true, data: items };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('fetchAssignmentItems error:', error);
    return { success: false, error: 'Failed to fetch items' };
  }
}

export async function updateAssignmentItems(
  input: z.infer<typeof updateItemsSchema>,
): Promise<ActionResult<null>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = updateItemsSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();

    // IDOR verification
    const allIds = [...parsed.deletedIds, ...parsed.updates.map((u) => u.id)];
    if (allIds.length > 0) {
      const valid = await service.verifyItemsBelongToAssignment(allIds, parsed.assignmentId);
      if (!valid) return { success: false, error: 'Invalid item IDs' };
    }

    for (const id of parsed.deletedIds) {
      await service.deleteItem(id);
    }

    for (const update of parsed.updates) {
      const meta = update.metadata;
      await service.updateItem(update.id, {
        content: update.content,
        referenceAnswer: (meta.referenceAnswer as string) || undefined,
        explanation: (meta.explanation as string) || undefined,
        points: meta.points != null ? Number(meta.points) : undefined,
        difficulty: (meta.difficulty as string) || undefined,
        type: (meta.type as string) || undefined,
        metadata: meta,
      });
      try {
        const { generateEmbeddingWithRetry } = await import('@/lib/rag/embedding');
        const embedding = await generateEmbeddingWithRetry(update.content);
        await service.updateItemEmbedding(update.id, embedding);
      } catch (e) {
        console.error('Re-embedding failed for item:', update.id, e);
      }
    }

    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('updateAssignmentItems error:', error);
    return { success: false, error: 'Failed to update items' };
  }
}

/**
 * Save assignment item changes (3-arg signature, { status, message } return).
 * Delegates to updateAssignmentItems internally.
 */
export async function saveAssignmentChanges(
  assignmentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const result = await updateAssignmentItems({ assignmentId, updates, deletedIds });
  if (result.success) return { status: 'success', message: 'Changes saved' };
  return { status: 'error', message: result.error ?? 'Failed to save changes' };
}

export async function deleteAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(assignmentId, user.id, role);
    const service = getAssignmentService();
    await service.deleteAssignment(assignmentId);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('deleteAssignment error:', error);
    return { success: false, error: 'Failed to delete assignment' };
  }
}

export async function publishAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(assignmentId, user.id, role);
    const service = getAssignmentService();
    await service.publish(assignmentId);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('publishAssignment error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to publish' };
  }
}

export async function unpublishAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(assignmentId, user.id, role);
    const service = getAssignmentService();
    await service.unpublish(assignmentId);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('unpublishAssignment error:', error);
    return { success: false, error: 'Failed to unpublish' };
  }
}
