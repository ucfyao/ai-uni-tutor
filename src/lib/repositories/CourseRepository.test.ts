/**
 * CourseRepository Tests
 *
 * Tests all course-related database operations including
 * CRUD, published filters, knowledge outline saving,
 * entity mapping, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const { CourseRepository } = await import('./CourseRepository');

// ── Test Data ──

const courseRow = {
  id: 'course-1',
  name: 'Introduction to CS',
  code: 'CS101',
  university_id: 'uni-1',
  is_published: true,
  knowledge_outline: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const courseEntity = {
  id: 'course-1',
  name: 'Introduction to CS',
  code: 'CS101',
  universityId: 'uni-1',
  isPublished: true,
  knowledgeOutline: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const courseRow2 = {
  id: 'course-2',
  name: 'Data Structures',
  code: 'CS201',
  university_id: 'uni-1',
  is_published: false,
  knowledge_outline: { topics: ['arrays', 'trees'] },
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-02T00:00:00Z',
};

const courseEntity2 = {
  id: 'course-2',
  name: 'Data Structures',
  code: 'CS201',
  universityId: 'uni-1',
  isPublished: false,
  knowledgeOutline: { topics: ['arrays', 'trees'] },
  createdAt: new Date('2026-02-01T00:00:00Z'),
  updatedAt: new Date('2026-02-02T00:00:00Z'),
};

describe('CourseRepository', () => {
  let repo: InstanceType<typeof CourseRepository>;

  beforeEach(() => {
    repo = new CourseRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findAll ──

  describe('findAll', () => {
    it('should return all courses mapped to entities', async () => {
      mockSupabase.setQueryResponse([courseRow, courseRow2]);

      const result = await repo.findAll();

      expect(result).toEqual([courseEntity, courseEntity2]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('code', {
        ascending: true,
      });
    });

    it('should return an empty array when no courses exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('should return an empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Connection error'));

      await expect(repo.findAll()).rejects.toThrow(DatabaseError);
      await expect(repo.findAll()).rejects.toThrow('Failed to fetch courses');
    });
  });

  // ── findByUniversityId ──

  describe('findByUniversityId', () => {
    it('should return courses filtered by university ID', async () => {
      mockSupabase.setQueryResponse([courseRow]);

      const result = await repo.findByUniversityId('uni-1');

      expect(result).toEqual([courseEntity]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('university_id', 'uni-1');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('code', {
        ascending: true,
      });
    });

    it('should return an empty array when no courses match', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByUniversityId('uni-nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch error'));

      await expect(repo.findByUniversityId('uni-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findByUniversityId('uni-1')).rejects.toThrow(
        'Failed to fetch courses',
      );
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a course entity when found', async () => {
      mockSupabase.setSingleResponse(courseRow);

      const result = await repo.findById('course-1');

      expect(result).toEqual(courseEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'course-1');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when course not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('course-1');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findById('course-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('course-1')).rejects.toThrow('Failed to fetch course');
    });
  });

  // ── create ──

  describe('create', () => {
    it('should insert a course and return the entity', async () => {
      mockSupabase.setSingleResponse(courseRow);

      const result = await repo.create({
        universityId: 'uni-1',
        code: 'CS101',
        name: 'Introduction to CS',
        isPublished: true,
      });

      expect(result).toEqual(courseEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        university_id: 'uni-1',
        code: 'CS101',
        name: 'Introduction to CS',
        is_published: true,
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should default isPublished to false when not provided', async () => {
      mockSupabase.setSingleResponse(courseRow);

      await repo.create({
        universityId: 'uni-1',
        code: 'CS101',
        name: 'Introduction to CS',
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          is_published: false,
        }),
      );
    });

    it('should throw DatabaseError on insert error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.create({ universityId: 'uni-1', code: 'CS101', name: 'Test' }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.create({ universityId: 'uni-1', code: 'CS101', name: 'Test' }),
      ).rejects.toThrow('Failed to create course');
    });

    it('should throw DatabaseError when data is null after insert', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(
        repo.create({ universityId: 'uni-1', code: 'CS101', name: 'Test' }),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update a course and return the entity', async () => {
      mockSupabase.setSingleResponse(courseRow);

      const result = await repo.update('course-1', { name: 'Updated CS' });

      expect(result).toEqual(courseEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated CS',
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'course-1');
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should map code field', async () => {
      mockSupabase.setSingleResponse(courseRow);

      await repo.update('course-1', { code: 'CS102' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CS102',
        }),
      );
    });

    it('should map isPublished to is_published', async () => {
      mockSupabase.setSingleResponse(courseRow);

      await repo.update('course-1', { isPublished: false });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_published: false,
        }),
      );
    });

    it('should always include updated_at', async () => {
      mockSupabase.setSingleResponse(courseRow);

      await repo.update('course-1', {});

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
      );
    });

    it('should throw DatabaseError on update error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('course-1', { name: 'Test' })).rejects.toThrow(DatabaseError);
      await expect(repo.update('course-1', { name: 'Test' })).rejects.toThrow(
        'Failed to update course',
      );
    });

    it('should throw DatabaseError when data is null after update', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(repo.update('course-1', { name: 'Test' })).rejects.toThrow(DatabaseError);
    });
  });

  // ── findAllPublished ──

  describe('findAllPublished', () => {
    it('should return only published courses', async () => {
      mockSupabase.setQueryResponse([courseRow]);

      const result = await repo.findAllPublished();

      expect(result).toEqual([courseEntity]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('is_published', true);
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('code', {
        ascending: true,
      });
    });

    it('should return an empty array when no published courses exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findAllPublished();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch error'));

      await expect(repo.findAllPublished()).rejects.toThrow(DatabaseError);
      await expect(repo.findAllPublished()).rejects.toThrow(
        'Failed to fetch published courses',
      );
    });
  });

  // ── findPublishedByUniversityId ──

  describe('findPublishedByUniversityId', () => {
    it('should return published courses for a university', async () => {
      mockSupabase.setQueryResponse([courseRow]);

      const result = await repo.findPublishedByUniversityId('uni-1');

      expect(result).toEqual([courseEntity]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('university_id', 'uni-1');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('is_published', true);
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('code', {
        ascending: true,
      });
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch error'));

      await expect(repo.findPublishedByUniversityId('uni-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findPublishedByUniversityId('uni-1')).rejects.toThrow(
        'Failed to fetch published courses',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a course by ID', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('course-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'course-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.delete('course-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('course-1')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('course-1')).rejects.toThrow('Failed to delete course');
    });
  });

  // ── saveKnowledgeOutline ──

  describe('saveKnowledgeOutline', () => {
    it('should update the knowledge outline for a course', async () => {
      mockSupabase.setResponse(null);
      const outline = { topics: ['sorting', 'searching'] };

      await repo.saveKnowledgeOutline('course-1', outline);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledge_outline: outline,
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'course-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(
        repo.saveKnowledgeOutline('course-1', { topics: [] }),
      ).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Save failed'));

      await expect(
        repo.saveKnowledgeOutline('course-1', { topics: [] }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.saveKnowledgeOutline('course-1', { topics: [] }),
      ).rejects.toThrow('Failed to save course outline');
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(courseRow);

      const result = await repo.findById('course-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(courseRow.id);
      expect(result!.name).toBe(courseRow.name);
      expect(result!.code).toBe(courseRow.code);
      expect(result!.universityId).toBe(courseRow.university_id);
      expect(result!.isPublished).toBe(courseRow.is_published);
      expect(result!.knowledgeOutline).toBe(courseRow.knowledge_outline);
      expect(result!.createdAt).toEqual(new Date(courseRow.created_at));
      expect(result!.updatedAt).toEqual(new Date(courseRow.updated_at));
    });

    it('should handle non-null knowledge_outline', async () => {
      mockSupabase.setSingleResponse(courseRow2);

      const result = await repo.findById('course-2');

      expect(result).not.toBeNull();
      expect(result!.knowledgeOutline).toEqual({ topics: ['arrays', 'trees'] });
    });
  });
});
