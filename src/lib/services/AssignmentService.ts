/**
 * Assignment Service
 *
 * Business logic layer for assignment creation and item management.
 * Uses AssignmentRepository for data access.
 */

import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import {
  getAssignmentRepository,
  type AssignmentRepository,
} from '@/lib/repositories/AssignmentRepository';

export class AssignmentService {
  private readonly repo: AssignmentRepository;

  constructor(repo?: AssignmentRepository) {
    this.repo = repo ?? getAssignmentRepository();
  }

  async createEmpty(
    userId: string,
    data: {
      title: string;
      school?: string | null;
      course?: string | null;
      courseId: string;
    },
  ): Promise<string> {
    return this.repo.create({
      userId,
      title: data.title,
      school: data.school ?? null,
      course: data.course ?? null,
      courseId: data.courseId,
      status: 'draft',
    });
  }

  async addItem(
    assignmentId: string,
    data: {
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
    },
  ) {
    const maxOrderNum = await this.repo.getMaxOrderNum(assignmentId);
    const orderNum = maxOrderNum + 1;

    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbeddingWithRetry(`Question ${orderNum}: ${data.content}`);
    } catch (e) {
      console.error('Assignment item embedding generation failed:', e);
    }

    return this.repo.insertSingleItem(assignmentId, {
      orderNum,
      type: data.type,
      content: data.content,
      referenceAnswer: data.referenceAnswer,
      explanation: data.explanation,
      points: data.points,
      difficulty: data.difficulty,
      embedding,
    });
  }

  async publish(assignmentId: string): Promise<void> {
    const items = await this.repo.findItemsByAssignmentId(assignmentId);
    if (items.length === 0) {
      throw new Error('Cannot publish: no items');
    }
    await this.repo.publish(assignmentId);
  }

  async unpublish(assignmentId: string): Promise<void> {
    await this.repo.unpublish(assignmentId);
  }

  // ── New methods ──

  async findById(id: string): Promise<AssignmentEntity | null> {
    return this.repo.findById(id);
  }

  async getItems(assignmentId: string): Promise<AssignmentItemEntity[]> {
    return this.repo.findItemsByAssignmentId(assignmentId);
  }

  async getItemsWithEmbeddings(assignmentId: string) {
    return this.repo.findItemsByAssignmentIdWithEmbeddings(assignmentId);
  }

  async saveItemsAndReturn(items: Parameters<AssignmentRepository['insertItemsAndReturn']>[0]) {
    return this.repo.insertItemsAndReturn(items);
  }

  async rename(assignmentId: string, newTitle: string): Promise<void> {
    await this.repo.updateTitle(assignmentId, newTitle);
  }

  async reorder(assignmentId: string, orderedIds: string[]): Promise<void> {
    await this.repo.bulkUpdateOrder(assignmentId, orderedIds);
  }

  async deleteItemsByAssignmentId(assignmentId: string): Promise<void> {
    return this.repo.deleteItemsByAssignmentId(assignmentId);
  }

  async verifyItemsBelongToAssignment(itemIds: string[], assignmentId: string): Promise<boolean> {
    return this.repo.verifyItemsBelongToAssignment(itemIds, assignmentId);
  }

  async updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ) {
    return this.repo.updateItem(itemId, data);
  }

  async deleteItem(itemId: string): Promise<void> {
    return this.repo.deleteItem(itemId);
  }

  async deleteItemsByIds(ids: string[]): Promise<void> {
    return this.repo.deleteItemsByIds(ids);
  }

  async updateItemEmbedding(itemId: string, embedding: number[]): Promise<void> {
    return this.repo.updateItemEmbedding(itemId, embedding);
  }

  /**
   * Re-validate a single item's content and return updated warnings.
   */
  validateItemContent(content: string, referenceAnswer: string): string[] {
    const warnings: string[] = [];

    if (!content.trim()) {
      warnings.push('Empty question content');
    }

    if (!referenceAnswer.trim()) {
      warnings.push('No reference answer');
    }

    // Broken KaTeX
    const withoutDisplay = content.replace(/\$\$[^]*?\$\$/g, '');
    const singleDollarCount = (withoutDisplay.match(/\$/g) || []).length;
    if (singleDollarCount % 2 !== 0) {
      warnings.push('Possible broken KaTeX formula (unmatched $)');
    }

    // Suspiciously short
    if (content.trim().length > 0 && content.trim().length < 20) {
      warnings.push('Suspiciously short content');
    }

    return warnings;
  }

  async findCourseId(assignmentId: string): Promise<string | null> {
    return this.repo.findCourseId(assignmentId);
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.repo.deleteItemsByAssignmentId(id);
    await this.repo.delete(id);
  }

  async getAssignmentsForAdmin(courseIds?: string[]) {
    if (courseIds && courseIds.length > 0) {
      return this.repo.findByCourseIds(courseIds);
    }
    return this.repo.findAllForAdmin();
  }
}

// Singleton instance
let _assignmentService: AssignmentService | null = null;

export function getAssignmentService(): AssignmentService {
  if (!_assignmentService) {
    _assignmentService = new AssignmentService();
  }
  return _assignmentService;
}
