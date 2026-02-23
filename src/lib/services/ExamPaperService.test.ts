import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ForbiddenError } from '@/lib/errors';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaper } from '@/types/exam';
import { ExamPaperService } from './ExamPaperService';

// ---------- Module mocks ----------

vi.mock('@/lib/rag/parsers/question-parser', () => ({
  parseQuestions: vi.fn(),
}));

vi.mock('@/lib/rag/build-chunk-content', () => ({
  buildQuestionChunkContent: vi.fn((q: any) => `Q: ${q.content}`),
}));

vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingBatch: vi.fn(),
}));

// Import mocked modules after vi.mock
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const questionParserModule = await vi.importMock<
  typeof import('@/lib/rag/parsers/question-parser')
>('@/lib/rag/parsers/question-parser');
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const embeddingModule =
  await vi.importMock<typeof import('@/lib/rag/embedding')>('@/lib/rag/embedding');

// ---------- Mock repository ----------

function createMockExamPaperRepo(): {
  [K in keyof ExamPaperRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findWithFilters: vi.fn(),
    findOwner: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    updatePaper: vi.fn(),
    delete: vi.fn(),
    insertQuestions: vi.fn(),
    insertQuestionsAndReturn: vi.fn(),
    findQuestionsByPaperId: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    findByCourse: vi.fn(),
    findAllByCourse: vi.fn(),
    findAllForAdmin: vi.fn(),
    findCourseId: vi.fn(),
    findByCourseIds: vi.fn(),
  };
}

// ---------- Test data ----------

const USER_ID = 'user-exam-001';
const OTHER_USER = 'user-exam-002';
const PAPER_ID = 'paper-001';

const PAPER: ExamPaper = {
  id: PAPER_ID,
  userId: USER_ID,
  title: '2024 Fall Midterm - Linear Algebra',
  visibility: 'private',
  school: 'MIT',
  course: 'MATH101',
  courseId: null,
  year: '2024',
  questionTypes: ['choice', 'short_answer'],
  status: 'ready',
  questionCount: 2,
  createdAt: '2025-01-01T00:00:00Z',
};

const PARSED_QUESTIONS = [
  {
    questionNumber: '1',
    content: 'What is 2+2?',
    type: 'choice',
    options: ['3', '4', '5', '6'],
    referenceAnswer: 'B',
    score: 5,
    parentIndex: null,
    sourcePage: 1,
  },
  {
    questionNumber: '2',
    content: 'Explain matrix multiplication.',
    type: 'short_answer',
    score: 10,
    parentIndex: null,
    sourcePage: 1,
  },
];

const MOCK_EMBEDDINGS = [
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
];

// ---------- Helper ----------

function mockParseQuestions(questions = PARSED_QUESTIONS) {
  vi.mocked(questionParserModule.parseQuestions).mockResolvedValue(questions);
  vi.mocked(embeddingModule.generateEmbeddingBatch).mockResolvedValue(MOCK_EMBEDDINGS);
}

// ---------- Tests ----------

