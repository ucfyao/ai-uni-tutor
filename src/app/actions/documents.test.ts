import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/lib/domain/models/Document';
import { ForbiddenError, QuotaExceededError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  requireAdmin: () => mockRequireAdmin(),
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
  deleteDocument: vi.fn(),
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

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

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
    mockRequireAdmin.mockResolvedValue(MOCK_USER);
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
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));
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

    it('should process exam document with questions', async () => {
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity({ docType: 'exam' }));
      mockProcessingService.processWithLLM.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData({ doc_type: 'exam' });
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(mockProcessingService.processWithLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-1',
          docType: 'exam',
        }),
      );
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

    it('should pass has_answers to processWithLLM for exam type', async () => {
      mockDocumentService.checkDuplicate.mockResolvedValue(false);
      mockDocumentService.createDocument.mockResolvedValue(makeDocEntity({ docType: 'exam' }));
      mockProcessingService.processWithLLM.mockResolvedValue(undefined);
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const fd = makeFormData({ doc_type: 'exam', has_answers: 'true' });
      const result = await uploadDocument(INITIAL_STATE, fd);

      expect(result.status).toBe('success');
      expect(mockProcessingService.processWithLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAnswers: true,
        }),
      );
    });
  });

  // =========================================================================
  // deleteDocument
  // =========================================================================
  describe('deleteDocument', () => {
    it('should delete document for authenticated user', async () => {
      mockDocumentService.deleteDocument.mockResolvedValue(undefined);

      await deleteDocument('doc-1');

      expect(mockDocumentService.deleteDocument).toHaveBeenCalledWith('doc-1', 'user-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(deleteDocument('doc-1')).rejects.toThrow('Admin access required');
    });
  });

  // =========================================================================
  // updateDocumentChunks
  // =========================================================================
  describe('updateDocumentChunks', () => {
    it('should update and delete chunks for document owner', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity());
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
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(updateDocumentChunks('doc-1', [], [])).rejects.toThrow('Admin access required');
    });

    it('should return error when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      const result = await updateDocumentChunks('doc-1', [], []);

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });

    it('should return error when document belongs to another user', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ userId: 'other-user' }));

      const result = await updateDocumentChunks('doc-1', [], []);

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });
  });

  // =========================================================================
  // regenerateEmbeddings
  // =========================================================================
  describe('regenerateEmbeddings', () => {
    it('should regenerate embeddings for all chunks', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ status: 'ready' }));
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
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(regenerateEmbeddings('doc-1')).rejects.toThrow('Admin access required');
    });

    it('should return error when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });

    it('should return error when document belongs to another user', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ userId: 'other-user' }));

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });

    it('should handle embedding regeneration error gracefully', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDocumentService.findById.mockResolvedValue(makeDocEntity());
      mockDocumentService.getChunksWithEmbeddings.mockResolvedValue([
        { id: 'chunk-1', content: 'content 1', embedding: [0.1], metadata: {} },
      ]);
      mockGenerateEmbeddingWithRetry.mockRejectedValue(new Error('Embedding API down'));
      mockDocumentService.updateStatus.mockResolvedValue(undefined);

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'success', message: 'Embeddings regenerated' });
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
      mockDocumentService.findById.mockResolvedValue(makeDocEntity());
      mockDocumentService.deleteChunksByDocumentId.mockResolvedValue(undefined);
      mockDocumentService.deleteDocument.mockResolvedValue(undefined);

      const result = await retryDocument('doc-1');

      expect(result).toEqual({ status: 'success', message: 'Document removed. Please re-upload.' });
      expect(mockDocumentService.deleteChunksByDocumentId).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentService.deleteDocument).toHaveBeenCalledWith('doc-1', 'user-1');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/knowledge');
    });

    it('should throw when user is not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(retryDocument('doc-1')).rejects.toThrow('Admin access required');
    });

    it('should return error when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      const result = await retryDocument('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });

    it('should return error when document belongs to another user', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ userId: 'other-user' }));

      const result = await retryDocument('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });
  });

  // =========================================================================
  // updateDocumentMeta
  // =========================================================================
  describe('updateDocumentMeta', () => {
    it('should update document name', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity());
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
        makeDocEntity({ metadata: { school: 'Old School', course: 'Old Course' } }),
      );
      mockDocumentService.updateDocumentMetadata.mockResolvedValue(undefined);

      const result = await updateDocumentMeta('doc-1', { school: 'MIT', course: 'CS101' });

      expect(result).toEqual({ status: 'success', message: 'Document updated' });
      expect(mockDocumentService.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        metadata: expect.objectContaining({ school: 'MIT', course: 'CS101' }),
      });
    });

    it('should throw when user is not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new ForbiddenError('Admin access required'));

      await expect(updateDocumentMeta('doc-1', { name: 'new-name.pdf' })).rejects.toThrow(
        'Admin access required',
      );
    });

    it('should return error when document is not found', async () => {
      mockDocumentService.findById.mockResolvedValue(null);

      const result = await updateDocumentMeta('doc-1', { name: 'new-name.pdf' });

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
    });

    it('should return error when document belongs to another user', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ userId: 'other-user' }));

      const result = await updateDocumentMeta('doc-1', { name: 'test' });

      expect(result).toEqual({ status: 'error', message: 'Document not found' });
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
        makeDocEntity({ metadata: { school: 'Old', course: 'Existing', otherField: 'keep' } }),
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
});
