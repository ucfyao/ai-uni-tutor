import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreateLectureChunkDTO,
  LectureChunkEntity,
  LectureDocumentEntity,
} from '@/lib/domain/models/Document';
import { ForbiddenError } from '@/lib/errors';
import type { LectureChunkRepository } from '@/lib/repositories/DocumentChunkRepository';
import type { LectureDocumentRepository } from '@/lib/repositories/DocumentRepository';
import { LectureDocumentService } from './DocumentService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date('2025-01-15T12:00:00Z');

function makeDocEntity(overrides: Partial<LectureDocumentEntity> = {}): LectureDocumentEntity {
  return {
    id: 'doc-1',
    userId: 'user-1',
    name: 'Lecture Notes.pdf',
    status: 'ready',
    metadata: {},
    courseId: 'course-1',
    outline: null,
    createdAt: now,
    ...overrides,
  };
}

function makeChunkEntity(overrides: Partial<LectureChunkEntity> = {}): LectureChunkEntity {
  return {
    id: 'chunk-1',
    lectureDocumentId: 'doc-1',
    content: 'Chunk text content',
    metadata: { page: 1 },
    embedding: null,
    ...overrides,
  };
}

function createMockDocRepo(): Record<keyof LectureDocumentRepository, ReturnType<typeof vi.fn>> {
  return {
    findById: vi.fn(),
    findByUserIdAndName: vi.fn(),
    create: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    updateMetadata: vi.fn(),
    delete: vi.fn(),
    verifyOwnership: vi.fn(),
    findByUserId: vi.fn(),
    findForAdmin: vi.fn(),
    deleteById: vi.fn(),
    findOutlinesByCourseId: vi.fn(),
    saveOutline: vi.fn(),
  };
}

