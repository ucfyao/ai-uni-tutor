/**
 * Repository Interface - Assignment Repository
 */

import type {
  AssignmentEntity,
  AssignmentItemEntity,
  CreateAssignmentItemDTO,
  MatchedAssignmentItem,
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
  findAllForAdmin(): Promise<AssignmentEntity[]>;
  findByCourseIds(courseIds: string[]): Promise<AssignmentEntity[]>;
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
      warnings?: string[];
    }>,
  ): Promise<void>;

  getMaxOrderNum(assignmentId: string): Promise<number>;
  insertSingleItem(
    assignmentId: string,
    data: {
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
      embedding?: number[] | null;
      warnings?: string[];
    },
  ): Promise<AssignmentItemEntity>;

  findItemById(itemId: string): Promise<AssignmentItemEntity | null>;
  findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]>;
  searchItemsByEmbedding(
    embedding: number[],
    matchCount: number,
    courseId?: string | null,
  ): Promise<MatchedAssignmentItem[]>;
  updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  deleteItemsByIds(ids: string[]): Promise<void>;

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
