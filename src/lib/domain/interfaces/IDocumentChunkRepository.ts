/**
 * Repository Interface - Lecture Chunk Repository
 *
 * Defines the contract for lecture chunk data access operations.
 */

import type { Json } from '@/types/database';
import type { CreateLectureChunkDTO, LectureChunkEntity } from '../models/Document';

export interface ILectureChunkRepository {
  createBatch(chunks: CreateLectureChunkDTO[]): Promise<void>;
  createBatchAndReturn(chunks: CreateLectureChunkDTO[]): Promise<{ id: string }[]>;
  deleteByLectureDocumentId(lectureDocumentId: string): Promise<void>;
  findByLectureDocumentId(lectureDocumentId: string): Promise<LectureChunkEntity[]>;
  updateChunk(id: string, content: string, metadata?: Json): Promise<void>;
  deleteChunk(id: string): Promise<void>;
  updateEmbedding(id: string, embedding: number[]): Promise<void>;
}
