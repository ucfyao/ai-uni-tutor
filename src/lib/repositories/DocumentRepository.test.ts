/**
 * LectureDocumentRepository Tests
 *
 * Tests all lecture document-related database operations including
 * entity mapping, PGRST116 handling, ownership verification,
 * and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { documentEntity, documentRow, draftDocumentRow } from '@/__tests__/fixtures/documents';
import {
  createMockSupabase,
  dbError,
  PGRST116,
  type MockSupabaseResult,
} from '@/__tests__/helpers/mockSupabase';
import { DatabaseError } from '@/lib/errors';

// ── Mocks ──

let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

// Import after mocks
const { LectureDocumentRepository } = await import('./DocumentRepository');

describe('LectureDocumentRepository', () => {
  let repo: InstanceType<typeof LectureDocumentRepository>;

  beforeEach(() => {
    repo = new LectureDocumentRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a document entity when found', async () => {
      mockSupabase.setSingleResponse(documentRow);

      const result = await repo.findById('doc-001');

      expect(result).toEqual(documentEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('lecture_documents');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when not found (error)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('doc-001');

      expect(result).toBeNull();
    });

    it('should return null on any error (no throw)', async () => {
      // LectureDocumentRepository.findById returns null on error || !data
      mockSupabase.setErrorResponse(dbError('Server error'));

      const result = await repo.findById('doc-001');

      expect(result).toBeNull();
    });
  });

  // ── findByUserIdAndName ──

  describe('findByUserIdAndName', () => {
    it('should return a document entity when found', async () => {
      mockSupabase.setSingleResponse(documentRow);

      const result = await repo.findByUserIdAndName(
        'user-free-001',
        'Lecture 1 - Intro to Algorithms.pdf',
      );

      expect(result).toEqual(documentEntity);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith(
        'name',
        'Lecture 1 - Intro to Algorithms.pdf',
      );
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findByUserIdAndName('user-free-001', 'nonexistent.pdf');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findByUserIdAndName('user-free-001', 'file.pdf');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findByUserIdAndName('user-free-001', 'file.pdf')).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.findByUserIdAndName('user-free-001', 'file.pdf')).rejects.toThrow(
        'Failed to fetch document',
      );
    });
  });

  // ── create ──

  describe('create', () => {
    it('should create a document and return the entity', async () => {
      mockSupabase.setSingleResponse(documentRow);

      const dto = {
        userId: 'user-free-001',
        name: 'Lecture 1 - Intro to Algorithms.pdf',
        status: 'ready' as const,
        metadata: { pageCount: 12, size: 204800 },
        courseId: 'course-001',
      };

      const result = await repo.create(dto);

      expect(result).toEqual(documentEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('lecture_documents');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-free-001',
          name: 'Lecture 1 - Intro to Algorithms.pdf',
          status: 'ready',
          metadata: { pageCount: 12, size: 204800 },
          course_id: 'course-001',
        }),
      );
    });

    it('should default status to draft when not provided', async () => {
      mockSupabase.setSingleResponse(draftDocumentRow);

      const dto = {
        userId: 'user-free-001',
        name: 'Lecture 2 - Sorting.pdf',
      };

      await repo.create(dto);

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
          metadata: {},
        }),
      );
    });

    it('should include courseId when provided (even undefined)', async () => {
      mockSupabase.setSingleResponse(documentRow);

      const dto = {
        userId: 'user-free-001',
        name: 'file.pdf',
        courseId: 'course-001',
      };

      await repo.create(dto);

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          course_id: 'course-001',
        }),
      );
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const dto = {
        userId: 'user-free-001',
        name: 'file.pdf',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.create(dto)).rejects.toThrow('Failed to create document');
    });

    it('should throw DatabaseError when data is null without error', async () => {
      // error is null, data is null => should throw
      mockSupabase.setSingleResponse(null);

      const dto = {
        userId: 'user-free-001',
        name: 'file.pdf',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
    });
  });

  // ── publish / unpublish ──

  describe('publish', () => {
    it('should set status to ready', async () => {
      mockSupabase.setResponse(null);

      await repo.publish('doc-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('lecture_documents');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
    });

    it('should throw DatabaseError on failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.publish('doc-001')).rejects.toThrow(DatabaseError);
      await expect(repo.publish('doc-001')).rejects.toThrow('Failed to publish');
    });
  });

  describe('unpublish', () => {
    it('should set status to draft', async () => {
      mockSupabase.setResponse(null);

      await repo.unpublish('doc-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('lecture_documents');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'draft',
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
    });

    it('should throw DatabaseError on failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.unpublish('doc-001')).rejects.toThrow(DatabaseError);
      await expect(repo.unpublish('doc-001')).rejects.toThrow('Failed to unpublish');
    });
  });

  // ── updateMetadata ──

  describe('updateMetadata', () => {
    it('should update name', async () => {
      mockSupabase.setResponse(null);

      await repo.updateMetadata('doc-001', { name: 'Renamed.pdf' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed.pdf',
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
    });

    it('should update metadata', async () => {
      mockSupabase.setResponse(null);

      const newMetadata = { pageCount: 20, size: 500000 };
      await repo.updateMetadata('doc-001', { metadata: newMetadata });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: newMetadata,
        }),
      );
    });

    it('should update multiple fields at once', async () => {
      mockSupabase.setResponse(null);

      await repo.updateMetadata('doc-001', {
        name: 'New Name.pdf',
        metadata: { page: 1 },
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Name.pdf',
          metadata: { page: 1 },
        }),
      );
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateMetadata('doc-001', { name: 'New.pdf' })).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.updateMetadata('doc-001', { name: 'New.pdf' })).rejects.toThrow(
        'Failed to update document',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a document by id and userId', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('doc-001', 'user-free-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('lecture_documents');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('doc-001', 'user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('doc-001', 'user-free-001')).rejects.toThrow(
        'Failed to delete document',
      );
    });
  });

  // ── verifyOwnership ──

  describe('verifyOwnership', () => {
    it('should return true when document belongs to user', async () => {
      mockSupabase.setSingleResponse({ id: 'doc-001' });

      const result = await repo.verifyOwnership('doc-001', 'user-free-001');

      expect(result).toBe(true);
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'doc-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
    });

    it('should return false when document does not belong to user (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.verifyOwnership('doc-001', 'wrong-user');

      expect(result).toBe(false);
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.verifyOwnership('doc-001', 'user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.verifyOwnership('doc-001', 'user-free-001')).rejects.toThrow(
        'Failed to verify document ownership',
      );
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(documentRow);

      const result = await repo.findById('doc-001');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(documentRow.user_id);
      expect(result!.status).toBe(documentRow.status);
      expect(result!.courseId).toBe(documentRow.course_id);
      expect(result!.createdAt).toEqual(new Date(documentRow.created_at));
    });
  });
});
