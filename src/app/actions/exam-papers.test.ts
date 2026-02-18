import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotaExceededError } from '@/lib/errors';
import type { ExamPaper } from '@/types/exam';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  createClient: () => mockCreateClient(),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockExamPaperService = {
  parsePaper: vi.fn(),
  getPapers: vi.fn(),
  getPaperWithQuestions: vi.fn(),
  getPaperDetail: vi.fn(),
  deletePaper: vi.fn(),
};
vi.mock('@/lib/services/ExamPaperService', () => ({
  getExamPaperService: () => mockExamPaperService,
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

const { uploadAndParseExamPaper, getExamPaperList, deleteExamPaper } =
  await import('./exam-papers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const INITIAL_STATE = { status: 'idle' as const, message: '' };

function makePdfFile(name = 'exam.pdf'): File {
  return new File(['dummy pdf'], name, { type: 'application/pdf' });
}

function makeFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData();
  fd.set('file', overrides.file || makePdfFile());
  if (overrides.school) fd.set('school', overrides.school as string);
  if (overrides.course) fd.set('course', overrides.course as string);
  if (overrides.year) fd.set('year', overrides.year as string);
  if (overrides.visibility) fd.set('visibility', overrides.visibility as string);
  return fd;
}

function makeExamPaper(overrides: Partial<ExamPaper> = {}): ExamPaper {
  return {
    id: 'paper-1',
    userId: 'user-1',
    documentId: null,
    title: '2024 Fall Midterm',
    visibility: 'private',
    school: 'MIT',
    course: 'CS101',
    courseId: null,
    year: '2024',
    questionTypes: ['choice', 'short_answer'],
    status: 'ready',
    statusMessage: null,
    questionCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Exam Paper Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
  });

  // =========================================================================
  // uploadAndParseExamPaper
  // =========================================================================
  describe('uploadAndParseExamPaper', () => {
    it('should parse exam paper successfully', async () => {
      mockExamPaperService.parsePaper.mockResolvedValue({ paperId: 'paper-1' });

      const fd = makeFormData();
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(result.message).toContain('successfully');
      expect(result.paperId).toBe('paper-1');
      expect(mockExamPaperService.parsePaper).toHaveBeenCalledWith(
        'user-1',
        expect.any(Buffer),
        'exam.pdf',
        {},
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
    });

    it('should pass options to parsePaper', async () => {
      mockExamPaperService.parsePaper.mockResolvedValue({ paperId: 'paper-1' });

      const fd = makeFormData({
        school: 'MIT',
        course: 'CS101',
        year: '2024',
        visibility: 'public',
      });
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(mockExamPaperService.parsePaper).toHaveBeenCalledWith(
        'user-1',
        expect.any(Buffer),
        'exam.pdf',
        { school: 'MIT', course: 'CS101', year: '2024', visibility: 'public' },
      );
    });

    it('should return error for invalid upload data (no file)', async () => {
      const fd = new FormData();

      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid upload data');
    });

    it('should return error for non-PDF file', async () => {
      const fd = new FormData();
      fd.set('file', new File(['content'], 'test.txt', { type: 'text/plain' }));

      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('PDF');
    });

    it('should return error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const fd = makeFormData();
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Unauthorized');
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const fd = makeFormData();
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('exceeded');
    });

    it('should handle service errors and return error message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExamPaperService.parsePaper.mockRejectedValue(new Error('Parse failed'));

      const fd = makeFormData();
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Parse failed');
    });

    it('should handle non-Error thrown objects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExamPaperService.parsePaper.mockRejectedValue('string error');

      const fd = makeFormData();
      const result = await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Failed to parse exam paper');
    });

    it('should enforce quota before calling parsePaper', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));

      const fd = makeFormData();
      await uploadAndParseExamPaper(INITIAL_STATE, fd);

      expect(mockQuotaService.enforce).toHaveBeenCalledWith('user-1');
      expect(mockExamPaperService.parsePaper).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getExamPaperList
  // =========================================================================
  describe('getExamPaperList', () => {
    it('should return papers for authenticated user', async () => {
      const papers = [makeExamPaper({ id: 'paper-1' }), makeExamPaper({ id: 'paper-2' })];
      mockExamPaperService.getPapers.mockResolvedValue({ data: papers, total: 2 });

      const result = await getExamPaperList();

      expect(result).toEqual(papers);
      expect(mockExamPaperService.getPapers).toHaveBeenCalledWith(undefined);
    });

    it('should pass filters to service', async () => {
      mockExamPaperService.getPapers.mockResolvedValue({ data: [], total: 0 });

      const filters = { school: 'MIT', course: 'CS101' };
      await getExamPaperList(filters);

      expect(mockExamPaperService.getPapers).toHaveBeenCalledWith(filters);
    });

    it('should return empty array when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await getExamPaperList();

      expect(result).toEqual([]);
      expect(mockExamPaperService.getPapers).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('deleteExamPaper', () => {
    it('should delete paper for authenticated user', async () => {
      mockExamPaperService.deletePaper.mockResolvedValue(undefined);

      await deleteExamPaper('paper-1');

      expect(mockExamPaperService.deletePaper).toHaveBeenCalledWith('user-1', 'paper-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
    });

    it('should throw when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(deleteExamPaper('paper-1')).rejects.toThrow('Unauthorized');
    });
  });
});
