/**
 * Repository Interface - Document Chunk Repository
 *
 * Defines the contract for document chunk data access operations.
 */

import type { Json } from '@/types/database';
import type { CreateDocumentChunkDTO } from '../models/Document';

export interface IDocumentChunkRepository {
  createBatch(chunks: CreateDocumentChunkDTO[]): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
  findByDocumentId(
    documentId: string,
  ): Promise<{ id: string; content: string; metadata: Json; embedding: number[] | null }[]>;
  updateChunk(id: string, content: string, metadata?: Json): Promise<void>;
  deleteChunk(id: string): Promise<void>;
  updateEmbedding(id: string, embedding: number[]): Promise<void>;
}
