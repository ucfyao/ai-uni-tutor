import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamPaper } from '@/types/exam';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAdmin = vi.fn();
const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireAdmin: () => mockRequireAdmin(),
  createClient: () => mockCreateClient(),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockExamPaperService = {
  getPapers: vi.fn(),
  parsePaper: vi.fn(),
  deleteByAdmin: vi.fn(),
};
vi.mock('@/lib/services/ExamPaperService', () => ({
  getExamPaperService: () => mockExamPaperService,
}));

const mockDocumentService = {
  createDocument: vi.fn(),
  updateStatus: vi.fn(),
  saveChunks: vi.fn(),
};
vi.mock('@/lib/services/DocumentService', () => ({
  getDocumentService: () => mockDocumentService,
}));

const mockParsePDF = vi.fn();
vi.mock('@/lib/pdf', () => ({
  parsePDF: (...args: unknown[]) => mockParsePDF(...args),
}));

const mockGenerateEmbeddingWithRetry = vi.fn();
vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingWithRetry: (...args: unknown[]) => mockGenerateEmbeddingWithRetry(...args),
}));

const mockChunkPages = vi.fn();
vi.mock('@/lib/rag/chunking', () => ({
  chunkPages: (...args: unknown[]) => mockChunkPages(...args),
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks are registered)
// ---------------------------------------------------------------------------

const { getAdminDocuments, getAdminExamPapers, uploadAdminContent, deleteAdminContent } =
  await import('./admin-content');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ADMIN = { id: 'admin-1', email: 'admin@example.com' };

const INITIAL_STATE = { status: 'idle' as const, message: '' };

function makePdfFile(name = 'test.pdf'): File {
  return new File(['dummy pdf'], name, { type: 'application/pdf' });
}

function makeUploadFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData();
  fd.set('file', overrides.file || makePdfFile());
  fd.set('docType', (overrides.docType as string) || 'lecture');
  // Always set optional fields to empty string (like a real browser form) so
  // formData.get() returns '' instead of null — the Zod preprocess only
  // handles string->undefined conversion, not null->undefined.
  fd.set('course', (overrides.course as string) ?? '');
  fd.set('school', (overrides.school as string) ?? '');
  fd.set('year', (overrides.year as string) ?? '');
  return fd;
}

function makeExamPaper(overrides: Partial<ExamPaper> = {}): ExamPaper {
  return {
    id: 'paper-1',
    userId: 'admin-1',
    documentId: null,
    title: '2024 Fall Midterm',
    visibility: 'public',
    school: 'MIT',
    course: 'CS101',
    year: '2024',
    questionTypes: ['choice', 'short_answer'],
    status: 'ready',
    statusMessage: null,
    questionCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockSupabaseSelect(data: unknown[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        order: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

function mockSupabaseDelete(error: unknown = null) {
  return {
    from: () => ({
      delete: () => ({
        eq: vi.fn().mockResolvedValue({ error }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Content Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(MOCK_ADMIN);
  });

  // =========================================================================
  // getAdminDocuments
  // =========================================================================
  describe('getAdminDocuments', () => {
    it('should return all documents for admin user', async () => {
      const docs = [
        { id: 'doc-1', name: 'Lecture 1', created_at: '2024-01-01' },
        { id: 'doc-2', name: 'Lecture 2', created_at: '2024-01-02' },
      ];
      mockCreateClient.mockResolvedValue(mockSupabaseSelect(docs));

      const result = await getAdminDocuments();

      expect(result).toEqual(docs);
    });

    it('should return empty array when requireAdmin rejects', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Not admin'));

      const result = await getAdminDocuments();

      expect(result).toEqual([]);
    });

    it('should return empty array on supabase error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCreateClient.mockResolvedValue(
        mockSupabaseSelect([], { message: 'DB connection error' }),
      );

      const result = await getAdminDocuments();

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockCreateClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await getAdminDocuments();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getAdminExamPapers
  // =========================================================================
  describe('getAdminExamPapers', () => {
    it('should return all exam papers for admin user', async () => {
      const papers = [makeExamPaper({ id: 'paper-1' }), makeExamPaper({ id: 'paper-2' })];
      mockExamPaperService.getPapers.mockResolvedValue(papers);

      const result = await getAdminExamPapers();

      expect(result).toEqual(papers);
      expect(mockExamPaperService.getPapers).toHaveBeenCalled();
    });

    it('should return empty array when requireAdmin rejects', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Not admin'));

      const result = await getAdminExamPapers();

      expect(result).toEqual([]);
      expect(mockExamPaperService.getPapers).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // uploadAdminContent
  // =========================================================================
  describe('uploadAdminContent', () => {
    it('should return error for invalid upload data (missing fields)', async () => {
      const fd = new FormData();

      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Invalid upload data' });
    });

    it('should return error for non-PDF file', async () => {
      const fd = new FormData();
      fd.set('file', new File(['content'], 'test.txt', { type: 'text/plain' }));
      fd.set('docType', 'lecture');
      fd.set('course', '');
      fd.set('school', '');
      fd.set('year', '');

      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Only PDF files are supported' });
    });

    it('should return error when requireAdmin rejects', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Not admin'));

      const fd = makeUploadFormData();
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Admin access required' });
    });

    // ----- Exam paper upload -----
    it('should delegate exam upload to exam paper service', async () => {
      mockExamPaperService.parsePaper.mockResolvedValue({ paperId: 'paper-1' });

      const fd = makeUploadFormData({
        docType: 'exam',
        school: 'MIT',
        course: 'CS101',
        year: '2024',
      });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({
        status: 'success',
        message: 'Exam paper uploaded & parsing started',
      });
      expect(mockExamPaperService.parsePaper).toHaveBeenCalledWith(
        'admin-1',
        expect.any(Buffer),
        'test.pdf',
        {
          school: 'MIT',
          course: 'CS101',
          year: '2024',
          visibility: 'public',
        },
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
    });

    // ----- Lecture document upload -----
    it('should process lecture document successfully', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Some lecture content', pageNum: 1 }],
      });
      mockChunkPages.mockResolvedValue([{ content: 'chunk 1', metadata: { page: 1 } }]);
      mockGenerateEmbeddingWithRetry.mockResolvedValue([0.1, 0.2, 0.3]);
      mockDocumentService.saveChunks.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeUploadFormData({ docType: 'lecture', school: 'MIT', course: 'CS101' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'success', message: 'Document processed successfully' });
      expect(mockDocumentService.createDocument).toHaveBeenCalledWith(
        'admin-1',
        'test.pdf',
        { school: 'MIT', course: 'CS101' },
        'lecture',
        'CS101',
      );
      expect(mockDocumentService.saveChunks).toHaveBeenCalled();
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith('doc-1', 'ready');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/knowledge');
    });

    it('should use defaults for missing school and course', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Content', pageNum: 1 }],
      });
      mockChunkPages.mockResolvedValue([]);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeUploadFormData({ docType: 'lecture' });
      await uploadAdminContent(INITIAL_STATE, fd);

      expect(mockDocumentService.createDocument).toHaveBeenCalledWith(
        'admin-1',
        'test.pdf',
        { school: 'Unspecified', course: 'General' },
        'lecture',
        undefined,
      );
    });

    it('should return error when createDocument fails', async () => {
      mockDocumentService.createDocument.mockRejectedValue(new Error('DB insert failed'));

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({
        status: 'error',
        message: 'Failed to create document: DB insert failed',
      });
    });

    it('should return error when PDF parsing fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockRejectedValue(new Error('Corrupt PDF'));

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Failed to parse PDF content' });
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'error',
        'Failed to parse PDF',
      );
    });

    it('should return error when chunk saving fails', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Content', pageNum: 1 }],
      });
      mockChunkPages.mockResolvedValue([{ content: 'chunk 1', metadata: { page: 1 } }]);
      mockGenerateEmbeddingWithRetry.mockResolvedValue([0.1]);
      mockDocumentService.saveChunks.mockRejectedValue(new Error('DB error'));
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Failed to save document chunks' });
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'error',
        'Failed to save chunks',
      );
    });

    it('should skip saving when there are no chunks', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Content', pageNum: 1 }],
      });
      mockChunkPages.mockResolvedValue([]);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'success', message: 'Document processed successfully' });
      expect(mockDocumentService.saveChunks).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during upload', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      // Force an unexpected error by making requireAdmin throw after validation passes
      // but in a way not caught by the specific handlers
      mockRequireAdmin
        .mockResolvedValueOnce(MOCK_ADMIN) // First call succeeds (upload rejects non-admin earlier)
        .mockResolvedValueOnce(MOCK_ADMIN);

      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Content', pageNum: 1 }],
      });
      mockChunkPages.mockRejectedValue(new Error('Unexpected chunking failure'));

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
    });

    it('should return error for invalid docType', async () => {
      const fd = new FormData();
      fd.set('file', makePdfFile());
      fd.set('docType', 'invalid_type');

      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result).toEqual({ status: 'error', message: 'Invalid upload data' });
    });

    it('should process multiple chunks in batches', async () => {
      mockDocumentService.createDocument.mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
      });
      mockParsePDF.mockResolvedValue({
        pages: [{ text: 'Content', pageNum: 1 }],
      });
      // Create 7 chunks to test batching (BATCH_SIZE = 5)
      const chunks = Array.from({ length: 7 }, (_, i) => ({
        content: `chunk ${i}`,
        metadata: { page: 1 },
      }));
      mockChunkPages.mockResolvedValue(chunks);
      mockGenerateEmbeddingWithRetry.mockResolvedValue([0.1, 0.2]);
      mockDocumentService.saveChunks.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeUploadFormData({ docType: 'lecture' });
      const result = await uploadAdminContent(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(mockGenerateEmbeddingWithRetry).toHaveBeenCalledTimes(7);
      expect(mockDocumentService.saveChunks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ documentId: 'doc-1' })]),
      );
    });
  });

  // =========================================================================
  // deleteAdminContent
  // =========================================================================
  describe('deleteAdminContent', () => {
    it('should delete exam paper via exam paper service', async () => {
      mockExamPaperService.deleteByAdmin.mockResolvedValue(undefined);

      await deleteAdminContent('paper-1', 'exam');

      expect(mockExamPaperService.deleteByAdmin).toHaveBeenCalledWith('paper-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/knowledge');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
    });

    it('should delete document via supabase directly', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ error: null });
      mockCreateClient.mockResolvedValue({
        from: () => ({
          delete: () => ({
            eq: mockDelete,
          }),
        }),
      });

      await deleteAdminContent('doc-1', 'document');

      expect(mockDelete).toHaveBeenCalledWith('id', 'doc-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/knowledge');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/exam');
    });

    it('should throw when requireAdmin rejects', async () => {
      mockRequireAdmin.mockRejectedValue(new Error('Not admin'));

      await expect(deleteAdminContent('doc-1', 'document')).rejects.toThrow('Not admin');
    });

    it('should throw when supabase delete fails for document', async () => {
      mockCreateClient.mockResolvedValue({
        from: () => ({
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: { message: 'FK violation' } }),
          }),
        }),
      });

      await expect(deleteAdminContent('doc-1', 'document')).rejects.toThrow(
        'Failed to delete document: FK violation',
      );
    });
  });
});
