/**
 * Repository Interface - Lecture Document Repository
 *
 * Defines the contract for lecture document data access operations.
 */

import type { Json } from '@/types/database';
import type { CreateLectureDocumentDTO, LectureDocumentEntity } from '../models/Document';
import type { PaginatedResult, PaginationOptions } from '../models/Pagination';

export interface ILectureDocumentRepository {
  findByUserId(userId: string): Promise<LectureDocumentEntity[]>;
  findByUserIdAndName(userId: string, name: string): Promise<LectureDocumentEntity | null>;
  findById(id: string): Promise<LectureDocumentEntity | null>;
  create(data: CreateLectureDocumentDTO): Promise<LectureDocumentEntity>;
  publish(id: string): Promise<void>;
  unpublish(id: string): Promise<void>;
  updateMetadata(id: string, updates: { name?: string; metadata?: Json }): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
  verifyOwnership(id: string, userId: string): Promise<boolean>;
  findForAdmin(
    courseIds?: string[],
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<LectureDocumentEntity>>;
  deleteById(id: string): Promise<void>;
}
