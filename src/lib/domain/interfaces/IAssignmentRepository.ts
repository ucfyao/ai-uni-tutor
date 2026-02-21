/**
 * Repository Interface - Assignment Repository
 */

import type {
  AssignmentEntity,
  AssignmentItemEntity,
  CreateAssignmentItemDTO,
} from '@/lib/domain/models/Assignment';

export interface IAssignmentRepository {
  create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    courseId?: string | null;
    status?: 'draft' | 'ready';
  }): Promise<string>;

  findById(id: string): Promise<AssignmentEntity | null>;
  findCourseId(id: string): Promise<string | null>;
  findAllForAdmin(courseIds?: string[]): Promise<AssignmentEntity[]>;
  updateStatus(id: string, status: 'draft' | 'ready'): Promise<void>;
  publish(id: string): Promise<void>;
  unpublish(id: string): Promise<void>;
  delete(id: string): Promise<void>;

  insertItems(
    items: Array<{
      assignmentId: string;
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
      embedding?: number[] | null;
    }>,
  ): Promise<void>;

  findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]>;
  updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;

  // New methods
  updateTitle(id: string, title: string): Promise<void>;
  bulkUpdateOrder(assignmentId: string, orderedIds: string[]): Promise<void>;
  findItemsByAssignmentIdWithEmbeddings(
    assignmentId: string,
  ): Promise<(AssignmentItemEntity & { embedding: number[] | null })[]>;
  insertItemsAndReturn(items: CreateAssignmentItemDTO[]): Promise<{ id: string }[]>;
  deleteItemsByAssignmentId(assignmentId: string): Promise<void>;
  verifyItemsBelongToAssignment(itemIds: string[], assignmentId: string): Promise<boolean>;
  updateItemEmbedding(itemId: string, embedding: number[]): Promise<void>;
}
