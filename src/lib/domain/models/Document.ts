/**
 * Domain Models - Document Entity
 *
 * Represents a document in the domain layer.
 * Independent of database implementation.
 */

import type { Json } from '@/types/database';

export type DocumentStatus = 'processing' | 'ready' | 'error';

export type DocumentType = 'lecture' | 'exam' | 'assignment';

export interface DocumentEntity {
  id: string;
  userId: string;
  name: string;
  status: DocumentStatus;
  statusMessage: string | null;
  metadata: Json;
  docType: DocumentType | null;
  courseId: string | null;
  createdAt: Date;
}

export interface CreateDocumentDTO {
  userId: string;
  name: string;
  status?: DocumentStatus;
  metadata?: Json;
  docType?: string;
  courseId?: string;
}

export interface UpdateDocumentStatusDTO {
  status: DocumentStatus;
  statusMessage?: string | null;
}

export interface DocumentChunkEntity {
  id: string;
  documentId: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

export interface CreateDocumentChunkDTO {
  documentId: string;
  content: string;
  embedding?: number[] | null;
  metadata?: Json;
}
