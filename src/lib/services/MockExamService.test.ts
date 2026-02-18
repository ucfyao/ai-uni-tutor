import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { MockExamRepository } from '@/lib/repositories/MockExamRepository';
import type { ExamPaper, ExamQuestion, MockExam, MockExamQuestion } from '@/types/exam';
import { MockExamService } from './MockExamService';

// ---------- Module mocks ----------

vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: {
    chat: 'gemini-2.5-flash',
    parse: 'gemini-2.0-flash',
    embedding: 'gemini-embedding-001',
  },
  getGenAI: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const geminiModule = await vi.importMock<typeof import('@/lib/gemini')>('@/lib/gemini');

// ---------- Mock repositories ----------

function createMockMockExamRepo(): {
  [K in keyof MockExamRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    verifyOwnership: vi.fn(),
    findBySessionId: vi.fn(),
    findByUserId: vi.fn(),
    countByUserAndPaper: vi.fn(),
    update: vi.fn(),
  };
}

function createMockPaperRepo(): {
  [K in keyof ExamPaperRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findWithFilters: vi.fn(),
    findOwner: vi.fn(),
    updateStatus: vi.fn(),
    updatePaper: vi.fn(),
    delete: vi.fn(),
    insertQuestions: vi.fn(),
    findQuestionsByPaperId: vi.fn(),
    updateQuestion: vi.fn(),
    findByUserId: vi.fn(),
    deleteQuestion: vi.fn(),
    findByCourse: vi.fn(),
    findAllByCourse: vi.fn(),
    findAllForAdmin: vi.fn(),
    findCourseId: vi.fn(),
    findByCourseIds: vi.fn(),
  };
}

// ---------- Test data ----------

const USER_ID = 'user-mock-001';
const PAPER_ID = 'paper-mock-001';
const MOCK_ID = 'mock-001';
const SESSION_ID = 'session-001';

const PAPER: ExamPaper = {
  id: PAPER_ID,
  userId: USER_ID,
  documentId: null,
  title: 'Calculus Final',
  visibility: 'private',
  school: null,
  course: 'CALC101',
  courseId: null,
  year: '2024',
  questionTypes: ['choice', 'short_answer'],
  status: 'ready',
  statusMessage: null,
  createdAt: '2025-01-01T00:00:00Z',
};

const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 'eq1',
    paperId: PAPER_ID,
    orderNum: 1,
    type: 'choice',
    content: 'What is the derivative of x^2?',
    options: { A: 'x', B: '2x', C: 'x^2', D: '2' },
    answer: 'B',
    explanation: 'd/dx(x^2) = 2x',
    points: 5,
    metadata: { knowledge_point: 'derivatives', difficulty: 'easy' },
  },
  {
    id: 'eq2',
    paperId: PAPER_ID,
    orderNum: 2,
    type: 'short_answer',
    content: 'Evaluate the integral of sin(x)dx.',
    options: null,
    answer: '-cos(x) + C',
    explanation: 'The antiderivative of sin(x) is -cos(x).',
    points: 10,
    metadata: { knowledge_point: 'integrals', difficulty: 'medium' },
  },
];

const MOCK_QUESTIONS: MockExamQuestion[] = [
  {
    content: 'What is the derivative of x^3?',
    type: 'choice',
    options: { A: '3x', B: '3x^2', C: 'x^3', D: '3' },
    answer: 'B',
    explanation: 'd/dx(x^3) = 3x^2',
    points: 5,
    sourceQuestionId: 'eq1',
  },
  {
    content: 'Evaluate the integral of cos(x)dx.',
    type: 'short_answer',
    options: null,
    answer: 'sin(x) + C',
    explanation: 'The antiderivative of cos(x) is sin(x).',
    points: 10,
    sourceQuestionId: 'eq2',
  },
];

const MOCK_EXAM: MockExam = {
  id: MOCK_ID,
  userId: USER_ID,
  paperId: PAPER_ID,
  mode: 'practice',
  title: 'Calculus Final #1',
  questions: MOCK_QUESTIONS,
  responses: [],
  score: null,
  totalPoints: 15,
  currentIndex: 0,
  status: 'in_progress',
  createdAt: '2025-01-01T00:00:00Z',
};

// ---------- AI mock helper ----------

function mockAI(responseText: string) {
  const generateContent = vi.fn().mockResolvedValue({ text: responseText });
  vi.mocked(geminiModule.getGenAI).mockReturnValue({
    models: { generateContent },
  } as unknown as ReturnType<typeof geminiModule.getGenAI>);
  return generateContent;
}

