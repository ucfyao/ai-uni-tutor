import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LectureDocumentEntity } from '@/lib/domain/models/Document';
import { ForbiddenError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const mockRequireAnyAdmin = vi.fn();
const mockRequireCourseAdmin = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => Promise.resolve(MOCK_USER),
  requireAnyAdmin: () => mockRequireAnyAdmin(),
  requireCourseAdmin: (courseId: string) => mockRequireCourseAdmin(courseId),
  requireAssignmentAccess: async (assignmentId: string, _userId: string, role: string) => {
    if (role === 'super_admin') return;
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const repo = getAssignmentRepository();
    const courseId = await repo.findCourseId(assignmentId);
    if (courseId) {
      await mockRequireCourseAdmin(courseId);
    } else {
      const { ForbiddenError } = await import('@/lib/errors');
      throw new ForbiddenError('No access to this assignment');
    }
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockDocumentService = {
  checkDuplicate: vi.fn(),
  createDocument: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  saveChunks: vi.fn(),
  deleteByAdmin: vi.fn(),
  deleteChunksByLectureDocumentId: vi.fn(),
  findById: vi.fn(),
  deleteChunk: vi.fn(),
  updateChunk: vi.fn(),
  getChunks: vi.fn(),
  getChunksWithEmbeddings: vi.fn(),
  updateChunkEmbedding: vi.fn(),
  updateDocumentMetadata: vi.fn(),
  verifyChunksBelongToLectureDocument: vi.fn(),
  saveChunksAndReturn: vi.fn(),
  getDocumentsForAdmin: vi.fn(),
  findOutlinesByCourseId: vi.fn(),
};
vi.mock('@/lib/services/DocumentService', () => ({
  getLectureDocumentService: () => mockDocumentService,
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

const mockParseLectureMultiPass = vi.fn();
const mockParseQuestions = vi.fn();
vi.mock('@/lib/rag/parsers/lecture-parser', () => ({
  parseLectureMultiPass: (...args: unknown[]) => mockParseLectureMultiPass(...args),
}));
vi.mock('@/lib/rag/parsers/question-parser', () => ({
  parseQuestions: (...args: unknown[]) => mockParseQuestions(...args),
}));

vi.mock('@/lib/services/KnowledgeCardService', () => ({
  getKnowledgeCardService: () => ({}),
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
  deleteItemsByAssignmentId: vi.fn(),
};
vi.mock('@/lib/repositories/AssignmentRepository', () => ({
  getAssignmentRepository: () => mockAssignmentRepo,
}));

const mockAssignmentService = {
  deleteAssignment: vi.fn(),
};
vi.mock('@/lib/services/AssignmentService', () => ({
  getAssignmentService: () => mockAssignmentService,
}));

// ---------------------------------------------------------------------------
// Import actions (after mocks)
// ---------------------------------------------------------------------------

const {
  deleteDocument,
  updateDocumentChunks,
  regenerateEmbeddings,
  retryDocument,
  updateDocumentMeta,
  getLectureOutlines,
} = await import('./documents');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocEntity(overrides: Partial<LectureDocumentEntity> = {}): LectureDocumentEntity {
  return {
    id: 'doc-1',
    userId: 'user-1',
    name: 'test.pdf',
    status: 'draft',
    metadata: { school: 'MIT', course: 'CS101' },
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
  // deleteDocument
  // =========================================================================
  describe('deleteDocument', () => {
    it('should delete lecture document via deleteByAdmin', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.deleteChunksByLectureDocumentId.mockResolvedValue(undefined);
      mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

      await deleteDocument('doc-1', 'lecture');

      expect(mockDocumentService.deleteChunksByLectureDocumentId).toHaveBeenCalledWith('doc-1');
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
      mockDocumentService.verifyChunksBelongToLectureDocument.mockResolvedValue(true);
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

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'success', message: 'Embeddings regenerated' });
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledTimes(2);
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledWith('chunk-1', [0.9, 0.8]);
      expect(mockDocumentService.updateChunkEmbedding).toHaveBeenCalledWith('chunk-2', [0.7, 0.6]);
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

      const result = await regenerateEmbeddings('doc-1');

      expect(result).toEqual({ status: 'error', message: 'Failed to regenerate embeddings' });
    });
  });

  // =========================================================================
  // retryDocument
  // =========================================================================
  describe('retryDocument', () => {
    it('should clear chunks and unpublish document, then return success', async () => {
      mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: null }));
      mockDocumentService.deleteChunksByLectureDocumentId.mockResolvedValue(undefined);
      mockDocumentService.unpublish.mockResolvedValue(undefined);

      const result = await retryDocument('doc-1', 'lecture');

      expect(result).toEqual({
        status: 'success',
        message: 'Items cleared. Upload a new PDF to re-parse.',
      });
      expect(mockDocumentService.deleteChunksByLectureDocumentId).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentService.unpublish).toHaveBeenCalledWith('doc-1');
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
        mockDocumentService.deleteChunksByLectureDocumentId.mockResolvedValue(undefined);
        mockDocumentService.deleteByAdmin.mockResolvedValue(undefined);

        await deleteDocument('doc-1', 'lecture');

        expect(mockDocumentService.deleteByAdmin).toHaveBeenCalledWith('doc-1');
      });

      it('should allow admin access to document with assigned courseId', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'admin' });
        mockRequireCourseAdmin.mockResolvedValue(MOCK_USER);
        mockDocumentService.findById.mockResolvedValue(makeDocEntity({ courseId: 'course-1' }));
        mockDocumentService.deleteChunksByLectureDocumentId.mockResolvedValue(undefined);
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

    describe('assignment', () => {
      it('should delete assignment via AssignmentService', async () => {
        mockRequireAnyAdmin.mockResolvedValue({ user: MOCK_USER, role: 'super_admin' });
        mockAssignmentRepo.findCourseId.mockResolvedValue(null);
        mockAssignmentService.deleteAssignment.mockResolvedValue(undefined);

        await deleteDocument('assign-1', 'assignment');

        expect(mockAssignmentService.deleteAssignment).toHaveBeenCalledWith('assign-1');
      });
    });
  });

  // =========================================================================
  // getLectureOutlines
  // =========================================================================
  describe('getLectureOutlines', () => {
    it('should return outlines for a course', async () => {
      mockDocumentService.findOutlinesByCourseId.mockResolvedValue([
        {
          id: 'doc-1',
          outline: {
            title: 'Algorithms',
            summary: '3 sections, 5 knowledge points.',
            sections: [
              {
                title: 'Sorting',
                briefDescription: 'Overview of sorting algorithms',
                knowledgePoints: ['Bubble Sort', 'Merge Sort'],
                knowledgePointDetails: [
                  { title: 'Bubble Sort', content: 'Simple comparison-based sort' },
                  { title: 'Merge Sort', content: 'Divide-and-conquer sort' },
                ],
              },
            ],
          },
        },
      ]);

      const result = await getLectureOutlines('a0000000-0000-4000-a000-000000000001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].outline.title).toBe('Algorithms');
      }
    });

    it('should return empty array when no outlines exist', async () => {
      mockDocumentService.findOutlinesByCourseId.mockResolvedValue([]);

      const result = await getLectureOutlines('a0000000-0000-4000-a000-000000000001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should return error for invalid course ID', async () => {
      const result = await getLectureOutlines('not-a-uuid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid course ID');
      }
    });
  });
});
