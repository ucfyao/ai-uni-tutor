/**
 * Repository Interface - Document Repository
 *
 * Defines the contract for document data access operations.
 */

import type { Json } from '@/types/database';
import type {
  CreateDocumentDTO,
  DocumentEntity,
  UpdateDocumentStatusDTO,
} from '../models/Document';

export interface IDocumentRepository {
  findByUserId(userId: string, docType?: string): Promise<DocumentEntity[]>;
  findByUserIdAndName(userId: string, name: string): Promise<DocumentEntity | null>;
  findById(id: string): Promise<DocumentEntity | null>;
  create(data: CreateDocumentDTO): Promise<DocumentEntity>;
  updateStatus(id: string, data: UpdateDocumentStatusDTO): Promise<void>;
  updateMetadata(
    id: string,
    updates: { name?: string; metadata?: Json; docType?: string },
  ): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  verifyOwnership(id: string, userId: string): Promise<boolean>;
}
