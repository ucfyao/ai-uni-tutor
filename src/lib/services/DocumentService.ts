/**
 * Lecture Document Service
 *
 * Business logic layer for lecture document operations.
 * Uses LectureDocumentRepository and LectureChunkRepository for data access.
 */

import type { CreateLectureChunkDTO, LectureDocumentEntity } from '@/lib/domain/models/Document';
import type { PaginatedResult, PaginationOptions } from '@/lib/domain/models/Pagination';
import { ForbiddenError } from '@/lib/errors';
import { getLectureChunkRepository, getLectureDocumentRepository } from '@/lib/repositories';
import type { LectureChunkRepository } from '@/lib/repositories/DocumentChunkRepository';
import type { LectureDocumentRepository } from '@/lib/repositories/DocumentRepository';
import type { Json } from '@/types/database';

export class LectureDocumentService {
  private readonly docRepo: LectureDocumentRepository;
  private readonly chunkRepo: LectureChunkRepository;

  constructor(docRepo?: LectureDocumentRepository, chunkRepo?: LectureChunkRepository) {
    this.docRepo = docRepo ?? getLectureDocumentRepository();
    this.chunkRepo = chunkRepo ?? getLectureChunkRepository();
  }

  async getDocumentsForAdmin(
    courseIds?: string[],
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<LectureDocumentEntity>> {
    return this.docRepo.findForAdmin(courseIds, pagination);
  }

  async checkDuplicate(userId: string, name: string): Promise<boolean> {
    const existing = await this.docRepo.findByUserIdAndName(userId, name);
    return existing !== null;
  }

  async createDocument(
    userId: string,
    name: string,
    metadata?: Json,
    courseId?: string,
  ): Promise<LectureDocumentEntity> {
    return this.docRepo.create({
      userId,
      name,
      status: 'draft',
      metadata,
      courseId,
    });
  }

  async publish(docId: string): Promise<void> {
    const chunks = await this.chunkRepo.findByLectureDocumentId(docId);
    if (chunks.length === 0) {
      throw new Error('Cannot publish: no content items');
    }
    await this.docRepo.publish(docId);
  }

  async unpublish(docId: string): Promise<void> {
    await this.docRepo.unpublish(docId);
  }

  async saveChunks(chunks: CreateLectureChunkDTO[]): Promise<void> {
    await this.chunkRepo.createBatch(chunks);
  }

  async saveChunksAndReturn(chunks: CreateLectureChunkDTO[]): Promise<{ id: string }[]> {
    return this.chunkRepo.createBatchAndReturn(chunks);
  }

  async deleteDocument(docId: string, userId: string): Promise<void> {
    const isOwner = await this.docRepo.verifyOwnership(docId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this document');

    await this.docRepo.delete(docId, userId);
  }

  async findById(docId: string): Promise<LectureDocumentEntity | null> {
    return this.docRepo.findById(docId);
  }

  async getChunks(docId: string) {
    return this.chunkRepo.findByLectureDocumentId(docId);
  }

  async getChunksWithEmbeddings(docId: string) {
    return this.chunkRepo.findByLectureDocumentIdWithEmbeddings(docId);
  }

  async updateChunk(chunkId: string, content: string, metadata?: Json): Promise<void> {
    await this.chunkRepo.updateChunk(chunkId, content, metadata);
  }

  async deleteChunk(chunkId: string): Promise<void> {
    await this.chunkRepo.deleteChunk(chunkId);
  }

  async deleteChunksByLectureDocumentId(docId: string): Promise<void> {
    await this.chunkRepo.deleteByLectureDocumentId(docId);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    await this.chunkRepo.updateEmbedding(chunkId, embedding);
  }

  async updateDocumentMetadata(
    docId: string,
    updates: { name?: string; metadata?: Json },
  ): Promise<void> {
    await this.docRepo.updateMetadata(docId, updates);
  }

  async verifyChunksBelongToLectureDocument(
    chunkIds: string[],
    lectureDocumentId: string,
  ): Promise<boolean> {
    return this.chunkRepo.verifyChunksBelongToLectureDocument(chunkIds, lectureDocumentId);
  }

  async deleteByAdmin(docId: string): Promise<void> {
    await this.docRepo.deleteById(docId);
  }
}

let _lectureDocumentService: LectureDocumentService | null = null;

export function getLectureDocumentService(): LectureDocumentService {
  if (!_lectureDocumentService) {
    _lectureDocumentService = new LectureDocumentService();
  }
  return _lectureDocumentService;
}
