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

  async getAssignmentStats(assignmentIds: string[]) {
    return this.repo.getStats(assignmentIds);
  }

  async batchUpdateAnswers(
    matches: Array<{ itemId: string; referenceAnswer: string }>,
  ): Promise<void> {
    await Promise.all(
      matches.map(async (m) => {
        const item = await this.repo.findItemById(m.itemId);
        const content = item?.content ?? '';
        const warnings = this.validateItemContent(content, m.referenceAnswer);
        await this.repo.updateItem(m.itemId, {
          referenceAnswer: m.referenceAnswer,
          warnings,
        });
      }),
    );
  }

  async mergeItems(assignmentId: string, itemIds: string[]): Promise<string> {
    if (itemIds.length < 2) throw new Error('Need at least 2 items to merge');

    const valid = await this.repo.verifyItemsBelongToAssignment(itemIds, assignmentId);
    if (!valid) throw new Error('Items do not belong to this assignment');

    const allItems = await this.repo.findItemsByAssignmentId(assignmentId);
    const toMerge = itemIds
      .map((id) => allItems.find((i) => i.id === id))
      .filter((i): i is AssignmentItemEntity => i !== null);
    toMerge.sort((a, b) => a.orderNum - b.orderNum);

    const mergedContent = toMerge.map((i) => i.content).join('\n\n---\n\n');
    const mergedRefAnswer = toMerge
      .map((i) => i.referenceAnswer)
      .filter(Boolean)
      .join('\n\n---\n\n');
    const mergedExplanation = toMerge
      .map((i) => i.explanation)
      .filter(Boolean)
      .join('\n\n---\n\n');

    const keepId = toMerge[0].id;
    const deleteIds = toMerge.slice(1).map((i) => i.id);

    const warnings = this.validateItemContent(mergedContent, mergedRefAnswer);

    await this.repo.updateItem(keepId, {
      content: mergedContent,
      referenceAnswer: mergedRefAnswer,
      explanation: mergedExplanation,
      warnings,
    });

    await this.repo.deleteItemsByIds(deleteIds);

    try {
      const { buildAssignmentItemContent } = await import('@/lib/rag/build-chunk-content');
      const enriched = {
        orderNum: toMerge[0].orderNum,
        content: mergedContent,
        referenceAnswer: mergedRefAnswer,
        explanation: mergedExplanation,
        points: toMerge[0].points,
        type: toMerge[0].type,
        difficulty: toMerge[0].difficulty,
        section: (toMerge[0].metadata?.section as string) ?? '',
        sourcePages: (toMerge[0].metadata?.sourcePages as number[]) ?? [],
      };
      const enrichedContent = buildAssignmentItemContent(enriched);
      const embedding = await generateEmbeddingWithRetry(enrichedContent);
      await this.repo.updateItemEmbedding(keepId, embedding);
    } catch (e) {
      console.error('Re-embedding after merge failed:', e);
    }

    const remaining = allItems.filter((i) => !deleteIds.includes(i.id));
    remaining.sort((a, b) => a.orderNum - b.orderNum);
    await this.repo.bulkUpdateOrder(
      assignmentId,
      remaining.map((i) => i.id),
    );

    return keepId;
  }

  async splitItem(
    assignmentId: string,
    itemId: string,
    splitContent: [string, string],
  ): Promise<{ firstId: string; secondId: string }> {
    const valid = await this.repo.verifyItemsBelongToAssignment([itemId], assignmentId);
    if (!valid) throw new Error('Item does not belong to this assignment');

    const item = await this.repo.findItemById(itemId);
    if (!item) throw new Error('Item not found');

    const firstWarnings = this.validateItemContent(splitContent[0], item.referenceAnswer);
    await this.repo.updateItem(itemId, {
      content: splitContent[0],
      warnings: firstWarnings,
    });

    const secondWarnings = this.validateItemContent(splitContent[1], '');
    const secondItem = await this.repo.insertSingleItem(assignmentId, {
      orderNum: item.orderNum + 1,
      type: item.type,
      content: splitContent[1],
      referenceAnswer: '',
      explanation: '',
      points: 0,
      difficulty: item.difficulty,
      metadata: item.metadata,
      warnings: secondWarnings,
    });

    try {
      const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
      const embeddings = await generateEmbeddingBatch([splitContent[0], splitContent[1]]);
      await Promise.all([
        this.repo.updateItemEmbedding(itemId, embeddings[0]),
        this.repo.updateItemEmbedding(secondItem.id, embeddings[1]),
      ]);
    } catch (e) {
      console.error('Re-embedding after split failed:', e);
    }

    const allItems = await this.repo.findItemsByAssignmentId(assignmentId);
    allItems.sort((a, b) => a.orderNum - b.orderNum);
    await this.repo.bulkUpdateOrder(
      assignmentId,
      allItems.map((i) => i.id),
    );

    return { firstId: itemId, secondId: secondItem.id };
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
