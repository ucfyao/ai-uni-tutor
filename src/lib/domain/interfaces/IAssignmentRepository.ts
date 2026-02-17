/**
 * Repository Interface - Assignment Repository
 */

import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';

export interface IAssignmentRepository {
  create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    status?: string;
  }): Promise<string>;

  findById(id: string): Promise<AssignmentEntity | null>;
  findByUserId(userId: string): Promise<AssignmentEntity[]>;
  findOwner(id: string): Promise<string | null>;
  updateStatus(id: string, status: string, statusMessage?: string): Promise<void>;
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
    }>,
  ): Promise<void>;

  findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]>;
  updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
}
