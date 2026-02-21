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
    const { getCourseService } = await import('@/lib/services/CourseService');
    const courseService = getCourseService();
    const course = await courseService.getCourseById(parsed.courseId);
    const university = await courseService.getUniversityById(parsed.universityId);

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

    // Batch delete in a single query
    if (parsed.deletedIds.length > 0) {
      await service.deleteItemsByIds(parsed.deletedIds);
    }

    // Parallel content updates
    if (parsed.updates.length > 0) {
      await Promise.all(
        parsed.updates.map((update) => {
          const meta = update.metadata;
          return service.updateItem(update.id, {
            content: update.content,
            referenceAnswer: (meta.referenceAnswer as string) || undefined,
            explanation: (meta.explanation as string) || undefined,
            points: meta.points != null ? Number(meta.points) : undefined,
            difficulty: (meta.difficulty as string) || undefined,
            type: (meta.type as string) || undefined,
            metadata: meta,
          });
        }),
      );

      // Re-validate edited items and update warnings
      await Promise.all(
        parsed.updates.map((update) => {
          const meta = update.metadata;
          const refAnswer = (meta.referenceAnswer as string) || '';
          const newWarnings = service.validateItemContent(update.content, refAnswer);
          return service.updateItem(update.id, { warnings: newWarnings });
        }),
      );

      // Batch embedding generation, then parallel DB updates
      try {
        const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
        const contents = parsed.updates.map((u) => u.content);
        const embeddings = await generateEmbeddingBatch(contents);
        await Promise.all(
          parsed.updates.map((update, i) => service.updateItemEmbedding(update.id, embeddings[i])),
        );
      } catch (e) {
        console.error('Re-embedding failed for items:', e);
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
 * Save assignment item changes (3-arg convenience wrapper).
 * Delegates to updateAssignmentItems internally.
 */
export async function saveAssignmentChanges(
  assignmentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<ActionResult<null>> {
  return updateAssignmentItems({ assignmentId, updates, deletedIds });
}

const assignmentIdSchema = z.string().uuid();

export async function deleteAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const id = assignmentIdSchema.parse(assignmentId);
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(id, user.id, role);
    const service = getAssignmentService();
    await service.deleteAssignment(id);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid assignment ID' };
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('deleteAssignment error:', error);
    return { success: false, error: 'Failed to delete assignment' };
  }
}

export async function publishAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const id = assignmentIdSchema.parse(assignmentId);
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(id, user.id, role);
    const service = getAssignmentService();
    await service.publish(id);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid assignment ID' };
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('publishAssignment error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to publish' };
  }
}

export async function unpublishAssignment(assignmentId: string): Promise<ActionResult<null>> {
  try {
    const id = assignmentIdSchema.parse(assignmentId);
    const { user, role } = await requireAnyAdmin();
    await requireAssignmentAccess(id, user.id, role);
    const service = getAssignmentService();
    await service.unpublish(id);
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid assignment ID' };
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('unpublishAssignment error:', error);
    return { success: false, error: 'Failed to unpublish' };
  }
}

// ── Merge & Split ──

const mergeSchema = z.object({
  assignmentId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(2),
});

const splitSchema = z.object({
  assignmentId: z.string().uuid(),
  itemId: z.string().uuid(),
  splitContent: z.tuple([z.string().min(1), z.string().min(1)]),
});

export async function mergeAssignmentItems(
  input: z.infer<typeof mergeSchema>,
): Promise<ActionResult<{ keepId: string }>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = mergeSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    const keepId = await service.mergeItems(parsed.assignmentId, parsed.itemIds);
    return { success: true, data: { keepId } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('mergeAssignmentItems error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to merge items',
    };
  }
}

export async function splitAssignmentItem(
  input: z.infer<typeof splitSchema>,
): Promise<ActionResult<{ firstId: string; secondId: string }>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = splitSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    const result = await service.splitItem(parsed.assignmentId, parsed.itemId, parsed.splitContent);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('splitAssignmentItem error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to split item',
    };
  }
}

// ── Assignment Stats ──

export async function fetchAssignmentStats(
  assignmentIds: string[],
): Promise<
  ActionResult<Record<string, { itemCount: number; withAnswer: number; warningCount: number }>>
> {
  try {
    await requireAnyAdmin();
    const service = getAssignmentService();
    const stats = await service.getAssignmentStats(assignmentIds);
    const result: Record<string, { itemCount: number; withAnswer: number; warningCount: number }> =
      {};
    for (const [id, stat] of stats) {
      result[id] = stat;
    }
    return { success: true, data: result };
  } catch (error) {
    console.error('fetchAssignmentStats error:', error);
    return { success: false, error: 'Failed to fetch stats' };
  }
}

// ── Batch Answer Matching ──

const batchUpdateAnswersSchema = z.object({
  assignmentId: z.string().uuid(),
  matches: z.array(
    z.object({
      itemId: z.string().uuid(),
      referenceAnswer: z.string(),
    }),
  ),
});

export async function batchUpdateAnswers(
  input: z.infer<typeof batchUpdateAnswersSchema>,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = batchUpdateAnswersSchema.parse(input);
    await requireAssignmentAccess(parsed.assignmentId, user.id, role);

    const service = getAssignmentService();
    const itemIds = parsed.matches.map((m) => m.itemId);
    if (itemIds.length > 0) {
      const valid = await service.verifyItemsBelongToAssignment(itemIds, parsed.assignmentId);
      if (!valid) return { success: false, error: 'Invalid item IDs' };
    }

    await service.batchUpdateAnswers(parsed.matches);
    return { success: true, data: { updated: parsed.matches.length } };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('batchUpdateAnswers error:', error);
    return { success: false, error: 'Failed to update answers' };
  }
}
