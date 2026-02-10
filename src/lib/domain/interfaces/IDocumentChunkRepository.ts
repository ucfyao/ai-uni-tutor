/**
 * Repository Interface - Document Chunk Repository
 *
 * Defines the contract for document chunk data access operations.
 */

import type { CreateDocumentChunkDTO } from '../models/Document';

export interface IDocumentChunkRepository {
  createBatch(chunks: CreateDocumentChunkDTO[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
