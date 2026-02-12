/**
 * Repository Interface - Document Chunk Repository
 *
 * Defines the contract for document chunk data access operations.
 */

import type { Json } from '@/types/database';
import type { CreateDocumentChunkDTO, DocumentChunkEntity } from '../models/Document';

export interface IDocumentChunkRepository {
  createBatch(chunks: CreateDocumentChunkDTO[]): Promise<void>;
  createBatchAndReturn(chunks: CreateDocumentChunkDTO[]): Promise<{ id: string }[]>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByDocumentId(documentId: string): Promise<DocumentChunkEntity[]>;
  updateChunk(id: string, content: string, metadata?: Json): Promise<void>;
  deleteChunk(id: string): Promise<void>;
  updateEmbedding(id: string, embedding: number[]): Promise<void>;
}
