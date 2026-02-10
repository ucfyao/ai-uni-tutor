/**
 * Repository Interface - Document Repository
 *
 * Defines the contract for document data access operations.
 */

import type {
  CreateDocumentDTO,
  DocumentEntity,
  UpdateDocumentStatusDTO,
} from '../models/Document';

export interface IDocumentRepository {
  findByUserIdAndName(userId: string, name: string): Promise<DocumentEntity | null>;
  create(data: CreateDocumentDTO): Promise<DocumentEntity>;
  updateStatus(id: string, data: UpdateDocumentStatusDTO): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  verifyOwnership(id: string, userId: string): Promise<boolean>;
}
