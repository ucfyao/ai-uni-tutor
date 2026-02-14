/**
 * MockExamRepository Tests
 *
 * Tests all mock exam database operations including create,
 * find, ownership verification, pagination, count, update,
 * entity mapping, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completedMockExamRow,
  mockExamEntity,
  mockExamQuestions,
  mockExamResponses,
  mockExamRow,
} from '@/__tests__/fixtures/exams';
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
const { MockExamRepository } = await import('./MockExamRepository');

describe('MockExamRepository', () => {
  let repo: InstanceType<typeof MockExamRepository>;

  beforeEach(() => {
    repo = new MockExamRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──

  describe('create', () => {
    it('should create a mock exam and return its id', async () => {
      mockSupabase.setSingleResponse({ id: 'mock-exam-001' });

      const result = await repo.create({
        userId: 'user-free-001',
        paperId: 'paper-001',
        mode: 'practice',
        sessionId: 'session-001',
        title: 'CS101 Midterm Practice',
        questions: mockExamQuestions as unknown as import('@/types/database').Json,
        responses: mockExamResponses as unknown as import('@/types/database').Json,
        totalPoints: 15,
        currentIndex: 1,
        status: 'in_progress',
      });

      expect(result).toBe('mock-exam-001');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-free-001',
        paper_id: 'paper-001',
        mode: 'practice',
        session_id: 'session-001',
        title: 'CS101 Midterm Practice',
        questions: mockExamQuestions,
        responses: mockExamResponses,
        score: null,
        total_points: 15,
        current_index: 1,
        status: 'in_progress',
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      mockSupabase.setSingleResponse({ id: 'mock-exam-002' });

      await repo.create({
        userId: 'user-free-001',
        paperId: 'paper-001',
        mode: 'practice',
        title: 'Minimal Mock',
        questions: [] as unknown as import('@/types/database').Json,
        responses: [] as unknown as import('@/types/database').Json,
        totalPoints: 10,
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-free-001',
        paper_id: 'paper-001',
        mode: 'practice',
        session_id: null,
        title: 'Minimal Mock',
        questions: [],
        responses: [],
        score: null,
        total_points: 10,
        current_index: 0,
        status: 'in_progress',
      });
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.create({
          userId: 'user-free-001',
          paperId: 'paper-001',
          mode: 'practice',
          title: 'Test',
          questions: [] as unknown as import('@/types/database').Json,
          responses: [] as unknown as import('@/types/database').Json,
          totalPoints: 10,
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.create({
          userId: 'user-free-001',
          paperId: 'paper-001',
          mode: 'practice',
          title: 'Test',
          questions: [] as unknown as import('@/types/database').Json,
          responses: [] as unknown as import('@/types/database').Json,
          totalPoints: 10,
        }),
      ).rejects.toThrow('Failed to create mock exam');
    });

    it('should throw DatabaseError when data is null without error', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(
        repo.create({
          userId: 'user-free-001',
          paperId: 'paper-001',
          mode: 'practice',
          title: 'Test',
          questions: [] as unknown as import('@/types/database').Json,
          responses: [] as unknown as import('@/types/database').Json,
          totalPoints: 10,
        }),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a mock exam entity when found', async () => {
      mockSupabase.setSingleResponse(mockExamRow);

      const result = await repo.findById('mock-exam-001');

      expect(result).toEqual(mockExamEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'mock-exam-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('mock-exam-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findById('mock-exam-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('mock-exam-001')).rejects.toThrow('Failed to fetch mock exam');
    });
  });

  // ── verifyOwnership ──

  describe('verifyOwnership', () => {
    it('should return true when mock exam belongs to user', async () => {
      mockSupabase.setSingleResponse({ id: 'mock-exam-001' });

      const result = await repo.verifyOwnership('mock-exam-001', 'user-free-001');

      expect(result).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'mock-exam-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return false when data is null (no match)', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.verifyOwnership('mock-exam-001', 'wrong-user');

      expect(result).toBe(false);
    });

    it('should return false when PGRST116 error (no match)', async () => {
      // verifyOwnership catches all errors implicitly: data is null on error
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.verifyOwnership('mock-exam-001', 'wrong-user');

      // When .single() throws PGRST116, data will be null, so result is false
      expect(result).toBe(false);
    });
  });

  // ── findBySessionId ──

  describe('findBySessionId', () => {
    it('should return mock exam id when found', async () => {
      mockSupabase.setSingleResponse({ id: 'mock-exam-001' });

      const result = await repo.findBySessionId('session-001');

      expect(result).toBe('mock-exam-001');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('session_id', 'session-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabase.client._chain.limit).toHaveBeenCalledWith(1);
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findBySessionId('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findBySessionId('session-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findBySessionId('session-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findBySessionId('session-001')).rejects.toThrow(
        'Failed to fetch mock exam by session',
      );
    });
  });

  // ── findByUserId ──

  describe('findByUserId', () => {
    it('should return mapped mock exam entities', async () => {
      mockSupabase.setQueryResponse([mockExamRow, completedMockExamRow]);

      const result = await repo.findByUserId('user-free-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockExamEntity);
      expect(result[1].id).toBe('mock-exam-002');
      expect(result[1].status).toBe('completed');
      expect(result[1].score).toBe(15);
    });

    it('should use default pagination (limit=20, offset=0)', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByUserId('user-free-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabase.client._chain.range).toHaveBeenCalledWith(0, 19);
    });

    it('should apply custom limit and offset', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByUserId('user-free-001', 10, 20);

      expect(mockSupabase.client._chain.range).toHaveBeenCalledWith(20, 29);
    });

    it('should return empty array when no mock exams exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByUserId('user-free-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByUserId('user-free-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findByUserId('user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findByUserId('user-free-001')).rejects.toThrow(
        'Failed to fetch mock exam history',
      );
    });
  });

  // ── countByUserAndPaper ──

  describe('countByUserAndPaper', () => {
    it('should return count when found', async () => {
      // The count query returns { count, data, error } structure.
      // Our mock resolves with { data, error } but the repo reads `count` from the response.
      // We need to set the response so that `count` is available at the top level.
      mockSupabase.setResponse(null);
      // Override: countByUserAndPaper reads `count` not `data` from the response.
      // The mock chain resolves to { data: null, error: null }.
      // We need to also include `count` in the response.
      // The mock's chain.then resolves { data, error }. The real Supabase returns { data, error, count }.
      // Let's directly set the response to include count field.
      mockSupabase.client._chain.then.mockImplementation((resolve: (v: unknown) => void) => {
        return Promise.resolve({ data: null, error: null, count: 5 }).then(resolve);
      });

      const result = await repo.countByUserAndPaper('user-free-001', 'paper-001');

      expect(result).toBe(5);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('paper_id', 'paper-001');
    });

    it('should return 0 when count is null', async () => {
      mockSupabase.client._chain.then.mockImplementation((resolve: (v: unknown) => void) => {
        return Promise.resolve({ data: null, error: null, count: null }).then(resolve);
      });

      const result = await repo.countByUserAndPaper('user-free-001', 'paper-001');

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.client._chain.then.mockImplementation((resolve: (v: unknown) => void) => {
        return Promise.resolve({
          data: null,
          error: dbError('Count failed'),
          count: null,
        }).then(resolve);
      });

      await expect(repo.countByUserAndPaper('user-free-001', 'paper-001')).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.countByUserAndPaper('user-free-001', 'paper-001')).rejects.toThrow(
        'Failed to count mock exams',
      );
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update responses', async () => {
      mockSupabase.setResponse(null);

      const newResponses = [...mockExamResponses, { questionIndex: 1, userAnswer: 'test' }];
      await repo.update('mock-exam-001', {
        responses: newResponses as unknown as import('@/types/database').Json,
      });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('mock_exams');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        responses: newResponses,
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'mock-exam-001');
    });

    it('should update currentIndex', async () => {
      mockSupabase.setResponse(null);

      await repo.update('mock-exam-001', { currentIndex: 2 });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        current_index: 2,
      });
    });

    it('should update score', async () => {
      mockSupabase.setResponse(null);

      await repo.update('mock-exam-001', { score: 15 });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        score: 15,
      });
    });

    it('should update status', async () => {
      mockSupabase.setResponse(null);

      await repo.update('mock-exam-001', { status: 'completed' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        status: 'completed',
      });
    });

    it('should update multiple fields at once', async () => {
      mockSupabase.setResponse(null);

      await repo.update('mock-exam-001', {
        score: 15,
        status: 'completed',
        currentIndex: 2,
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        score: 15,
        status: 'completed',
        current_index: 2,
      });
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('mock-exam-001', { score: 15 })).rejects.toThrow(DatabaseError);
      await expect(repo.update('mock-exam-001', { score: 15 })).rejects.toThrow(
        'Failed to update mock exam',
      );
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(mockExamRow);

      const result = await repo.findById('mock-exam-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockExamRow.id);
      expect(result!.userId).toBe(mockExamRow.user_id);
      expect(result!.paperId).toBe(mockExamRow.paper_id);
      expect(result!.title).toBe(mockExamRow.title);
      expect(result!.questions).toEqual(mockExamRow.questions);
      expect(result!.responses).toEqual(mockExamRow.responses);
      expect(result!.score).toBe(mockExamRow.score);
      expect(result!.totalPoints).toBe(mockExamRow.total_points);
      expect(result!.currentIndex).toBe(mockExamRow.current_index);
      expect(result!.status).toBe(mockExamRow.status);
      expect(result!.createdAt).toBe(mockExamRow.created_at);
    });

    it('should handle completed mock exam with score', async () => {
      mockSupabase.setSingleResponse(completedMockExamRow);

      const result = await repo.findById('mock-exam-002');

      expect(result).not.toBeNull();
      expect(result!.score).toBe(15);
      expect(result!.status).toBe('completed');
      expect(result!.currentIndex).toBe(2);
      expect(result!.responses).toHaveLength(2);
    });

    it('should handle null score for in-progress exam', async () => {
      mockSupabase.setSingleResponse(mockExamRow);

      const result = await repo.findById('mock-exam-001');

      expect(result!.score).toBeNull();
    });
  });
});
