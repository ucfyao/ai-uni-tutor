import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaExceededError } from '@/lib/errors';
import type { BatchSubmitResult, MockExam, MockExamResponse } from '@/types/exam';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockMockExamService = {
  startFromCourse: vi.fn(),
  generateFromTopic: vi.fn(),
  generateMock: vi.fn(),
  submitAnswer: vi.fn(),
  batchSubmitAnswers: vi.fn(),
  getMockIdBySessionId: vi.fn(),
  getMock: vi.fn(),
  getHistory: vi.fn(),
};
vi.mock('@/lib/services/MockExamService', () => ({
  getMockExamService: () => mockMockExamService,
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks are registered)
// ---------------------------------------------------------------------------

const {
  startMockExamSession,
  generateMockFromTopic,
  generateMockExam,
  submitMockAnswer,
  batchSubmitMockAnswers,
  getMockExamIdBySessionId,
  getMockExamDetail,
  getMockExamList,
} = await import('./mock-exams');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function makeMockExam(overrides: Partial<MockExam> = {}): MockExam {
  return {
    id: 'mock-1',
    userId: 'user-1',
    paperId: 'paper-1',
    title: 'Mock Exam',
    questions: [],
    responses: [],
    score: null,
    totalPoints: 100,
    currentIndex: 0,
    status: 'in_progress',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeFeedback(overrides: Partial<MockExamResponse> = {}): MockExamResponse {
  return {
    questionIndex: 0,
    userAnswer: 'A',
    isCorrect: true,
    score: 10,
    aiFeedback: 'Correct!',
    ...overrides,
  };
}

function makeBatchResult(overrides: Partial<BatchSubmitResult> = {}): BatchSubmitResult {
  return {
    responses: [makeFeedback()],
    score: 80,
    totalPoints: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mock Exam Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
  });

  // =========================================================================
  // startMockExamSession
  // =========================================================================
  describe('startMockExamSession', () => {
    it('should start a mock exam session successfully', async () => {
      mockMockExamService.startFromCourse.mockResolvedValue({ mockId: 'mock-1' });

      const result = await startMockExamSession('sess-1', 'CS101');

      expect(result).toEqual({ success: true, mockId: 'mock-1' });
      expect(mockMockExamService.startFromCourse).toHaveBeenCalledWith('user-1', 'sess-1', 'CS101');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam/history');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await startMockExamSession('sess-1', 'CS101');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(mockMockExamService.startFromCourse).not.toHaveBeenCalled();
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await startMockExamSession('sess-1', 'CS101');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('exceeded');
      }
      expect(mockMockExamService.startFromCourse).not.toHaveBeenCalled();
    });

    it('should enforce quota before starting session', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(5, 5));

      await startMockExamSession('sess-1', 'CS101');

      expect(mockQuotaService.enforce).toHaveBeenCalledWith('user-1');
      expect(mockMockExamService.startFromCourse).not.toHaveBeenCalled();
    });

    it('should handle service errors with Error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.startFromCourse.mockRejectedValue(new Error('No exam paper found'));

      const result = await startMockExamSession('sess-1', 'CS101');

      expect(result).toEqual({ success: false, error: 'No exam paper found' });
    });

    it('should handle non-Error thrown objects with fallback message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.startFromCourse.mockRejectedValue('string error');

      const result = await startMockExamSession('sess-1', 'CS101');

      expect(result).toEqual({ success: false, error: 'Failed to start mock exam' });
    });
  });

  // =========================================================================
  // generateMockFromTopic
  // =========================================================================
  describe('generateMockFromTopic', () => {
    it('should generate mock from topic successfully', async () => {
      mockMockExamService.generateFromTopic.mockResolvedValue({ mockId: 'mock-2' });

      const result = await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(result).toEqual({ success: true, mockId: 'mock-2' });
      expect(mockMockExamService.generateFromTopic).toHaveBeenCalledWith('user-1', {
        topic: 'Recursion',
        numQuestions: 10,
        difficulty: 'medium',
        questionTypes: ['choice'],
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam/history');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error for empty topic', async () => {
      const result = await generateMockFromTopic('', 10, 'medium', ['choice']);

      expect(result).toEqual({ success: false, error: 'Topic is required' });
    });

    it('should return error for whitespace-only topic', async () => {
      const result = await generateMockFromTopic('   ', 10, 'medium', ['choice']);

      expect(result).toEqual({ success: false, error: 'Topic is required' });
    });

    it('should return error for invalid number of questions (7)', async () => {
      const result = await generateMockFromTopic('Recursion', 7, 'medium', ['choice']);

      expect(result).toEqual({
        success: false,
        error: 'Number of questions must be 5, 10, 15, or 20',
      });
    });

    it('should accept valid number of questions (5)', async () => {
      mockMockExamService.generateFromTopic.mockResolvedValue({ mockId: 'mock-3' });

      const result = await generateMockFromTopic('Recursion', 5, 'easy', ['choice']);

      expect(result.success).toBe(true);
    });

    it('should accept valid number of questions (15)', async () => {
      mockMockExamService.generateFromTopic.mockResolvedValue({ mockId: 'mock-3' });

      const result = await generateMockFromTopic('Recursion', 15, 'hard', ['choice']);

      expect(result.success).toBe(true);
    });

    it('should accept valid number of questions (20)', async () => {
      mockMockExamService.generateFromTopic.mockResolvedValue({ mockId: 'mock-3' });

      const result = await generateMockFromTopic('Recursion', 20, 'mixed', ['choice']);

      expect(result.success).toBe(true);
    });

    it('should return error for invalid difficulty level', async () => {
      const result = await generateMockFromTopic(
        'Recursion',
        10,
        'impossible' as 'easy' | 'medium' | 'hard' | 'mixed',
        ['choice'],
      );

      expect(result).toEqual({ success: false, error: 'Invalid difficulty level' });
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('exceeded');
      }
    });

    it('should enforce quota before generating mock', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(5, 5));

      await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(mockQuotaService.enforce).toHaveBeenCalledWith('user-1');
      expect(mockMockExamService.generateFromTopic).not.toHaveBeenCalled();
    });

    it('should trim topic before passing to service', async () => {
      mockMockExamService.generateFromTopic.mockResolvedValue({ mockId: 'mock-4' });

      await generateMockFromTopic('  Recursion  ', 10, 'medium', ['choice']);

      expect(mockMockExamService.generateFromTopic).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ topic: 'Recursion' }),
      );
    });

    it('should handle service errors with Error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.generateFromTopic.mockRejectedValue(new Error('AI generation failed'));

      const result = await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(result).toEqual({ success: false, error: 'AI generation failed' });
    });

    it('should handle non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.generateFromTopic.mockRejectedValue('string error');

      const result = await generateMockFromTopic('Recursion', 10, 'medium', ['choice']);

      expect(result).toEqual({
        success: false,
        error: 'Failed to generate mock exam from topic',
      });
    });
  });

  // =========================================================================
  // generateMockExam
  // =========================================================================
  describe('generateMockExam', () => {
    it('should generate mock exam from paper successfully', async () => {
      mockMockExamService.generateMock.mockResolvedValue({ mockId: 'mock-5' });

      const result = await generateMockExam('paper-1');

      expect(result).toEqual({ success: true, mockId: 'mock-5' });
      expect(mockMockExamService.generateMock).toHaveBeenCalledWith('user-1', 'paper-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam/history');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await generateMockExam('paper-1');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const result = await generateMockExam('paper-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('exceeded');
      }
    });

    it('should enforce quota before generating mock', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(5, 5));

      await generateMockExam('paper-1');

      expect(mockQuotaService.enforce).toHaveBeenCalledWith('user-1');
      expect(mockMockExamService.generateMock).not.toHaveBeenCalled();
    });

    it('should handle service errors with Error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.generateMock.mockRejectedValue(new Error('Paper not found'));

      const result = await generateMockExam('paper-1');

      expect(result).toEqual({ success: false, error: 'Paper not found' });
    });

    it('should handle non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.generateMock.mockRejectedValue('string error');

      const result = await generateMockExam('paper-1');

      expect(result).toEqual({ success: false, error: 'Failed to generate mock exam' });
    });
  });

  // =========================================================================
  // submitMockAnswer
  // =========================================================================
  describe('submitMockAnswer', () => {
    it('should submit answer and return feedback successfully', async () => {
      const feedback = makeFeedback();
      mockMockExamService.submitAnswer.mockResolvedValue(feedback);

      const result = await submitMockAnswer('mock-1', 0, 'A');

      expect(result).toEqual({ success: true, feedback });
      expect(mockMockExamService.submitAnswer).toHaveBeenCalledWith('user-1', 'mock-1', 0, 'A');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await submitMockAnswer('mock-1', 0, 'A');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(mockMockExamService.submitAnswer).not.toHaveBeenCalled();
    });

    it('should handle service errors with Error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.submitAnswer.mockRejectedValue(new Error('Invalid question index'));

      const result = await submitMockAnswer('mock-1', 99, 'A');

      expect(result).toEqual({ success: false, error: 'Invalid question index' });
    });

    it('should handle non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.submitAnswer.mockRejectedValue('string error');

      const result = await submitMockAnswer('mock-1', 0, 'A');

      expect(result).toEqual({ success: false, error: 'Failed to submit answer' });
    });
  });

  // =========================================================================
  // batchSubmitMockAnswers
  // =========================================================================
  describe('batchSubmitMockAnswers', () => {
    const ANSWERS = [
      { questionIndex: 0, userAnswer: 'A' },
      { questionIndex: 1, userAnswer: 'B' },
    ];

    it('should batch submit answers and return result', async () => {
      const batchResult = makeBatchResult();
      mockMockExamService.batchSubmitAnswers.mockResolvedValue(batchResult);

      const result = await batchSubmitMockAnswers('mock-1', ANSWERS);

      expect(result).toEqual({ success: true, result: batchResult });
      expect(mockMockExamService.batchSubmitAnswers).toHaveBeenCalledWith(
        'user-1',
        'mock-1',
        ANSWERS,
      );
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await batchSubmitMockAnswers('mock-1', ANSWERS);

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
      expect(mockMockExamService.batchSubmitAnswers).not.toHaveBeenCalled();
    });

    it('should handle service errors with Error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.batchSubmitAnswers.mockRejectedValue(new Error('Exam already completed'));

      const result = await batchSubmitMockAnswers('mock-1', ANSWERS);

      expect(result).toEqual({ success: false, error: 'Exam already completed' });
    });

    it('should handle non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockMockExamService.batchSubmitAnswers.mockRejectedValue('string error');

      const result = await batchSubmitMockAnswers('mock-1', ANSWERS);

      expect(result).toEqual({ success: false, error: 'Failed to batch submit answers' });
    });
  });

  // =========================================================================
  // getMockExamIdBySessionId
  // =========================================================================
  describe('getMockExamIdBySessionId', () => {
    it('should return mock ID for valid session', async () => {
      mockMockExamService.getMockIdBySessionId.mockResolvedValue('mock-1');

      const result = await getMockExamIdBySessionId('sess-1');

      expect(result).toBe('mock-1');
      expect(mockMockExamService.getMockIdBySessionId).toHaveBeenCalledWith('sess-1');
    });

    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getMockExamIdBySessionId('sess-1');

      expect(result).toBeNull();
      expect(mockMockExamService.getMockIdBySessionId).not.toHaveBeenCalled();
    });

    it('should return null when no mock is linked to session', async () => {
      mockMockExamService.getMockIdBySessionId.mockResolvedValue(null);

      const result = await getMockExamIdBySessionId('sess-nonexistent');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getMockExamDetail
  // =========================================================================
  describe('getMockExamDetail', () => {
    it('should return mock exam detail for authenticated user', async () => {
      const exam = makeMockExam();
      mockMockExamService.getMock.mockResolvedValue(exam);

      const result = await getMockExamDetail('mock-1');

      expect(result).toEqual(exam);
      expect(mockMockExamService.getMock).toHaveBeenCalledWith('user-1', 'mock-1');
    });

    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getMockExamDetail('mock-1');

      expect(result).toBeNull();
      expect(mockMockExamService.getMock).not.toHaveBeenCalled();
    });

    it('should return null when mock exam is not found', async () => {
      mockMockExamService.getMock.mockResolvedValue(null);

      const result = await getMockExamDetail('nonexistent');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getMockExamList
  // =========================================================================
  describe('getMockExamList', () => {
    it('should return list of mock exams for authenticated user', async () => {
      const exams = [makeMockExam({ id: 'mock-1' }), makeMockExam({ id: 'mock-2' })];
      mockMockExamService.getHistory.mockResolvedValue(exams);

      const result = await getMockExamList();

      expect(result).toEqual(exams);
      expect(mockMockExamService.getHistory).toHaveBeenCalledWith('user-1');
    });

    it('should return empty array when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getMockExamList();

      expect(result).toEqual([]);
      expect(mockMockExamService.getHistory).not.toHaveBeenCalled();
    });

    it('should return empty array when no mock exams exist', async () => {
      mockMockExamService.getHistory.mockResolvedValue([]);

      const result = await getMockExamList();

      expect(result).toEqual([]);
    });
  });
});
