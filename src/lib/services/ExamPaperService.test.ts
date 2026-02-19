import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ForbiddenError } from '@/lib/errors';
import type { ExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import type { ExamPaper, ExamQuestion } from '@/types/exam';
import { ExamPaperService } from './ExamPaperService';

// ---------- Module mocks ----------

vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: {
    chat: 'gemini-2.5-flash',
    parse: 'gemini-2.0-flash',
    embedding: 'gemini-embedding-001',
  },
  getGenAI: vi.fn(),
}));

vi.mock('@/lib/pdf', () => ({
  parsePDF: vi.fn(),
}));

// Import mocked modules after vi.mock
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const geminiModule = await vi.importMock<typeof import('@/lib/gemini')>('@/lib/gemini');
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const pdfModule = await vi.importMock<typeof import('@/lib/pdf')>('@/lib/pdf');

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

const QUESTIONS: ExamQuestion[] = [
  {
    id: 'q1',
    paperId: PAPER_ID,
    orderNum: 1,
    type: 'choice',
    content: 'What is 2+2?',
    options: { A: '3', B: '4', C: '5', D: '6' },
    answer: 'B',
    explanation: '2+2=4',
    points: 5,
    metadata: { knowledge_point: 'arithmetic', difficulty: 'easy' },
  },
  {
    id: 'q2',
    paperId: PAPER_ID,
    orderNum: 2,
    type: 'short_answer',
    content: 'Explain matrix multiplication.',
    options: null,
    answer: 'Row by column dot product.',
    explanation: 'Matrix multiplication is defined by dot products of rows and columns.',
    points: 10,
    metadata: { knowledge_point: 'linear algebra', difficulty: 'medium' },
  },
];

const AI_EXTRACTION_RESPONSE = JSON.stringify({
  title: '2024 Fall Midterm - Linear Algebra',
  questions: [
    {
      order_num: 1,
      type: 'choice',
      content: 'What is 2+2?',
      options: { A: '3', B: '4', C: '5', D: '6' },
      answer: 'B',
      explanation: '2+2=4',
      points: 5,
      knowledge_point: 'arithmetic',
      difficulty: 'easy',
    },
    {
      order_num: 2,
      type: 'short_answer',
      content: 'Explain matrix multiplication.',
      options: null,
      answer: 'Row by column dot product.',
      explanation: 'Matrix multiplication is defined by dot products of rows and columns.',
      points: 10,
      knowledge_point: 'linear algebra',
      difficulty: 'medium',
    },
  ],
});

// ---------- Helper ----------

function mockAI(responseText: string) {
  const generateContent = vi.fn().mockResolvedValue({ text: responseText });
  vi.mocked(geminiModule.getGenAI).mockReturnValue({
    models: { generateContent },
  } as unknown as ReturnType<typeof geminiModule.getGenAI>);
  return generateContent;
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
    it('should create paper, parse PDF, extract questions via AI, and update paper metadata', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestions.mockResolvedValue(undefined);
      repo.updatePaper.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'Some exam text...',
        pages: [{ text: 'Some exam text...', page: 1 }],
      });

      mockAI(AI_EXTRACTION_RESPONSE);

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

      // PDF parsed
      expect(pdfModule.parsePDF).toHaveBeenCalledWith(Buffer.from('pdf-data'));

      // Questions inserted
      expect(repo.insertQuestions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            paperId: PAPER_ID,
            orderNum: 1,
            type: 'choice',
            content: 'What is 2+2?',
          }),
          expect.objectContaining({
            paperId: PAPER_ID,
            orderNum: 2,
            type: 'short_answer',
          }),
        ]),
      );

      // Paper metadata updated (title + question types)
      expect(repo.updatePaper).toHaveBeenCalledWith(PAPER_ID, {
        title: '2024 Fall Midterm - Linear Algebra',
        questionTypes: ['choice', 'short_answer'],
      });
    });

    it('should default visibility to private', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestions.mockResolvedValue(undefined);
      repo.updatePaper.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'text',
        pages: [{ text: 'text', page: 1 }],
      });
      mockAI(AI_EXTRACTION_RESPONSE);

      await service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {});

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'private' }));
    });

    it('should use public visibility when specified', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestions.mockResolvedValue(undefined);
      repo.updatePaper.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'text',
        pages: [{ text: 'text', page: 1 }],
      });
      mockAI(AI_EXTRACTION_RESPONSE);

      await service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {
        visibility: 'public',
      });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public' }));
    });

    it('should use filename (minus .pdf) as fallback title when AI returns no title', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.insertQuestions.mockResolvedValue(undefined);
      repo.updatePaper.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'content',
        pages: [{ text: 'content', page: 1 }],
      });

      const noTitleResponse = JSON.stringify({
        questions: [
          {
            order_num: 1,
            type: 'choice',
            content: 'Q?',
            options: { A: '1', B: '2' },
            answer: 'A',
            explanation: 'because',
            points: 1,
          },
        ],
      });
      mockAI(noTitleResponse);

      await service.parsePaper(USER_ID, Buffer.from('data'), 'MyExam.pdf', {});

      expect(repo.updatePaper).toHaveBeenCalledWith(
        PAPER_ID,
        expect.objectContaining({ title: 'MyExam' }),
      );
    });

    // ==================== parsePaper (error paths) ====================

    it('should delete draft paper when PDF has no text', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: '   ',
        pages: [],
      });

      await expect(
        service.parsePaper(USER_ID, Buffer.from('empty'), 'empty.pdf', {}),
      ).rejects.toThrow('PDF contains no extractable text');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper when AI extracts no questions', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'some text',
        pages: [{ text: 'some text', page: 1 }],
      });

      mockAI(JSON.stringify({ title: 'Empty', questions: [] }));

      await expect(
        service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {}),
      ).rejects.toThrow('AI could not extract any questions from the PDF');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper when AI returns null questions', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockResolvedValue({
        fullText: 'some text',
        pages: [{ text: 'some text', page: 1 }],
      });

      mockAI(JSON.stringify({ title: 'Broken' }));

      await expect(
        service.parsePaper(USER_ID, Buffer.from('data'), 'test.pdf', {}),
      ).rejects.toThrow('AI could not extract any questions from the PDF');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper when PDF parsing fails', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockRejectedValue(new Error('Corrupt PDF'));

      await expect(
        service.parsePaper(USER_ID, Buffer.from('bad'), 'broken.pdf', {}),
      ).rejects.toThrow('Corrupt PDF');

      expect(repo.delete).toHaveBeenCalledWith(PAPER_ID);
    });

    it('should delete draft paper for non-Error throws', async () => {
      repo.create.mockResolvedValue(PAPER_ID);
      repo.delete.mockResolvedValue(undefined);

      vi.mocked(pdfModule.parsePDF).mockRejectedValue('string error');

      await expect(service.parsePaper(USER_ID, Buffer.from('bad'), 'broken.pdf', {})).rejects.toBe(
        'string error',
      );

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
