import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/lib/domain/models/Document';
import { ForbiddenError, QuotaExceededError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const mockRequireAnyAdmin = vi.fn();
const mockRequireCourseAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireAnyAdmin: () => mockRequireAnyAdmin(),
  requireCourseAdmin: (courseId: string) => mockRequireCourseAdmin(courseId),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockDocumentService = {
  checkDuplicate: vi.fn(),
  createDocument: vi.fn(),
  updateStatus: vi.fn(),
  saveChunks: vi.fn(),
  deleteByAdmin: vi.fn(),
  deleteChunksByDocumentId: vi.fn(),
  findById: vi.fn(),
  deleteChunk: vi.fn(),
  updateChunk: vi.fn(),
  getChunks: vi.fn(),
  getChunksWithEmbeddings: vi.fn(),
  updateChunkEmbedding: vi.fn(),
  updateDocumentMetadata: vi.fn(),
  verifyChunksBelongToDocument: vi.fn(),
  saveChunksAndReturn: vi.fn(),
  getDocumentsForAdmin: vi.fn(),
};
vi.mock('@/lib/services/DocumentService', () => ({
  getDocumentService: () => mockDocumentService,
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

const mockProcessingService = {
  processWithLLM: vi.fn(),
};
vi.mock('@/lib/services/DocumentProcessingService', () => ({
  getDocumentProcessingService: () => mockProcessingService,
}));

const mockParsePDF = vi.fn();
vi.mock('@/lib/pdf', () => ({
  parsePDF: (...args: unknown[]) => mockParsePDF(...args),
}));

const mockGenerateEmbeddingWithRetry = vi.fn();
vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingWithRetry: (...args: unknown[]) => mockGenerateEmbeddingWithRetry(...args),
}));

const mockParseLecture = vi.fn();
const mockParseQuestions = vi.fn();
vi.mock('@/lib/rag/parsers/lecture-parser', () => ({
  parseLecture: (...args: unknown[]) => mockParseLecture(...args),
}));
vi.mock('@/lib/rag/parsers/question-parser', () => ({
  parseQuestions: (...args: unknown[]) => mockParseQuestions(...args),
}));

const mockKnowledgeCardService = {
  deleteByDocumentId: vi.fn(),
};
vi.mock('@/lib/services/KnowledgeCardService', () => ({
  getKnowledgeCardService: () => mockKnowledgeCardService,
}));

const mockExamPaperRepo = {
  findCourseId: vi.fn(),
  findOwner: vi.fn(),
  delete: vi.fn(),
  findAllForAdmin: vi.fn(),
  findByCourseIds: vi.fn(),
  findQuestionsByPaperId: vi.fn(),
  deleteQuestion: vi.fn(),
  updateQuestion: vi.fn(),
};
vi.mock('@/lib/repositories/ExamPaperRepository', () => ({
  getExamPaperRepository: () => mockExamPaperRepo,
}));

const mockAssignmentRepo = {
  findCourseId: vi.fn(),
  findOwner: vi.fn(),
  delete: vi.fn(),
  findAllForAdmin: vi.fn(),
  findByCourseIds: vi.fn(),
  findItemsByAssignmentId: vi.fn(),
  deleteItem: vi.fn(),
  updateItem: vi.fn(),
};
vi.mock('@/lib/repositories/AssignmentRepository', () => ({
  getAssignmentRepository: () => mockAssignmentRepo,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------

const {
  uploadDocument,
  deleteDocument,
  updateDocumentChunks,
  regenerateEmbeddings,
  retryDocument,
  updateDocumentMeta,
} = await import('./documents');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePdfFile(name = 'test.pdf', content = 'dummy pdf content'): File {
  return new File([content], name, { type: 'application/pdf' });
}

function makeFormData(overrides: Record<string, string | File> = {}): FormData {
  const fd = new FormData();
  fd.set('file', overrides.file || makePdfFile());
  if (overrides.doc_type) fd.set('doc_type', overrides.doc_type as string);
  // Must set school/course to empty string (not omit them) because
  // formData.get() returns null when key is missing, and the Zod schema
  // preprocessor only handles string->undefined conversion, not null.
  fd.set('school', (overrides.school as string) || '');
  fd.set('course', (overrides.course as string) || '');
  if (overrides.has_answers) fd.set('has_answers', overrides.has_answers as string);
  return fd;
}

const INITIAL_STATE = { status: 'idle' as const, message: '' };

function makeDocEntity(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: 'doc-1',
    userId: 'user-1',
    name: 'test.pdf',
    status: 'processing',
    statusMessage: null,
    metadata: { school: 'MIT', course: 'CS101' },
    docType: 'lecture',
    courseId: null,
    outline: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Document Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'super_admin' });
    mockRequireCourseAdmin.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
  });

  // =========================================================================
  // uploadDocument
  // =========================================================================
  describe('uploadDocument', () => {
    it('should return error for invalid upload data (no file)', async () => {
      const fd = new FormData();
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid upload data');
    });

    it('should return error for non-PDF file', async () => {
      const fd = new FormData();
      fd.set('file', new File(['content'], 'test.txt', { type: 'text/plain' }));
      fd.set('school', '');
      fd.set('course', '');

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('PDF');
    });

    it('should return error when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));
      const fd = makeFormData();

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Admin access required');
    });

    it('should return error when quota is exceeded', async () => {
      mockQuotaService.enforce.mockRejectedValue(new QuotaExceededError(10, 10));
      const fd = makeFormData();

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('exceeded');
    });

    it('should return error when file is a duplicate', async () => {
      mockDocumentService.checkDuplicate.mockResolvedValue(true);
      const fd = makeFormData();

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('already exists');
    });

    it('should return error when PDF parsing fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity());
      mockProcessingService.processWithLLM.mockRejectedValue(new Error('Failed to parse PDF'));
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData();
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to parse PDF');
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'error',
        'Failed to parse PDF',
      );
    });

    it('should return error for empty PDF (no text)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity());
      mockProcessingService.processWithLLM.mockRejectedValue(
        new Error('PDF contains no extractable text'),
      );
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData();
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('no extractable text');
    });

    it('should process lecture document successfully', async () => {
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity({ docType: 'lecture' }));
      mockProcessingService.processWithLLM.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData({ doc_type: 'lecture' });
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(result.message).toContain('successfully');
      expect(mockProcessingService.processWithLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-1',
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should reject exam document type (must use SSE route)', async () => {
      const fd = makeFormData({ doc_type: 'exam' });
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('streaming upload');
    });

    it('should handle content extraction failure and clean up', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity());
      mockProcessingService.processWithLLM.mockRejectedValue(
        new Error('Failed to extract content'),
      );
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData();
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to extract content');
      expect(mockDocumentService.deleteChunksByDocumentId).toHaveBeenCalledWith('doc-1');
    });

    it('should handle chunk save failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity());
      mockProcessingService.processWithLLM.mockRejectedValue(
        new Error('Failed to save document chunks'),
      );
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData();
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to save document chunks');
    });

    it('should reject non-lecture doc types with error', async () => {
      const fd = makeFormData({ doc_type: 'exam', has_answers: 'true' });
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('streaming upload');
    });
  });

  // =========================================================================
  // deleteDocument
  // =========================================================================
  describe('deleteDocument', () => {
    it('should delete lecture document via deleteByAdmin', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

      await deleteDocument('doc-1', 'lecture');

      expect(mockDocumentService.deleteByAdmin).toHaveBeenCalledWith('doc-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(deleteDocument('doc-1', 'lecture')).rejects.toThrow('Admin access required');
    });
  });

  // =========================================================================
  // updateDocumentChunks
  // =========================================================================
  describe('updateDocumentChunks', () => {
    it('should update and delete chunks', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.verifyChunksBelongToDocument.mockResolvedValue(true);
      mockDocumentService.deleteChunk.mockResolvedValue(undefined);
      mockDocumentService.updateChunk.mockResolvedValue(undefined);

      const updates = [{ id: 'chunk-1', content: 'updated content', metadata: { type: 'test' } }];
      const deletedIds = ['chunk-2'];

      const result = await updateDocumentChunks('doc-1', updates, deletedIds);

      expect(result).toEqual({ status: 'success', message: 'Changes saved' });
      expect(mockDocumentService.deleteChunk).toHaveBeenCalledWith('chunk-2');
      expect(mockDocumentService.updateChunk).toHaveBeenCalledWith('chunk-1', 'updated content', {
        type: 'test',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge/doc-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(updateDocumentChunks('doc-1', [], [])).rejects.toThrow('Admin access required');
    });

    it('should throw when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      await expect(updateDocumentChunks('doc-1', [], [])).rejects.toThrow('Document not found');
    });
  });

  // =========================================================================
  // regenerateEmbeddings
  // =========================================================================
  describe('regenerateEmbeddings', () => {
    it('should regenerate embeddings for all chunks', async () => {
      mockDocumentService.findById.mockResolvedValue(
        makeDocEntity({ status: 'ready', courseId: null }),
      );
      mockDocumentService.getChunksWithEmbeddings.mockResolvedValue([
        { id: 'chunk-1', content: 'content 1', embedding: [0.1], metadata: {} },
        { id: 'chunk-2', content: 'content 2', embedding: [0.2], metadata: {} },
      ]);
      mockGenerateEmbeddingWithRetry
        .mockResolvedValueOnce([0.9, 0.8])
        .mockResolvedValueOnce([0.7, 0.6]);
      mockDocumentService.updateChunkEmbedding.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'success', message: 'Embeddings regenerated' });
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledTimes(2);
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledWith(
        'chunk-1',
        [0.9, 0.8],
        'doc-1',
      );
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledWith(
        'chunk-2',
        [0.7, 0.6],
        'doc-1',
      );
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'processing',
        'Regenerating embeddings...',
      );
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith('doc-1', 'ready');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(regenerateEmbeddings('doc-1')).rejects.toThrow('Admin access required');
    });

    it('should throw when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      await expect(regenerateEmbeddings('doc-1')).rejects.toThrow('Document not found');
    });

    it('should return error when embedding regeneration fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.getChunksWithEmbeddings.mockResolvedValue([
        { id: 'chunk-1', content: 'content 1', embedding: [0.1], metadata: {} },
      ]);
      mockGenerateEmbeddingWithRetry.mockRejectedValue(new Error('Embedding API down'));
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Failed to regenerate embeddings' });
      expect(mockDocumentService.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'error',
        'Failed to regenerate embeddings',
      );
    });
  });

  // =========================================================================
  // retryDocument
  // =========================================================================
  describe('retryDocument', () => {
    it('should delete chunks and document, then return success', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

      const result = await retryDocument('doc-1', 'lecture');

      expect(result).toEqual({ status: 'success', message: 'Document removed. Please re-upload.' });
      expect(mockDocumentService.deleteChunksByDocumentId).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentService.deleteByAdmin).toHaveBeenCalledWith('doc-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(retryDocument('doc-1', 'lecture')).rejects.toThrow('Admin access required');
    });

    it('should throw when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      await expect(retryDocument('doc-1', 'lecture')).rejects.toThrow('Document not found');
    });
  });

  // =========================================================================
  // updateDocumentMeta
  // =========================================================================
  describe('updateDocumentMeta', () => {
    it('should update document name', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.updateDocumentMetadata.mockResolvedValue(undefined);

      const result = await updateDocumentMeta('doc-1', { name: 'new-name.pdf' });

      expect(result).toEqual({ status: 'success', message: 'Document updated' });
      expect(mockDocumentService.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        name: 'new-name.pdf',
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge/doc-1');
    });

    it('should update school and course metadata', async () => {
      mockDocumentService.findById.mockResolvedValue(
        makeDocEntity({ metadata: { school: 'Old School', course: 'Old Course' }, courseId: null }),
      );
      mockDocumentService.updateDocumentMetadata.mockResolvedValue(undefined);

      const result = await updateDocumentMeta('doc-1', { school: 'MIT', course: 'CS101' });

      expect(result).toEqual({ status: 'success', message: 'Document updated' });
      expect(mockDocumentService.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        metadata: expect.objectContaining({ school: 'MIT', course: 'CS101' }),
      });
    });

    it('should throw when user is not admin', async () => {
      mockRequireAnyAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(updateDocumentMeta('doc-1', { name: 'new-name.pdf' })).rejects.toThrow(
        'Admin access required',
      );
    });

    it('should throw when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      await expect(updateDocumentMeta('doc-1', { name: 'new-name.pdf' })).rejects.toThrow(
        'Document not found',
      );
    });

    it('should return error for invalid input (name too long)', async () => {
      const longName = 'a'.repeat(256);
      const result = await updateDocumentMeta('doc-1', { name: longName });

      expect(result).toEqual({ status: 'error', message: 'Invalid input' });
      expect(mockDocumentService.findById).not.toHaveBeenCalled();
    });

    it('should return error for empty name', async () => {
      const result = await updateDocumentMeta('doc-1', { name: '' });

      expect(result).toEqual({ status: 'error', message: 'Invalid input' });
    });

    it('should merge with existing metadata when updating school only', async () => {
      mockDocumentService.findById.mockResolvedValue(
        makeDocEntity({
          metadata: { school: 'Old', course: 'Existing', otherField: 'keep' },
          courseId: null,
        }),
      );
      mockDocumentService.updateDocumentMetadata.mockResolvedValue(undefined);

      await updateDocumentMeta('doc-1', { school: 'New School' });

      expect(mockDocumentService.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        metadata: expect.objectContaining({
          school: 'New School',
          course: 'Existing',
          otherField: 'keep',
        }),
      });
    });
  });

  // =========================================================================
  // Admin course isolation (requireLectureAccess / requireExamAccess / requireAssignmentAccess)
  // =========================================================================
  describe('admin course isolation', () => {
    describe('lecture — requireLectureAccess', () => {
      it('should deny admin access to document with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockDocumentService.findById.mockResolvedValue(
          makeDocEntity({ userId: MOCK_USER.id, courseId: null }),
        );

        await expect(deleteDocument('doc-1', 'lecture')).rejects.toThrow(ForbiddenError);
      });

      it('should deny admin access to document with null courseId even if owner', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockDocumentService.findById.mockResolvedValue(
          makeDocEntity({ userId: MOCK_USER.id, courseId: null }),
        );

        await expect(retryDocument('doc-1', 'lecture')).rejects.toThrow(
          'No access to this document',
        );
        expect(mockDocumentService.deleteByAdmin).not.toHaveBeenCalled();
      });

      it('should allow super_admin access to document with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'super_admin' });
        mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
        mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
        mockKnowledgeCardService.deleteByDocumentId.mockResolvedValue(undefined);
        mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

        await deleteDocument('doc-1', 'lecture');

        expect(mockDocumentService.deleteByAdmin).toHaveBeenCalledWith('doc-1');
      });

      it('should allow admin access to document with assigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockRequireCourseAdmin.mockResolvedValue(MOCK_USER);
        mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: 'course-1' }));
        mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
        mockKnowledgeCardService.deleteByDocumentId.mockResolvedValue(undefined);
        mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

        await deleteDocument('doc-1', 'lecture');

        expect(mockRequireCourseAdmin).toHaveBeenCalledWith('course-1');
        expect(mockDocumentService.deleteByAdmin).toHaveBeenCalledWith('doc-1');
      });

      it('should deny admin access to document with unassigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockRequireCourseAdmin.mockRejectedValue(new ForbiddenError('No access to this course'));
        mockDocumentService.findById.mockResolvedValue(
          makeDocEntity({ courseId: 'unassigned-course' }),
        );

        await expect(deleteDocument('doc-1', 'lecture')).rejects.toThrow(ForbiddenError);
        expect(mockDocumentService.deleteByAdmin).not.toHaveBeenCalled();
      });
    });

    describe('exam — requireExamAccess', () => {
      it('should deny admin access to exam paper with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockExamPaperRepo.findCourseId.mockResolvedValue(null);

        await expect(deleteDocument('paper-1', 'exam')).rejects.toThrow(
          'No access to this exam paper',
        );
        expect(mockExamPaperRepo.delete).not.toHaveBeenCalled();
      });

      it('should deny admin access to exam paper with null courseId even if owner', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockExamPaperRepo.findCourseId.mockResolvedValue(null);
        mockExamPaperRepo.findOwner.mockResolvedValue(MOCK_USER.id);

        await expect(deleteDocument('paper-1', 'exam')).rejects.toThrow(ForbiddenError);
        expect(mockExamPaperRepo.delete).not.toHaveBeenCalled();
      });

      it('should allow super_admin access to exam paper with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'super_admin' });
        mockExamPaperRepo.delete.mockResolvedValue(undefined);

        await deleteDocument('paper-1', 'exam');

        expect(mockExamPaperRepo.findCourseId).not.toHaveBeenCalled();
        expect(mockExamPaperRepo.delete).toHaveBeenCalledWith('paper-1');
      });

      it('should allow admin access to exam paper with assigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockExamPaperRepo.findCourseId.mockResolvedValue('course-1');
        mockRequireCourseAdmin.mockResolvedValue(MOCK_USER);
        mockExamPaperRepo.delete.mockResolvedValue(undefined);

        await deleteDocument('paper-1', 'exam');

        expect(mockRequireCourseAdmin).toHaveBeenCalledWith('course-1');
        expect(mockExamPaperRepo.delete).toHaveBeenCalledWith('paper-1');
      });

      it('should deny admin access to exam paper with unassigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockExamPaperRepo.findCourseId.mockResolvedValue('unassigned-course');
        mockRequireCourseAdmin.mockRejectedValue(new ForbiddenError('No access'));

        await expect(deleteDocument('paper-1', 'exam')).rejects.toThrow(ForbiddenError);
        expect(mockExamPaperRepo.delete).not.toHaveBeenCalled();
      });
    });

    describe('assignment — requireAssignmentAccess', () => {
      it('should deny admin access to assignment with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockAssignmentRepo.findCourseId.mockResolvedValue(null);

        await expect(deleteDocument('assign-1', 'assignment')).rejects.toThrow(
          'No access to this assignment',
        );
        expect(mockAssignmentRepo.delete).not.toHaveBeenCalled();
      });

      it('should allow super_admin access to assignment with null courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'super_admin' });
        mockAssignmentRepo.delete.mockResolvedValue(undefined);

        await deleteDocument('assign-1', 'assignment');

        expect(mockAssignmentRepo.findCourseId).not.toHaveBeenCalled();
        expect(mockAssignmentRepo.delete).toHaveBeenCalledWith('assign-1');
      });

      it('should allow admin access to assignment with assigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockAssignmentRepo.findCourseId.mockResolvedValue('course-1');
        mockRequireCourseAdmin.mockResolvedValue(MOCK_USER);
        mockAssignmentRepo.delete.mockResolvedValue(undefined);

        await deleteDocument('assign-1', 'assignment');

        expect(mockRequireCourseAdmin).toHaveBeenCalledWith('course-1');
        expect(mockAssignmentRepo.delete).toHaveBeenCalledWith('assign-1');
      });

      it('should deny admin access to assignment with unassigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockAssignmentRepo.findCourseId.mockResolvedValue('unassigned-course');
        mockRequireCourseAdmin.mockRejectedValue(new ForbiddenError('No access'));

        await expect(deleteDocument('assign-1', 'assignment')).rejects.toThrow(ForbiddenError);
        expect(mockAssignmentRepo.delete).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // courseId UUID validation
  // =========================================================================
  describe('uploadDocument courseId validation', () => {
    it('should reject malformed courseId', async () => {
      const fd = makeFormData();
      fd.set('courseId', 'not-a-uuid');

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Invalid course ID');
    });

    it('should accept valid UUID courseId', async () => {
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity());
      mockProcessingService.processWithLLM.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData();
      fd.set('courseId', '550e8400-e29b-41d4-a716-446655440000');

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(mockRequireCourseAdmin).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should require admin to provide courseId', async () => {
      mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });

      const fd = makeFormData();
      // no courseId set

      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('error');
      expect(result.message).toContain('must select a course');
    });
  });
});
