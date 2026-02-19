/**
 * Assignment Service
 *
 * Business logic layer for assignment creation and item management.
 * Uses AssignmentRepository for data access.
 */

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

  /**
   * Create an empty assignment with 'draft' status.
   * Returns the new assignment ID.
   */
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

  /**
   * Add a single item to an existing assignment.
   * Automatically assigns the next order_num and generates an embedding.
   */
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

    // Generate embedding for RAG retrieval
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbeddingWithRetry(`Question ${orderNum}: ${data.content}`);
    } catch (e) {
      console.error('Assignment item embedding generation failed:', e);
      // Continue without embedding — item still saves, just no RAG
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

  /**
   * Publish an assignment (draft → ready). Requires at least one item.
   */
  async publish(assignmentId: string): Promise<void> {
    const items = await this.repo.findItemsByAssignmentId(assignmentId);
    if (items.length === 0) {
      throw new Error('Cannot publish: no items');
    }
    await this.repo.publish(assignmentId);
  }

  /**
   * Unpublish an assignment (ready → draft).
   */
  async unpublish(assignmentId: string): Promise<void> {
    await this.repo.unpublish(assignmentId);
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
