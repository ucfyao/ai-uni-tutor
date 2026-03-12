/**
 * AssignmentRepository Tests
 *
 * Tests key assignment and assignment item database operations.
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

const { AssignmentRepository } = await import('./AssignmentRepository');

describe('AssignmentRepository', () => {
  let repo: InstanceType<typeof AssignmentRepository>;

  beforeEach(() => {
    repo = new AssignmentRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test data ──

  const assignmentRow = {
    id: 'assign-1',
    user_id: 'user-1',
    title: 'Test Assignment',
    school: 'MIT',
    course: 'CS101',
    course_id: 'course-1',
    status: 'draft',
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const itemRow = {
    id: 'item-1',
    assignment_id: 'assign-1',
    order_num: 1,
    type: 'multiple_choice',
    content: 'What is 1+1?',
    reference_answer: '2',
    explanation: 'Basic arithmetic',
    points: 5,
    difficulty: 'easy',
    metadata: { sourcePages: [1] },
    warnings: [],
    parent_item_id: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  // ── create ──

  describe('create', () => {
    it('should insert and return the assignment id', async () => {
      mockSupabase.setSingleResponse({ id: 'assign-1' });

      const result = await repo.create({
        userId: 'user-1',
        title: 'Test Assignment',
        school: 'MIT',
        course: 'CS101',
        courseId: 'course-1',
      });

      expect(result).toBe('assign-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignments');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        title: 'Test Assignment',
        school: 'MIT',
        course: 'CS101',
        course_id: 'course-1',
        status: 'draft',
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should default status to draft', async () => {
      mockSupabase.setSingleResponse({ id: 'assign-1' });

      await repo.create({ userId: 'user-1', title: 'Test' });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
      );
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.create({ userId: 'user-1', title: 'Test' }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.create({ userId: 'user-1', title: 'Test' }),
      ).rejects.toThrow('Failed to create assignment');
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a mapped entity', async () => {
      mockSupabase.setSingleResponse(assignmentRow);

      const result = await repo.findById('assign-1');

      expect(result).toEqual({
        id: 'assign-1',
        userId: 'user-1',
        title: 'Test Assignment',
        school: 'MIT',
        course: 'CS101',
        courseId: 'course-1',
        status: 'draft',
        metadata: undefined,
        createdAt: '2026-01-01T00:00:00Z',
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignments');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'assign-1');
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB error'));

      await expect(repo.findById('assign-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('assign-1')).rejects.toThrow('Failed to fetch assignment');
    });
  });

  // ── publish ──

  describe('publish', () => {
    it('should update status to ready', async () => {
      mockSupabase.setResponse(null);

      await repo.publish('assign-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignments');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ status: 'ready' });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'assign-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.publish('assign-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.publish('assign-1')).rejects.toThrow(DatabaseError);
      await expect(repo.publish('assign-1')).rejects.toThrow('Failed to publish assignment');
    });
  });

  // ── unpublish ──

  describe('unpublish', () => {
    it('should update status to draft', async () => {
      mockSupabase.setResponse(null);

      await repo.unpublish('assign-1');

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ status: 'draft' });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'assign-1');
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.unpublish('assign-1')).rejects.toThrow(DatabaseError);
      await expect(repo.unpublish('assign-1')).rejects.toThrow('Failed to unpublish assignment');
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete with correct id', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('assign-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignments');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'assign-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.delete('assign-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('assign-1')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('assign-1')).rejects.toThrow('Failed to delete assignment');
    });
  });

  // ── insertItems ──

  describe('insertItems', () => {
    it('should insert mapped item rows', async () => {
      mockSupabase.setResponse(null);

      await repo.insertItems([
        {
          assignmentId: 'assign-1',
          orderNum: 1,
          type: 'multiple_choice',
          content: 'What is 1+1?',
          referenceAnswer: '2',
          explanation: 'Basic arithmetic',
          points: 5,
          difficulty: 'easy',
        },
      ]);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignment_items');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith([
        {
          assignment_id: 'assign-1',
          order_num: 1,
          type: 'multiple_choice',
          content: 'What is 1+1?',
          reference_answer: '2',
          explanation: 'Basic arithmetic',
          points: 5,
          difficulty: 'easy',
          metadata: {},
          embedding: null,
          warnings: [],
          parent_item_id: null,
        },
      ]);
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(
        repo.insertItems([{ assignmentId: 'a', orderNum: 1, content: 'test' }]),
      ).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.insertItems([{ assignmentId: 'a', orderNum: 1, content: 'test' }]),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.insertItems([{ assignmentId: 'a', orderNum: 1, content: 'test' }]),
      ).rejects.toThrow('Failed to insert assignment items');
    });
  });

  // ── findItemsByAssignmentId ──

  describe('findItemsByAssignmentId', () => {
    it('should return mapped and sorted item entities', async () => {
      mockSupabase.setQueryResponse([itemRow]);

      const result = await repo.findItemsByAssignmentId('assign-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'item-1',
        assignmentId: 'assign-1',
        orderNum: 1,
        type: 'multiple_choice',
        content: 'What is 1+1?',
        referenceAnswer: '2',
        explanation: 'Basic arithmetic',
        points: 5,
        difficulty: 'easy',
        metadata: { sourcePages: [1] },
        warnings: [],
        parentItemId: null,
        createdAt: '2026-01-01T00:00:00Z',
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('assignment_items');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('assignment_id', 'assign-1');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('order_num', {
        ascending: true,
      });
    });

    it('should return empty array when no items exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findItemsByAssignmentId('assign-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findItemsByAssignmentId('assign-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findItemsByAssignmentId('assign-1')).rejects.toThrow(
        'Failed to fetch assignment items',
      );
    });
  });

  // ── searchItemsByEmbedding ──

  describe('searchItemsByEmbedding', () => {
    it('should call RPC with correct params and return mapped results', async () => {
      mockSupabase.setResponse(
        [
          {
            id: 'item-1',
            assignment_id: 'assign-1',
            order_num: 1,
            content: 'What is 1+1?',
            reference_answer: '2',
            explanation: 'Basic arithmetic',
            points: 5,
            difficulty: 'easy',
            similarity: 0.95,
          },
        ],
        null,
      );

      const embedding = [0.1, 0.2, 0.3];
      const result = await repo.searchItemsByEmbedding(embedding, 5, 'course-1');

      expect(result).toEqual([
        {
          id: 'item-1',
          assignmentId: 'assign-1',
          orderNum: 1,
          content: 'What is 1+1?',
          referenceAnswer: '2',
          explanation: 'Basic arithmetic',
          points: 5,
          difficulty: 'easy',
          similarity: 0.95,
        },
      ]);
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('match_assignment_items', {
        query_embedding: [0.1, 0.2, 0.3],
        match_count: 5,
        filter_course_id: 'course-1',
      });
    });

    it('should pass null courseId when not provided', async () => {
      mockSupabase.setResponse([], null);

      await repo.searchItemsByEmbedding([0.1], 5);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('match_assignment_items', {
        query_embedding: [0.1],
        match_count: 5,
        filter_course_id: null,
      });
    });

    it('should throw DatabaseError on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.searchItemsByEmbedding([0.1], 5)).rejects.toThrow(DatabaseError);
      await expect(repo.searchItemsByEmbedding([0.1], 5)).rejects.toThrow(
        'Failed to search assignment items',
      );
    });
  });
});
