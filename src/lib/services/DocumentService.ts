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
  ): Promise<DocumentEntity> {
    return this.docRepo.create({
      userId,
      name,
      status: 'processing',
      metadata,
      docType,
    });
  }

  async updateStatus(docId: string, status: DocumentStatus, statusMessage?: string): Promise<void> {
    await this.docRepo.updateStatus(docId, { status, statusMessage });
  }

  async saveChunks(chunks: CreateDocumentChunkDTO[]): Promise<void> {
    await this.chunkRepo.createBatch(chunks);
  }

  async deleteDocument(docId: string, userId: string): Promise<void> {
    const isOwner = await this.docRepo.verifyOwnership(docId, userId);
    if (!isOwner) throw new Error('Unauthorized');

    await this.docRepo.delete(docId, userId);
  }
}

let _documentService: DocumentService | null = null;

export function getDocumentService(): DocumentService {
  if (!_documentService) {
    _documentService = new DocumentService();
  }
  return _documentService;
}