function mockAISequence(responses: string[]) {
  const generateContent = vi.fn();
  for (const text of responses) {
    generateContent.mockResolvedValueOnce({ text });
  }
  vi.mocked(geminiModule.getGenAI).mockReturnValue({
    models: { generateContent },
  } as unknown as ReturnType<typeof geminiModule.getGenAI>);
  return generateContent;
}

// ---------- Tests ----------

describe('MockExamService', () => {
  let service: MockExamService;
  let mockRepo: ReturnType<typeof createMockMockExamRepo>;
  let paperRepo: ReturnType<typeof createMockPaperRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = createMockMockExamRepo();
    paperRepo = createMockPaperRepo();
    service = new MockExamService(
      mockRepo as unknown as MockExamRepository,
      paperRepo as unknown as ExamPaperRepository,
    );
  });

  // ==================== generateFromTopic ====================

  describe('generateFromTopic', () => {
    const topicOptions = {
      topic: 'Linear Algebra',
      numQuestions: 5,
      difficulty: 'medium' as const,
      questionTypes: ['choice', 'short_answer'],
    };

    it('should generate questions from AI, create paper, insert questions, and create mock', async () => {
      const aiResponse = JSON.stringify({
        title: 'Linear Algebra - Practice Exam',
        questions: [
          {
            order_num: 1,
            type: 'choice',
            content: 'What is det(I)?',
            options: { A: '0', B: '1', C: '-1', D: 'undefined' },
            answer: 'B',
            explanation: 'det(I) = 1',
            points: 3,
            knowledge_point: 'determinants',
            difficulty: 'easy',
          },
          {
            order_num: 2,
            type: 'short_answer',
            content: 'Define eigenvalue.',
            options: null,
            answer: 'A scalar lambda such that Av = lambda*v',
            explanation: 'Eigenvalue definition.',
            points: 5,
            knowledge_point: 'eigenvalues',
            difficulty: 'medium',
          },
        ],
      });

      mockAI(aiResponse);
      paperRepo.create.mockResolvedValue('virtual-paper-id');
      paperRepo.insertQuestions.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue('new-mock-id');

      const result = await service.generateFromTopic(USER_ID, topicOptions);

      expect(result).toEqual({ mockId: 'new-mock-id' });

      // Paper created
      expect(paperRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          title: 'Linear Algebra - Practice Exam',
          course: 'Linear Algebra',
          visibility: 'private',
          status: 'ready',
        }),
      );

      // Questions inserted
      expect(paperRepo.insertQuestions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ orderNum: 1, type: 'choice' }),
          expect.objectContaining({ orderNum: 2, type: 'short_answer' }),
        ]),
      );

      // Mock exam created
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          paperId: 'virtual-paper-id',
          sessionId: null,
          title: 'Linear Algebra - Practice Exam',
          totalPoints: 8,
          currentIndex: 0,
          status: 'in_progress',
        }),
      );
    });

    it('should throw VALIDATION when AI returns no questions', async () => {
      mockAI(JSON.stringify({ title: 'Empty', questions: [] }));

      await expect(service.generateFromTopic(USER_ID, topicOptions)).rejects.toThrow(
        'AI could not generate questions for this topic',
      );
    });

    it('should throw VALIDATION when AI returns null questions', async () => {
      mockAI(JSON.stringify({ title: 'No questions' }));

      await expect(service.generateFromTopic(USER_ID, topicOptions)).rejects.toThrow(
        'AI could not generate questions for this topic',
      );
    });

    it('should use fallback title when AI returns no title', async () => {
      const aiResponse = JSON.stringify({
        questions: [
          {
            order_num: 1,
            type: 'choice',
            content: 'Q?',
            options: { A: '1' },
            answer: 'A',
            explanation: 'e',
            points: 1,
          },
        ],
      });

      mockAI(aiResponse);
      paperRepo.create.mockResolvedValue('p1');
      paperRepo.insertQuestions.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue('m1');

      await service.generateFromTopic(USER_ID, topicOptions);

      expect(paperRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Linear Algebra - Practice Exam' }),
      );
    });

    it('should handle mixed difficulty instruction', async () => {
      const mixedOptions = {
        topic: 'Physics',
        numQuestions: 3,
        difficulty: 'mixed' as const,
        questionTypes: [],
      };

      const aiResponse = JSON.stringify({
        title: 'Physics Exam',
        questions: [
          {
            order_num: 1,
            type: 'choice',
            content: 'Q?',
            options: { A: '1' },
            answer: 'A',
            explanation: 'e',
            points: 1,
          },
        ],
      });

      mockAI(aiResponse);
      paperRepo.create.mockResolvedValue('p1');
      paperRepo.insertQuestions.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue('m1');

      await service.generateFromTopic(USER_ID, mixedOptions);

      // Verify AI was called (prompt includes 'mix')
      expect(geminiModule.getGenAI).toHaveBeenCalled();
    });
  });

  // ==================== generateMock ====================

  describe('generateMock', () => {
    it('should load paper questions, generate AI variants, and create mock exam', async () => {
      paperRepo.findQuestionsByPaperId.mockResolvedValue(EXAM_QUESTIONS);
      paperRepo.findById.mockResolvedValue(PAPER);
      mockRepo.countByUserAndPaper.mockResolvedValue(0);
      mockRepo.create.mockResolvedValue(MOCK_ID);

      // Each question gets its own AI call; 2 questions = batch of 2 in one batch
      const aiCalls = EXAM_QUESTIONS.map((q) =>
        JSON.stringify({
          content: `Variant of: ${q.content}`,
          options: q.options,
          answer: q.answer,
          explanation: `Variant explanation for ${q.content}`,
        }),
      );
      mockAISequence(aiCalls);

      const result = await service.generateMock(USER_ID, PAPER_ID, 'practice');

      expect(result).toEqual({ mockId: MOCK_ID });
      expect(paperRepo.findQuestionsByPaperId).toHaveBeenCalledWith(PAPER_ID);
      expect(paperRepo.findById).toHaveBeenCalledWith(PAPER_ID);
      expect(mockRepo.countByUserAndPaper).toHaveBeenCalledWith(USER_ID, PAPER_ID);

      // Mock exam created with correct title (count=0 => #1)
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          paperId: PAPER_ID,
          title: 'Calculus Final #1',
          totalPoints: 15,
          currentIndex: 0,
          status: 'in_progress',
        }),
      );
    });

    it('should include sessionId when provided', async () => {
      paperRepo.findQuestionsByPaperId.mockResolvedValue(EXAM_QUESTIONS);
      paperRepo.findById.mockResolvedValue(PAPER);
      mockRepo.countByUserAndPaper.mockResolvedValue(2);
      mockRepo.create.mockResolvedValue(MOCK_ID);

      const aiCalls = EXAM_QUESTIONS.map((q) =>
        JSON.stringify({
          content: `Variant: ${q.content}`,
          answer: q.answer,
          explanation: 'exp',
        }),
      );
      mockAISequence(aiCalls);

      await service.generateMock(USER_ID, PAPER_ID, 'practice', SESSION_ID);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          title: 'Calculus Final #3', // count=2 => #3
        }),
      );
    });

    it('should throw NOT_FOUND when paper has no questions', async () => {
      paperRepo.findQuestionsByPaperId.mockResolvedValue([]);

      await expect(service.generateMock(USER_ID, PAPER_ID, 'practice')).rejects.toThrow(
        'No questions found for this paper',
      );
    });

    it('should throw NOT_FOUND when paper does not exist', async () => {
      paperRepo.findQuestionsByPaperId.mockResolvedValue(EXAM_QUESTIONS);
      paperRepo.findById.mockResolvedValue(null);

      await expect(service.generateMock(USER_ID, PAPER_ID, 'practice')).rejects.toThrow(
        'Paper not found',
      );
    });

    it('should fallback to original question when AI variant generation fails', async () => {
      paperRepo.findQuestionsByPaperId.mockResolvedValue([EXAM_QUESTIONS[0]]);
      paperRepo.findById.mockResolvedValue(PAPER);
      mockRepo.countByUserAndPaper.mockResolvedValue(0);
      mockRepo.create.mockResolvedValue(MOCK_ID);

      // Suppress console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // AI throws
      const generateContent = vi.fn().mockRejectedValue(new Error('AI down'));
      vi.mocked(geminiModule.getGenAI).mockReturnValue({
        models: { generateContent },
      } as unknown as ReturnType<typeof geminiModule.getGenAI>);

      const result = await service.generateMock(USER_ID, PAPER_ID, 'practice');

      expect(result).toEqual({ mockId: MOCK_ID });

      // Mock created with original question as fallback
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          questions: expect.arrayContaining([
            expect.objectContaining({
              content: EXAM_QUESTIONS[0].content,
              sourceQuestionId: EXAM_QUESTIONS[0].id,
            }),
          ]),
        }),
      );

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should process questions in batches of 3', async () => {
      // Create 5 questions
      const fiveQuestions: ExamQuestion[] = Array.from({ length: 5 }, (_, i) => ({
        id: `eq-${i}`,
        paperId: PAPER_ID,
        orderNum: i + 1,
        type: 'choice',
        content: `Question ${i + 1}`,
        options: { A: '1', B: '2' },
        answer: 'A',
        explanation: 'explanation',
        points: 2,
        metadata: {},
      }));

      paperRepo.findQuestionsByPaperId.mockResolvedValue(fiveQuestions);
      paperRepo.findById.mockResolvedValue(PAPER);
      mockRepo.countByUserAndPaper.mockResolvedValue(0);
      mockRepo.create.mockResolvedValue(MOCK_ID);

      // 5 AI responses
      const generateContent = vi.fn();
      for (let i = 0; i < 5; i++) {
        generateContent.mockResolvedValueOnce({
          text: JSON.stringify({
            content: `Variant ${i}`,
            options: { A: '1', B: '2' },
            answer: 'A',
            explanation: 'exp',
          }),
        });
      }
      vi.mocked(geminiModule.getGenAI).mockReturnValue({
        models: { generateContent },
      } as unknown as ReturnType<typeof geminiModule.getGenAI>);

      await service.generateMock(USER_ID, PAPER_ID, 'practice');

      // 5 questions in total: batch of 3 + batch of 2
      expect(generateContent).toHaveBeenCalledTimes(5);

      // Mock created with 5 questions
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPoints: 10, // 5 * 2
        }),
      );
    });
  });

  // ==================== submitAnswer ====================

  describe('submitAnswer', () => {
    it('should verify ownership, judge answer with AI, and update mock state', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      const judgeResponse = JSON.stringify({
        is_correct: true,
        score: 5,
        feedback: 'Correct! The derivative of x^3 is 3x^2.',
      });
      mockAI(judgeResponse);

      const result = await service.submitAnswer(USER_ID, MOCK_ID, 0, 'B');

      expect(result).toEqual({
        questionIndex: 0,
        userAnswer: 'B',
        isCorrect: true,
        score: 5,
        aiFeedback: 'Correct! The derivative of x^3 is 3x^2.',
      });

      expect(mockRepo.verifyOwnership).toHaveBeenCalledWith(MOCK_ID, USER_ID);
      expect(mockRepo.update).toHaveBeenCalledWith(
        MOCK_ID,
        expect.objectContaining({
          currentIndex: 1,
        }),
      );
    });

    it('should complete mock exam when answering the last question', async () => {
      const mockAtLastQ: MockExam = {
        ...MOCK_EXAM,
        currentIndex: 1,
        responses: [
          {
            questionIndex: 0,
            userAnswer: 'B',
            isCorrect: true,
            score: 5,
            aiFeedback: 'Correct.',
          },
        ],
      };
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(mockAtLastQ);
      mockRepo.update.mockResolvedValue(undefined);

      const judgeResponse = JSON.stringify({
        is_correct: true,
        score: 10,
        feedback: 'Great!',
      });
      mockAI(judgeResponse);

      // questionIndex = 1, which is questions.length - 1 = 1 (last question)
      const result = await service.submitAnswer(USER_ID, MOCK_ID, 1, 'sin(x) + C');

      expect(result.score).toBe(10);

      // Should set completed status and total score
      expect(mockRepo.update).toHaveBeenCalledWith(
        MOCK_ID,
        expect.objectContaining({
          status: 'completed',
          score: 15, // 5 from first response + 10 from this one
        }),
      );
    });

    it('should throw NOT_FOUND when ownership verification fails', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.submitAnswer(USER_ID, MOCK_ID, 0, 'A')).rejects.toThrow(
        'Mock exam not found',
      );
    });

    it('should throw NOT_FOUND when mock exam is not found', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.submitAnswer(USER_ID, MOCK_ID, 0, 'A')).rejects.toThrow(
        'Mock exam not found',
      );
    });

    it('should throw VALIDATION when mock is already completed', async () => {
      const completedMock: MockExam = { ...MOCK_EXAM, status: 'completed' };
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(completedMock);

      await expect(service.submitAnswer(USER_ID, MOCK_ID, 0, 'A')).rejects.toThrow(
        'Mock exam already completed',
      );
    });

    it('should throw VALIDATION for invalid question index (negative)', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);

      await expect(service.submitAnswer(USER_ID, MOCK_ID, -1, 'A')).rejects.toThrow(
        'Invalid question index',
      );
    });

    it('should throw VALIDATION for question index out of range', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);

      await expect(service.submitAnswer(USER_ID, MOCK_ID, 99, 'A')).rejects.toThrow(
        'Invalid question index',
      );
    });

    it('should fallback to simple matching when AI judging fails', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      // Suppress console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // AI throws
      const generateContent = vi.fn().mockRejectedValue(new Error('AI unavailable'));
      vi.mocked(geminiModule.getGenAI).mockReturnValue({
        models: { generateContent },
      } as unknown as ReturnType<typeof geminiModule.getGenAI>);

      // Exact match (case-insensitive)
      const result = await service.submitAnswer(USER_ID, MOCK_ID, 0, 'b');

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(5);
      expect(result.aiFeedback).toBe('Correct! Well done.');

      warnSpy.mockRestore();
    });

    it('should return incorrect feedback on simple matching fallback for wrong answer', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const generateContent = vi.fn().mockRejectedValue(new Error('AI unavailable'));
      vi.mocked(geminiModule.getGenAI).mockReturnValue({
        models: { generateContent },
      } as unknown as ReturnType<typeof geminiModule.getGenAI>);

      const result = await service.submitAnswer(USER_ID, MOCK_ID, 0, 'A');

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
      expect(result.aiFeedback).toContain('Incorrect');
      expect(result.aiFeedback).toContain('B');

      warnSpy.mockRestore();
    });

    it('should clamp AI score to [0, maxPoints]', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      // AI returns score > max points
      mockAI(
        JSON.stringify({
          is_correct: true,
          score: 100,
          feedback: 'Perfect!',
        }),
      );

      const result = await service.submitAnswer(USER_ID, MOCK_ID, 0, 'B');

      expect(result.score).toBe(5); // clamped to max points (5)
    });

    it('should clamp negative AI score to 0', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      mockAI(
        JSON.stringify({
          is_correct: false,
          score: -5,
          feedback: 'Wrong.',
        }),
      );

      const result = await service.submitAnswer(USER_ID, MOCK_ID, 0, 'Z');

      expect(result.score).toBe(0);
    });
  });

  // ==================== batchSubmitAnswers ====================

  describe('batchSubmitAnswers', () => {
    it('should verify ownership, judge all answers, and complete the mock', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      // 2 answers, so 2 AI calls in one batch
      mockAISequence([
        JSON.stringify({ is_correct: true, score: 5, feedback: 'Correct!' }),
        JSON.stringify({ is_correct: false, score: 3, feedback: 'Partially correct.' }),
      ]);

      const result = await service.batchSubmitAnswers(USER_ID, MOCK_ID, [
        { questionIndex: 0, userAnswer: 'B' },
        { questionIndex: 1, userAnswer: 'sin(x)' },
      ]);

      expect(result.responses).toHaveLength(2);
      expect(result.score).toBe(8);
      expect(result.totalPoints).toBe(15);

      // Mock updated with completed status
      expect(mockRepo.update).toHaveBeenCalledWith(
        MOCK_ID,
        expect.objectContaining({
          currentIndex: 2,
          score: 8,
          status: 'completed',
        }),
      );
    });

    it('should throw NOT_FOUND when ownership fails', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(false);

      await expect(
        service.batchSubmitAnswers(USER_ID, MOCK_ID, [{ questionIndex: 0, userAnswer: 'A' }]),
      ).rejects.toThrow('Mock exam not found');
    });

    it('should throw NOT_FOUND when mock not found', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.batchSubmitAnswers(USER_ID, MOCK_ID, [{ questionIndex: 0, userAnswer: 'A' }]),
      ).rejects.toThrow('Mock exam not found');
    });

    it('should throw VALIDATION when mock is already completed', async () => {
      const completedMock: MockExam = { ...MOCK_EXAM, status: 'completed' };
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(completedMock);

      await expect(
        service.batchSubmitAnswers(USER_ID, MOCK_ID, [{ questionIndex: 0, userAnswer: 'A' }]),
      ).rejects.toThrow('Mock exam already completed');
    });

    it('should handle invalid question index gracefully', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);
      mockRepo.update.mockResolvedValue(undefined);

      // First answer is valid, second has invalid index
      mockAI(JSON.stringify({ is_correct: true, score: 5, feedback: 'OK' }));

      const result = await service.batchSubmitAnswers(USER_ID, MOCK_ID, [
        { questionIndex: 0, userAnswer: 'B' },
        { questionIndex: 99, userAnswer: 'X' },
      ]);

      expect(result.responses).toHaveLength(2);

      // Invalid index gets score 0 and "Invalid question index" feedback
      const invalidResponse = result.responses.find((r) => r.questionIndex === 99);
      expect(invalidResponse?.score).toBe(0);
      expect(invalidResponse?.isCorrect).toBe(false);
      expect(invalidResponse?.aiFeedback).toBe('Invalid question index.');
    });

    it('should process answers in batches of 3', async () => {
      // Create mock with 5 questions
      const fiveQMock: MockExam = {
        ...MOCK_EXAM,
        questions: Array.from({ length: 5 }, (_, i) => ({
          content: `Q${i}`,
          type: 'choice',
          options: { A: '1', B: '2' },
          answer: 'A',
          explanation: 'exp',
          points: 2,
          sourceQuestionId: null,
        })),
        totalPoints: 10,
      };

      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(fiveQMock);
      mockRepo.update.mockResolvedValue(undefined);

      const generateContent = vi.fn();
      for (let i = 0; i < 5; i++) {
        generateContent.mockResolvedValueOnce({
          text: JSON.stringify({ is_correct: true, score: 2, feedback: 'OK' }),
        });
      }
      vi.mocked(geminiModule.getGenAI).mockReturnValue({
        models: { generateContent },
      } as unknown as ReturnType<typeof geminiModule.getGenAI>);

      const answers = Array.from({ length: 5 }, (_, i) => ({
        questionIndex: i,
        userAnswer: 'A',
      }));

      const result = await service.batchSubmitAnswers(USER_ID, MOCK_ID, answers);

      expect(result.responses).toHaveLength(5);
      expect(result.score).toBe(10);
      expect(generateContent).toHaveBeenCalledTimes(5);
    });
  });

  // ==================== getMock ====================

  describe('getMock', () => {
    it('should return mock exam when user is owner', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue(MOCK_EXAM);

      const result = await service.getMock(USER_ID, MOCK_ID);

      expect(result).toEqual(MOCK_EXAM);
      expect(mockRepo.verifyOwnership).toHaveBeenCalledWith(MOCK_ID, USER_ID);
    });

    it('should return null when user is not owner', async () => {
      mockRepo.verifyOwnership.mockResolvedValue(false);

      const result = await service.getMock('other-user', MOCK_ID);

      expect(result).toBeNull();
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should delegate to repo with default pagination', async () => {
      mockRepo.findByUserId.mockResolvedValue([MOCK_EXAM]);

      const result = await service.getHistory(USER_ID);

      expect(result).toEqual([MOCK_EXAM]);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(USER_ID, 20, 0);
    });

    it('should pass custom limit and offset', async () => {
      mockRepo.findByUserId.mockResolvedValue([]);

      await service.getHistory(USER_ID, 10, 5);

      expect(mockRepo.findByUserId).toHaveBeenCalledWith(USER_ID, 10, 5);
    });
  });

  // ==================== getMockIdBySessionId ====================

  describe('getMockIdBySessionId', () => {
    it('should return mock ID when session exists and user owns it', async () => {
      mockRepo.findBySessionId.mockResolvedValue(MOCK_ID);
      mockRepo.verifyOwnership.mockResolvedValue(true);

      const result = await service.getMockIdBySessionId(SESSION_ID, USER_ID);

      expect(result).toBe(MOCK_ID);
      expect(mockRepo.findBySessionId).toHaveBeenCalledWith(SESSION_ID);
      expect(mockRepo.verifyOwnership).toHaveBeenCalledWith(MOCK_ID, USER_ID);
    });

    it('should return null when no mock found for session', async () => {
      mockRepo.findBySessionId.mockResolvedValue(null);

      const result = await service.getMockIdBySessionId('nonexistent', USER_ID);

      expect(result).toBeNull();
      expect(mockRepo.verifyOwnership).not.toHaveBeenCalled();
    });

    it('should return null when user does not own the mock', async () => {
      mockRepo.findBySessionId.mockResolvedValue(MOCK_ID);
      mockRepo.verifyOwnership.mockResolvedValue(false);

      const result = await service.getMockIdBySessionId(SESSION_ID, 'other-user');

      expect(result).toBeNull();
    });
  });
});
