/**
 * Domain Models - Lecture Document Entity
 *
 * Represents a lecture document in the domain layer.
 * Independent of database implementation.
 */

import type { Json } from '@/types/database';

export type DocumentStatus = 'draft' | 'ready';

export interface LectureDocumentEntity {
  id: string;
  userId: string;
  name: string;
  status: DocumentStatus;
  metadata: Json;
  courseId: string | null;
  outline: Json | null;
  createdAt: Date;
  chunkCount?: number;
}

export interface CreateLectureDocumentDTO {
  userId: string;
  name: string;
  status?: DocumentStatus;
  metadata?: Json;
  courseId?: string;
}

export interface LectureChunkEntity {
  id: string;
  lectureDocumentId: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

export interface CreateLectureChunkDTO {
  lectureDocumentId: string;
  content: string;
  embedding?: number[] | null;
  metadata?: Json;
}
