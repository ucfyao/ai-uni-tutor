/**
 * ExamPaperRepository Tests
 *
 * Tests all exam paper and question database operations including
 * entity mapping, filter queries, PGRST116 handling, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  examPaperEntity,
  examPaperRow,
  parsingExamPaperRow,
  questionEntity,
  questionRow,
  shortAnswerQuestionRow,
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
const { ExamPaperRepository } = await import('./ExamPaperRepository');

describe('ExamPaperRepository', () => {
  let repo: InstanceType<typeof ExamPaperRepository>;

  beforeEach(() => {
    repo = new ExamPaperRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──

  describe('create', () => {
    it('should create an exam paper and return its id', async () => {
      mockSupabase.setSingleResponse({ id: 'paper-001' });

      const result = await repo.create({
        userId: 'user-free-001',
        title: 'CS101 Midterm 2025',
        school: 'School of Computing',
        course: 'CS101',
        year: '2025',
        visibility: 'private',
        status: 'ready',
        questionTypes: ['mcq', 'short_answer'],
      });

      expect(result).toBe('paper-001');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-free-001',
        title: 'CS101 Midterm 2025',
        school: 'School of Computing',
        course: 'CS101',
        course_id: null,
        year: '2025',
        visibility: 'private',
        status: 'ready',
        question_types: ['mcq', 'short_answer'],
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should use default values for optional fields', async () => {
      mockSupabase.setSingleResponse({ id: 'paper-002' });

      await repo.create({
        userId: 'user-free-001',
        title: 'Minimal Paper',
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-free-001',
        title: 'Minimal Paper',
        school: null,
        course: null,
        course_id: null,
        year: null,
        visibility: 'private',
        status: 'parsing',
        question_types: [],
      });
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(repo.create({ userId: 'user-free-001', title: 'Test' })).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.create({ userId: 'user-free-001', title: 'Test' })).rejects.toThrow(
        'Failed to create exam paper record',
      );
    });

    it('should throw DatabaseError when data is null without error', async () => {
      mockSupabase.setSingleResponse(null);

      await expect(repo.create({ userId: 'user-free-001', title: 'Test' })).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a paper entity when found', async () => {
      mockSupabase.setSingleResponse(examPaperRow);

      const result = await repo.findById('paper-001');

      expect(result).toEqual(examPaperEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'paper-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('paper-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findById('paper-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('paper-001')).rejects.toThrow('Failed to fetch exam paper');
    });
  });

  // ── findWithFilters ──

  describe('findWithFilters', () => {
    it('should return papers with question counts', async () => {
      const rowWithCount = {
        ...examPaperRow,
        exam_questions: [{ count: 10 }],
      };
      mockSupabase.setQueryResponse([rowWithCount]);

      const result = await repo.findWithFilters();

      expect(result).toHaveLength(1);
      expect(result[0].questionCount).toBe(10);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*, exam_questions(count)');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('status', 'ready');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should apply school filter', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findWithFilters({ school: 'School of Computing' });

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('school', 'School of Computing');
    });

    it('should apply course filter', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findWithFilters({ course: 'CS101' });

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('course', 'CS101');
    });

    it('should apply year filter', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findWithFilters({ year: '2025' });

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('year', '2025');
    });

    it('should apply all filters together', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findWithFilters({
        school: 'School of Computing',
        course: 'CS101',
        year: '2025',
      });

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('school', 'School of Computing');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('course', 'CS101');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('year', '2025');
    });

    it('should return empty array when no papers match', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findWithFilters({ school: 'Unknown' });

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findWithFilters();

      expect(result).toEqual([]);
    });

    it('should default questionCount to 0 when exam_questions is missing', async () => {
      mockSupabase.setQueryResponse([{ ...examPaperRow, exam_questions: undefined }]);

      const result = await repo.findWithFilters();

      expect(result[0].questionCount).toBe(0);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findWithFilters()).rejects.toThrow(DatabaseError);
      await expect(repo.findWithFilters()).rejects.toThrow('Failed to fetch papers');
    });
  });

  // ── findOwner ──

  describe('findOwner', () => {
    it('should return the owner user_id', async () => {
      mockSupabase.setSingleResponse({ user_id: 'user-free-001' });

      const result = await repo.findOwner('paper-001');

      expect(result).toBe('user-free-001');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('user_id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'paper-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when paper not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findOwner('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findOwner('paper-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findOwner('paper-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findOwner('paper-001')).rejects.toThrow('Failed to fetch paper owner');
    });
  });

  // ── updateStatus ──

  describe('updateStatus', () => {
    it('should update status only', async () => {
      mockSupabase.setResponse(null);

      await repo.updateStatus('paper-001', 'ready');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ status: 'ready' });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'paper-001');
    });

    it('should include statusMessage when provided', async () => {
      mockSupabase.setResponse(null);

      await repo.updateStatus('paper-001', 'error', 'Parse failed');

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        status: 'error',
        status_message: 'Parse failed',
      });
    });

    it('should not include status_message when statusMessage is undefined', async () => {
      mockSupabase.setResponse(null);

      await repo.updateStatus('paper-001', 'ready');

      const updateArg = mockSupabase.client._chain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('status_message');
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateStatus('paper-001', 'ready')).rejects.toThrow(DatabaseError);
      await expect(repo.updateStatus('paper-001', 'ready')).rejects.toThrow(
        'Failed to update paper status',
      );
    });
  });

  // ── updatePaper ──

  describe('updatePaper', () => {
    it('should update title', async () => {
      mockSupabase.setResponse(null);

      await repo.updatePaper('paper-001', { title: 'New Title' });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ title: 'New Title' });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'paper-001');
    });

    it('should map questionTypes to question_types', async () => {
      mockSupabase.setResponse(null);

      await repo.updatePaper('paper-001', { questionTypes: ['mcq', 'essay'] });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        question_types: ['mcq', 'essay'],
      });
    });

    it('should update both title and questionTypes', async () => {
      mockSupabase.setResponse(null);

      await repo.updatePaper('paper-001', {
        title: 'Updated',
        questionTypes: ['mcq'],
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        title: 'Updated',
        question_types: ['mcq'],
      });
    });

    it('should return early without calling supabase when no fields provided', async () => {
      await repo.updatePaper('paper-001', {});

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updatePaper('paper-001', { title: 'New' })).rejects.toThrow(DatabaseError);
      await expect(repo.updatePaper('paper-001', { title: 'New' })).rejects.toThrow(
        'Failed to update paper',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a paper by id', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('paper-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'paper-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('paper-001')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('paper-001')).rejects.toThrow('Failed to delete paper');
    });
  });

  // ── insertQuestions ──

  describe('insertQuestions', () => {
    it('should insert questions with snake_case mapping', async () => {
      mockSupabase.setResponse(null);

      const questions = [
        {
          paperId: 'paper-001',
          orderNum: 1,
          type: 'mcq',
          content: 'What is O(1)?',
          options: { A: 'Constant', B: 'Linear' } as Record<string, string>,
          answer: 'A',
          explanation: 'Constant time.',
          points: 5,
          metadata: { difficulty: 'easy' } as Record<string, unknown>,
        },
      ];

      await repo.insertQuestions(questions);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_questions');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith([
        {
          paper_id: 'paper-001',
          order_num: 1,
          type: 'mcq',
          content: 'What is O(1)?',
          options: { A: 'Constant', B: 'Linear' },
          answer: 'A',
          explanation: 'Constant time.',
          points: 5,
          metadata: { difficulty: 'easy' },
        },
      ]);
    });

    it('should handle null options', async () => {
      mockSupabase.setResponse(null);

      const questions = [
        {
          paperId: 'paper-001',
          orderNum: 1,
          type: 'short_answer',
          content: 'Explain stacks.',
          options: null,
          answer: 'LIFO structure',
          explanation: 'Last in first out.',
          points: 10,
          metadata: {} as Record<string, unknown>,
        },
      ];

      await repo.insertQuestions(questions);

      const insertArg = mockSupabase.client._chain.insert.mock.calls[0][0];
      expect(insertArg[0].options).toBeNull();
    });

    it('should insert multiple questions at once', async () => {
      mockSupabase.setResponse(null);

      const questions = [
        {
          paperId: 'paper-001',
          orderNum: 1,
          type: 'mcq',
          content: 'Q1',
          options: { A: 'a' } as Record<string, string>,
          answer: 'A',
          explanation: 'E1',
          points: 5,
          metadata: {} as Record<string, unknown>,
        },
        {
          paperId: 'paper-001',
          orderNum: 2,
          type: 'short_answer',
          content: 'Q2',
          options: null,
          answer: 'A2',
          explanation: 'E2',
          points: 10,
          metadata: {} as Record<string, unknown>,
        },
      ];

      await repo.insertQuestions(questions);

      const insertArg = mockSupabase.client._chain.insert.mock.calls[0][0];
      expect(insertArg).toHaveLength(2);
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const questions = [
        {
          paperId: 'paper-001',
          orderNum: 1,
          type: 'mcq',
          content: 'Q1',
          options: null,
          answer: 'A',
          explanation: 'E1',
          points: 5,
          metadata: {} as Record<string, unknown>,
        },
      ];

      await expect(repo.insertQuestions(questions)).rejects.toThrow(DatabaseError);
      await expect(repo.insertQuestions(questions)).rejects.toThrow('Failed to insert questions');
    });
  });

  // ── findQuestionsByPaperId ──

  describe('findQuestionsByPaperId', () => {
    it('should return mapped question entities', async () => {
      mockSupabase.setQueryResponse([questionRow, shortAnswerQuestionRow]);

      const result = await repo.findQuestionsByPaperId('paper-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(questionEntity);
      expect(result[1].id).toBe('question-002');
      expect(result[1].paperId).toBe('paper-001');
      expect(result[1].type).toBe('short_answer');
      expect(result[1].options).toBeNull();
    });

    it('should call with correct query params', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findQuestionsByPaperId('paper-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_questions');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('paper_id', 'paper-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('order_num', {
        ascending: true,
      });
    });

    it('should return empty array when no questions exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findQuestionsByPaperId('paper-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findQuestionsByPaperId('paper-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findQuestionsByPaperId('paper-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findQuestionsByPaperId('paper-001')).rejects.toThrow(
        'Failed to fetch questions',
      );
    });
  });

  // ── updateQuestion ──

  describe('updateQuestion', () => {
    it('should update content field', async () => {
      mockSupabase.setResponse(null);

      await repo.updateQuestion('question-001', { content: 'Updated question' });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_questions');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        content: 'Updated question',
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'question-001');
    });

    it('should update multiple fields at once', async () => {
      mockSupabase.setResponse(null);

      await repo.updateQuestion('question-001', {
        content: 'New content',
        answer: 'C',
        points: 10,
        type: 'essay',
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        content: 'New content',
        answer: 'C',
        points: 10,
        type: 'essay',
      });
    });

    it('should update options', async () => {
      mockSupabase.setResponse(null);

      await repo.updateQuestion('question-001', {
        options: { A: 'New A', B: 'New B' },
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        options: { A: 'New A', B: 'New B' },
      });
    });

    it('should update explanation', async () => {
      mockSupabase.setResponse(null);

      await repo.updateQuestion('question-001', { explanation: 'New explanation' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        explanation: 'New explanation',
      });
    });

    it('should return early without calling supabase when no fields provided', async () => {
      await repo.updateQuestion('question-001', {});

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateQuestion('question-001', { content: 'New' })).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.updateQuestion('question-001', { content: 'New' })).rejects.toThrow(
        'Failed to update question',
      );
    });
  });

  // ── findByCourse ──

  describe('findByCourse', () => {
    it('should return paper id when found', async () => {
      mockSupabase.setQueryResponse([{ id: 'paper-001' }]);

      const result = await repo.findByCourse('CS101');

      expect(result).toBe('paper-001');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('exam_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.ilike).toHaveBeenCalledWith('course', '%CS101%');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('status', 'ready');
      expect(mockSupabase.client._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should sanitize courseCode to prevent filter injection', async () => {
      const maliciousCode = 'CS101,id.eq.some-uuid';
      const result = await repo.findByCourse(maliciousCode);

      // Sanitized to 'CS101ideqsome-uuid' (commas and dots stripped)
      expect(mockSupabase.client._chain.ilike).toHaveBeenCalledWith(
        'course',
        '%CS101ideqsome-uuid%',
      );
    });

    it('should return null for courseCode that sanitizes to empty string', async () => {
      const result = await repo.findByCourse('!!!@@@###');

      expect(result).toBeNull();
      // Should not even call supabase
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should return null when no papers found', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByCourse('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByCourse('CS101');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findByCourse('CS101')).rejects.toThrow(DatabaseError);
      await expect(repo.findByCourse('CS101')).rejects.toThrow('Failed to find exam papers');
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case paper row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(examPaperRow);

      const result = await repo.findById('paper-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(examPaperRow.id);
      expect(result!.userId).toBe(examPaperRow.user_id);
      expect(result!.documentId).toBe(examPaperRow.document_id);
      expect(result!.title).toBe(examPaperRow.title);
      expect(result!.visibility).toBe(examPaperRow.visibility);
      expect(result!.school).toBe(examPaperRow.school);
      expect(result!.course).toBe(examPaperRow.course);
      expect(result!.year).toBe(examPaperRow.year);
      expect(result!.questionTypes).toEqual(examPaperRow.question_types);
      expect(result!.status).toBe(examPaperRow.status);
      expect(result!.statusMessage).toBe(examPaperRow.status_message);
      expect(result!.createdAt).toBe(examPaperRow.created_at);
    });

    it('should convert snake_case question row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([questionRow]);

      const result = await repo.findQuestionsByPaperId('paper-001');

      expect(result[0].id).toBe(questionRow.id);
      expect(result[0].paperId).toBe(questionRow.paper_id);
      expect(result[0].orderNum).toBe(questionRow.order_num);
      expect(result[0].type).toBe(questionRow.type);
      expect(result[0].content).toBe(questionRow.content);
      expect(result[0].options).toEqual(questionRow.options);
      expect(result[0].answer).toBe(questionRow.answer);
      expect(result[0].explanation).toBe(questionRow.explanation);
      expect(result[0].points).toBe(questionRow.points);
      expect(result[0].metadata).toEqual(questionRow.metadata);
    });

    it('should handle null optional fields in paper row', async () => {
      const nullFieldsRow = {
        ...examPaperRow,
        document_id: null,
        school: null,
        course: null,
        year: null,
        status_message: null,
        question_types: null,
      };
      mockSupabase.setSingleResponse(nullFieldsRow);

      const result = await repo.findById('paper-001');

      expect(result).not.toBeNull();
      expect(result!.documentId).toBeNull();
      expect(result!.school).toBeNull();
      expect(result!.course).toBeNull();
      expect(result!.year).toBeNull();
      expect(result!.statusMessage).toBeNull();
      expect(result!.questionTypes).toEqual([]);
    });
  });
});
