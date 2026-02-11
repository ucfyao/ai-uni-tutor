/**
 * Domain Models - Document Entity
 *
 * Represents a document in the domain layer.
 * Independent of database implementation.
 */

import type { Json } from '@/types/database';

export type DocumentStatus = 'processing' | 'ready' | 'error';

export interface DocumentEntity {
  id: string;
  userId: string;
  name: string;
  status: DocumentStatus;
  statusMessage: string | null;
  metadata: Json;
  createdAt: Date;
}

export interface CreateDocumentDTO {
  userId: string;
  name: string;
  status?: DocumentStatus;
  metadata?: Json;
  docType?: string;
}

export interface UpdateDocumentStatusDTO {
  status: DocumentStatus;
  statusMessage?: string | null;
}

export interface CreateDocumentChunkDTO {
  documentId: string;
  content: string;
  embedding?: number[] | null;
  metadata?: Json;
}
