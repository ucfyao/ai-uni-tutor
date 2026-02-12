/**
 * Document Service
 *
 * Business logic layer for document operations.
 * Uses DocumentRepository and DocumentChunkRepository for data access.
 */

import type {
  CreateDocumentChunkDTO,
  DocumentEntity,
  DocumentStatus,
} from '@/lib/domain/models/Document';
import { ForbiddenError } from '@/lib/errors';
import { getDocumentChunkRepository, getDocumentRepository } from '@/lib/repositories';
import type { DocumentChunkRepository } from '@/lib/repositories/DocumentChunkRepository';
import type { DocumentRepository } from '@/lib/repositories/DocumentRepository';
import type { Json } from '@/types/database';

export class DocumentService {
  private readonly docRepo: DocumentRepository;
  private readonly chunkRepo: DocumentChunkRepository;

  constructor(docRepo?: DocumentRepository, chunkRepo?: DocumentChunkRepository) {
    this.docRepo = docRepo ?? getDocumentRepository();
    this.chunkRepo = chunkRepo ?? getDocumentChunkRepository();
  }

  async checkDuplicate(userId: string, name: string): Promise<boolean> {
    const existing = await this.docRepo.findByUserIdAndName(userId, name);
    return existing !== null;
  }

  async createDocument(
    userId: string,
    name: string,
    metadata?: Json,
    docType?: string,
    courseId?: string,
  ): Promise<DocumentEntity> {
    return this.docRepo.create({
      userId,
      name,
      status: 'processing',
      metadata,
      docType,
      courseId,
    });
  }

  async updateStatus(docId: string, status: DocumentStatus, statusMessage?: string): Promise<void> {
    await this.docRepo.updateStatus(docId, { status, statusMessage });
  }

  async saveChunks(chunks: CreateDocumentChunkDTO[]): Promise<void> {
    await this.chunkRepo.createBatch(chunks);
  }

  async saveChunksAndReturn(chunks: CreateDocumentChunkDTO[]): Promise<{ id: string }[]> {
    return this.chunkRepo.createBatchAndReturn(chunks);
  }

  async deleteDocument(docId: string, userId: string): Promise<void> {
    const isOwner = await this.docRepo.verifyOwnership(docId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this document');

    await this.docRepo.delete(docId, userId);
  }

  async findById(docId: string): Promise<DocumentEntity | null> {
    return this.docRepo.findById(docId);
  }

  async getChunks(docId: string) {
    return this.chunkRepo.findByDocumentId(docId);
  }

  async updateChunk(chunkId: string, content: string, metadata?: Json): Promise<void> {
    await this.chunkRepo.updateChunk(chunkId, content, metadata);
  }

  async deleteChunk(chunkId: string): Promise<void> {
    await this.chunkRepo.deleteChunk(chunkId);
  }

  async deleteChunksByDocumentId(docId: string): Promise<void> {
    await this.chunkRepo.deleteByDocumentId(docId);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
    await this.chunkRepo.updateEmbedding(chunkId, embedding);
  }

  async updateDocumentMetadata(
    docId: string,
    updates: { name?: string; metadata?: Json; docType?: string },
  ): Promise<void> {
    await this.docRepo.updateMetadata(docId, updates);
  }
}

let _documentService: DocumentService | null = null;

export function getDocumentService(): DocumentService {
  if (!_documentService) {
    _documentService = new DocumentService();
  }
  return _documentService;
}