function createMockChunkRepo(): Record<keyof LectureChunkRepository, ReturnType<typeof vi.fn>> {
  return {
    createBatch: vi.fn(),
    createBatchAndReturn: vi.fn(),
    deleteByLectureDocumentId: vi.fn(),
    findByLectureDocumentId: vi.fn(),
    updateChunk: vi.fn(),
    deleteChunk: vi.fn(),
    updateEmbedding: vi.fn(),
    verifyChunksBelongToLectureDocument: vi.fn(),
    findByLectureDocumentIdWithEmbeddings: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LectureDocumentService', () => {
  let docRepo: ReturnType<typeof createMockDocRepo>;
  let chunkRepo: ReturnType<typeof createMockChunkRepo>;
  let service: LectureDocumentService;

  beforeEach(() => {
    vi.clearAllMocks();
    docRepo = createMockDocRepo();
    chunkRepo = createMockChunkRepo();
    service = new LectureDocumentService(
      docRepo as unknown as LectureDocumentRepository,
      chunkRepo as unknown as LectureChunkRepository,
    );
  });

  // =========================================================================
  // checkDuplicate
  // =========================================================================
  describe('checkDuplicate', () => {
    it('should return true when document with same name exists', async () => {
      docRepo.findByUserIdAndName.mockResolvedValue(makeDocEntity());

      const result = await service.checkDuplicate('user-1', 'Lecture Notes.pdf');

      expect(result).toBe(true);
      expect(docRepo.findByUserIdAndName).toHaveBeenCalledWith('user-1', 'Lecture Notes.pdf');
    });

    it('should return false when no document with that name exists', async () => {
      docRepo.findByUserIdAndName.mockResolvedValue(null);

      const result = await service.checkDuplicate('user-1', 'new-file.pdf');

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // createDocument
  // =========================================================================
  describe('createDocument', () => {
    it('should create a document with required fields', async () => {
      const created = makeDocEntity({ status: 'draft' });
      docRepo.create.mockResolvedValue(created);

      const result = await service.createDocument('user-1', 'New Doc.pdf');

      expect(docRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'New Doc.pdf',
        status: 'draft',
        metadata: undefined,
        courseId: undefined,
      });
      expect(result.id).toBe('doc-1');
    });

    it('should create a document with all optional fields', async () => {
      const created = makeDocEntity();
      docRepo.create.mockResolvedValue(created);

      const result = await service.createDocument(
        'user-1',
        'Lecture.pdf',
        { pages: 10 },
        'course-1',
      );

      expect(docRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Lecture.pdf',
        status: 'draft',
        metadata: { pages: 10 },
        courseId: 'course-1',
      });
      expect(result).toEqual(created);
    });
  });

  // =========================================================================
  // saveChunks
  // =========================================================================
  describe('saveChunks', () => {
    it('should delegate to chunkRepo.createBatch', async () => {
      chunkRepo.createBatch.mockResolvedValue(undefined);

      const chunks: CreateLectureChunkDTO[] = [
        { lectureDocumentId: 'doc-1', content: 'Chunk 1' },
        { lectureDocumentId: 'doc-1', content: 'Chunk 2' },
      ];

      await service.saveChunks(chunks);

      expect(chunkRepo.createBatch).toHaveBeenCalledWith(chunks);
    });
  });

  // =========================================================================
  // saveChunksAndReturn
  // =========================================================================
  describe('saveChunksAndReturn', () => {
    it('should delegate and return chunk IDs', async () => {
      const ids = [{ id: 'chunk-1' }, { id: 'chunk-2' }];
      chunkRepo.createBatchAndReturn.mockResolvedValue(ids);

      const chunks: CreateLectureChunkDTO[] = [
        { lectureDocumentId: 'doc-1', content: 'Chunk 1' },
        { lectureDocumentId: 'doc-1', content: 'Chunk 2' },
      ];

      const result = await service.saveChunksAndReturn(chunks);

      expect(result).toEqual(ids);
      expect(chunkRepo.createBatchAndReturn).toHaveBeenCalledWith(chunks);
    });
  });

  // =========================================================================
  // deleteDocument
  // =========================================================================
  describe('deleteDocument', () => {
    it('should delete document when user is owner', async () => {
      docRepo.verifyOwnership.mockResolvedValue(true);
      docRepo.delete.mockResolvedValue(undefined);

      await service.deleteDocument('doc-1', 'user-1');

      expect(docRepo.verifyOwnership).toHaveBeenCalledWith('doc-1', 'user-1');
      expect(docRepo.delete).toHaveBeenCalledWith('doc-1', 'user-1');
    });

    it('should throw ForbiddenError when user is not owner', async () => {
      docRepo.verifyOwnership.mockResolvedValue(false);

      await expect(service.deleteDocument('doc-1', 'user-bad')).rejects.toThrow(ForbiddenError);
      await expect(service.deleteDocument('doc-1', 'user-bad')).rejects.toThrow(
        'You do not own this document',
      );
      expect(docRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // findById
  // =========================================================================
  describe('findById', () => {
    it('should return document when found', async () => {
      const doc = makeDocEntity();
      docRepo.findById.mockResolvedValue(doc);

      const result = await service.findById('doc-1');

      expect(result).toEqual(doc);
      expect(docRepo.findById).toHaveBeenCalledWith('doc-1');
    });

    it('should return null when not found', async () => {
      docRepo.findById.mockResolvedValue(null);

      const result = await service.findById('doc-99');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getChunks
  // =========================================================================
  describe('getChunks', () => {
    it('should return chunks for a document', async () => {
      const chunks = [makeChunkEntity(), makeChunkEntity({ id: 'chunk-2' })];
      chunkRepo.findByLectureDocumentId.mockResolvedValue(chunks);

      const result = await service.getChunks('doc-1');

      expect(result).toEqual(chunks);
      expect(chunkRepo.findByLectureDocumentId).toHaveBeenCalledWith('doc-1');
    });

    it('should return empty array when no chunks exist', async () => {
      chunkRepo.findByLectureDocumentId.mockResolvedValue([]);

      const result = await service.getChunks('doc-empty');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // updateChunk
  // =========================================================================
  describe('updateChunk', () => {
    it('should update chunk content without metadata', async () => {
      chunkRepo.updateChunk.mockResolvedValue(undefined);

      await service.updateChunk('chunk-1', 'Updated content');

      expect(chunkRepo.updateChunk).toHaveBeenCalledWith('chunk-1', 'Updated content', undefined);
    });

    it('should update chunk content with metadata', async () => {
      chunkRepo.updateChunk.mockResolvedValue(undefined);

      await service.updateChunk('chunk-1', 'Updated content', { page: 3 });

      expect(chunkRepo.updateChunk).toHaveBeenCalledWith('chunk-1', 'Updated content', {
        page: 3,
      });
    });
  });

  // =========================================================================
  // deleteChunk
  // =========================================================================
  describe('deleteChunk', () => {
    it('should delete a single chunk', async () => {
      chunkRepo.deleteChunk.mockResolvedValue(undefined);

      await service.deleteChunk('chunk-1');

      expect(chunkRepo.deleteChunk).toHaveBeenCalledWith('chunk-1');
    });
  });

  // =========================================================================
  // deleteChunksByLectureDocumentId
  // =========================================================================
  describe('deleteChunksByLectureDocumentId', () => {
    it('should delete all chunks for a document', async () => {
      chunkRepo.deleteByLectureDocumentId.mockResolvedValue(undefined);

      await service.deleteChunksByLectureDocumentId('doc-1');

      expect(chunkRepo.deleteByLectureDocumentId).toHaveBeenCalledWith('doc-1');
    });
  });

  // =========================================================================
  // updateChunkEmbedding
  // =========================================================================
  describe('updateChunkEmbedding', () => {
    it('should update embedding for a chunk', async () => {
      chunkRepo.updateEmbedding.mockResolvedValue(undefined);

      const embedding = [0.1, 0.2, 0.3];
      await service.updateChunkEmbedding('chunk-1', embedding);

      expect(chunkRepo.updateEmbedding).toHaveBeenCalledWith('chunk-1', embedding);
    });
  });

  // =========================================================================
  // updateDocumentMetadata
  // =========================================================================
  describe('updateDocumentMetadata', () => {
    it('should update document name', async () => {
      docRepo.updateMetadata.mockResolvedValue(undefined);

      await service.updateDocumentMetadata('doc-1', { name: 'Renamed.pdf' });

      expect(docRepo.updateMetadata).toHaveBeenCalledWith('doc-1', { name: 'Renamed.pdf' });
    });

    it('should update document metadata', async () => {
      docRepo.updateMetadata.mockResolvedValue(undefined);

      await service.updateDocumentMetadata('doc-1', { metadata: { pages: 20 } });

      expect(docRepo.updateMetadata).toHaveBeenCalledWith('doc-1', { metadata: { pages: 20 } });
    });

    it('should update multiple fields at once', async () => {
      docRepo.updateMetadata.mockResolvedValue(undefined);

      const updates = {
        name: 'New Name.pdf',
        metadata: { pages: 5 },
      };
      await service.updateDocumentMetadata('doc-1', updates);

      expect(docRepo.updateMetadata).toHaveBeenCalledWith('doc-1', updates);
    });
  });
});