describe('ExamPaperService', () => {
  let service: ExamPaperService;
  let repo: ReturnType<typeof createMockExamPaperRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockExamPaperRepo();
    service = new ExamPaperService(repo as unknown as ExamPaperRepository);
  });

  // ==================== parsePaper (happy path) ====================

  describe('parsePaper', () => {
    it('should create paper, extract questions via one-shot, generate embeddings, and save', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestionsAndReturn.mockImplementation(async (qs: any[]) =>
        qs.map((_: any, i: number) => ({ id: `q${i + 1}` })),
      );
      repo.updatePaper.mockResolvedValue(undefined);
      mockParseQuestions();

      const result = await service.parsePaper(USER_ID, Buffer.from('pdf-data'), 'midterm.pdf', {
        school: 'MIT',
        course: 'MATH101',
        year: '2024',
      });

      expect(result).toEqual({ paperId: PAPER_ID });

      // Paper created with draft status
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          title: 'midterm',
          school: 'MIT',
          course: 'MATH101',
          year: '2024',
          visibility: 'private',
          status: 'draft',
        }),
      );

      // One-shot extraction called with buffer and hasAnswers=true
      expect(questionParserModule.parseQuestions).toHaveBeenCalledWith(
        Buffer.from('pdf-data'),
        true,
      );

      // Embeddings generated
      expect(embeddingModule.generateEmbeddingBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('What is 2+2?')]),
      );

      // Questions inserted with embeddings
      expect(repo.insertQuestionsAndReturn).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            paperId: PAPER_ID,
            orderNum: 1,
            type: 'choice',
            content: 'What is 2+2?',
            embedding: MOCK_EMBEDDINGS[0],
          }),
          expect.objectContaining({
            paperId: PAPER_ID,
            orderNum: 2,
            type: 'short_answer',
            embedding: MOCK_EMBEDDINGS[1],
          }),
        ]),
      );

      // Paper metadata updated with question types
      expect(repo.updatePaper).toHaveBeenCalledWith(PAPER_ID, {
        title: 'midterm',
        questionTypes: ['choice', 'short_answer'],
      });
    });

    it('should default visibility to private', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestionsAndReturn.mockImplementation(async (qs: any[]) =>
        qs.map((_: any, i: number) => ({ id: `q${i + 1}` })),
      );
      repo.updatePaper.mockResolvedValue(undefined);
      mockParseQuestions();

      await service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {});

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
    });

    it('should use public visibility when specified', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestionsAndReturn.mockImplementation(async (qs: any[]) =>
        qs.map((_: any, i: number) => ({ id: `q${i + 1}` })),
      );
      repo.updatePaper.mockResolvedValue(undefined);
      mockParseQuestions();

      await service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {
        visibility: 'public',
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }));
    });

    it('should use filename (minus .pdf) as title', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestionsAndReturn.mockImplementation(async (qs: any[]) =>
        qs.map((_: any, i: number) => ({ id: `q${i + 1}` })),
      );
      repo.updatePaper.mockResolvedValue(undefined);
      mockParseQuestions();

      await service.parsePaper(USER_ID, Buffer.from('data'), 'MyExam.pdf', {});

      expect(repo.updatePaper).toHaveBeenCalledWith(
        PAPER_ID,
        expect.objectContaining({ title: 'MyExam' }),
      );
    });

    // ==================== parsePaper (error paths) ====================

    it('should delete draft paper when no questions extracted', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(questionParserModule.parseQuestions).mockResolvedValue([]);

      await expect(
        service.parsePaper(USER_ID, Buffer.from('empty'), 'empty.pdf', {}),
      ).rejects.toThrow('AI could not extract any questions from the PDF');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper when extraction fails', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(questionParserModule.parseQuestions).mockRejectedValue(
        new Error('Extraction failed'),
      );

      await expect(
        service.parsePaper(USER_ID, Buffer.from('bad'), 'broken.pdf', {}),
      ).rejects.toThrow('Extraction failed');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper when embedding fails', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(questionParserModule.parseQuestions).mockResolvedValue(PARSED_QUESTIONS);
      vi.mocked(embeddingModule.generateEmbeddingBatch).mockRejectedValue(
        new Error('Embedding failed'),
      );

      await expect(
        service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {}),
      ).rejects.toThrow('Embedding failed');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });
  });

  // ==================== getPapers ====================

  describe('getPapers', () => {
    it('should delegate to repo.findWithFilters', async () => {
      repo.findWithFilters.mockResolvedValue({ data: [PAPER], total: 1 });

      const result = await service.getPapers({ school: 'MIT' });

      expect(repo.findWithFilters).toHaveBeenCalledWith({ school: 'MIT' });
      expect(result).toEqual({ data: [PAPER], total: 1 });
    });

    it('should pass undefined filters', async () => {
      repo.findWithFilters.mockResolvedValue({ data: [], total: 0 });

      const result = await service.getPapers();

      expect(repo.findWithFilters).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ==================== deletePaper ====================

  describe('deletePaper', () => {
    it('should delete paper when user is owner', async () => {
      repo.findOwner.mockResolvedValue(USER_ID);
      repo.delete.mockResolvedValue(undefined);

      await service.deletePaper(USER_ID, PAPER_ID);

      expect(repo.findOwner).toHaveBeenCalledWith(PAPER_ID);
      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should throw NOT_FOUND when paper does not exist', async () => {
      repo.findOwner.mockResolvedValue(null);

      await expect(service.deletePaper(USER_ID, 'nonexistent')).rejects.toThrow(AppError);
      await expect(service.deletePaper(USER_ID, 'nonexistent')).rejects.toThrow('Paper not found');
    });

    it('should throw ForbiddenError when user is not owner', async () => {
      repo.findOwner.mockResolvedValue(OTHER_USER);

      await expect(service.deletePaper(USER_ID, PAPER_ID)).rejects.toThrow(ForbiddenError);
      await expect(service.deletePaper(USER_ID, PAPER_ID)).rejects.toThrow(
        'You do not own this paper',
      );
    });
  });

  // ==================== updateQuestion ====================

  describe('updateQuestion', () => {
    it('should delegate to repo.updateQuestion', async () => {
      repo.updateQuestion.mockResolvedValue(undefined);

      await service.updateQuestion('q1', { content: 'Updated', points: 20 });

      expect(repo.updateQuestion).toHaveBeenCalledWith('q1', {
        content: 'Updated',
        points: 20,
      });
    });

    it('should pass partial updates', async () => {
      repo.updateQuestion.mockResolvedValue(undefined);

      await service.updateQuestion('q2', { answer: 'New answer' });

      expect(repo.updateQuestion).toHaveBeenCalledWith('q2', { answer: 'New answer' });
    });
  });
});
