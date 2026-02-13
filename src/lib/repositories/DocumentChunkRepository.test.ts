/**
 * DocumentChunkRepository Tests
 *
 * Tests all document chunk database operations including batch insert,
 * entity mapping (snake_case -> camelCase), and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chunkEntity,
  chunkEntityNoEmbedding,
  chunkRow,
  chunkRowNoEmbedding,
} from '@/__tests__/fixtures/documents';
import {
  createMockSupabase,
  dbError,
  type MockSupabaseResult,
} from '@/__tests__/helpers/mockSupabase';
import { DatabaseError } from '@/lib/errors';

// ── Mocks ──

let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

// Import after mocks
const { DocumentChunkRepository } = await import('./DocumentChunkRepository');

describe('DocumentChunkRepository', () => {
  let repo: InstanceType<typeof DocumentChunkRepository>;

  beforeEach(() => {
    repo = new DocumentChunkRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── createBatch ──

  describe('createBatch', () => {
    it('should insert multiple chunks', async () => {
      mockSupabase.setResponse(null);

      const chunks = [
        {
          documentId: 'doc-001',
          content: 'chunk 1 content',
          embedding: [0.1, 0.2],
          metadata: { page: 1 },
        },
        {
          documentId: 'doc-001',
          content: 'chunk 2 content',
          embedding: [0.3, 0.4],
          metadata: { page: 2 },
        },
      ];

      await repo.createBatch(chunks);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith([
        {
          document_id: 'doc-001',
          content: 'chunk 1 content',
          embedding: [0.1, 0.2],
          metadata: { page: 1 },
        },
        {
          document_id: 'doc-001',
          content: 'chunk 2 content',
          embedding: [0.3, 0.4],
          metadata: { page: 2 },
        },
      ]);
    });

    it('should return early for empty array without calling supabase', async () => {
      await repo.createBatch([]);

      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const chunks = [
        {
          documentId: 'doc-001',
          content: 'chunk content',
          embedding: [0.1],
          metadata: {},
        },
      ];

      await expect(repo.createBatch(chunks)).rejects.toThrow(DatabaseError);
      await expect(repo.createBatch(chunks)).rejects.toThrow('Failed to insert document chunks');
    });
  });

  // ── createBatchAndReturn ──

  describe('createBatchAndReturn', () => {
    it('should insert chunks and return their ids', async () => {
      mockSupabase.setSingleResponse([{ id: 'chunk-001' }, { id: 'chunk-002' }]);

      const chunks = [
        {
          documentId: 'doc-001',
          content: 'chunk 1',
          embedding: [0.1],
          metadata: { page: 1 },
        },
        {
          documentId: 'doc-001',
          content: 'chunk 2',
          embedding: [0.2],
          metadata: { page: 2 },
        },
      ];

      // The method calls .insert().select('id') which doesn't end with .single(),
      // so we need to use setQueryResponse for list-like returns
      mockSupabase.setResponse([{ id: 'chunk-001' }, { id: 'chunk-002' }]);

      const result = await repo.createBatchAndReturn(chunks);

      expect(result).toEqual([{ id: 'chunk-001' }, { id: 'chunk-002' }]);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith([
        {
          document_id: 'doc-001',
          content: 'chunk 1',
          embedding: [0.1],
          metadata: { page: 1 },
        },
        {
          document_id: 'doc-001',
          content: 'chunk 2',
          embedding: [0.2],
          metadata: { page: 2 },
        },
      ]);
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
    });

    it('should return empty array for empty input without calling supabase', async () => {
      const result = await repo.createBatchAndReturn([]);

      expect(result).toEqual([]);
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const chunks = [
        {
          documentId: 'doc-001',
          content: 'chunk 1',
          embedding: [0.1],
          metadata: {},
        },
      ];

      const result = await repo.createBatchAndReturn(chunks);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const chunks = [
        {
          documentId: 'doc-001',
          content: 'chunk content',
          embedding: [0.1],
          metadata: {},
        },
      ];

      await expect(repo.createBatchAndReturn(chunks)).rejects.toThrow(DatabaseError);
      await expect(repo.createBatchAndReturn(chunks)).rejects.toThrow(
        'Failed to insert document chunks',
      );
    });
  });

  // ── deleteByDocumentId ──

  describe('deleteByDocumentId', () => {
    it('should delete all chunks for a document', async () => {
      mockSupabase.setResponse(null);

      await repo.deleteByDocumentId('doc-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('document_id', 'doc-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.deleteByDocumentId('doc-001')).rejects.toThrow(DatabaseError);
      await expect(repo.deleteByDocumentId('doc-001')).rejects.toThrow(
        'Failed to delete document chunks',
      );
    });
  });

  // ── findByDocumentId ──

  describe('findByDocumentId', () => {
    it('should return mapped chunk entities', async () => {
      mockSupabase.setQueryResponse([chunkRow, chunkRowNoEmbedding]);

      const result = await repo.findByDocumentId('doc-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(chunkEntity);
      expect(result[1]).toEqual(chunkEntityNoEmbedding);
    });

    it('should call with correct select fields and ordering', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByDocumentId('doc-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith(
        'id, document_id, content, metadata, embedding',
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('document_id', 'doc-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('should return empty array when no chunks exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByDocumentId('doc-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByDocumentId('doc-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findByDocumentId('doc-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findByDocumentId('doc-001')).rejects.toThrow('Failed to fetch chunks');
    });
  });

  // ── updateChunk ──

  describe('updateChunk', () => {
    it('should update content only', async () => {
      mockSupabase.setResponse(null);

      await repo.updateChunk('chunk-001', 'Updated content');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        content: 'Updated content',
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'chunk-001');
    });

    it('should update content and metadata when metadata is provided', async () => {
      mockSupabase.setResponse(null);

      const metadata = { page: 5, section: 'Updated' };
      await repo.updateChunk('chunk-001', 'Updated content', metadata);

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        content: 'Updated content',
        metadata,
      });
    });

    it('should not include metadata when undefined', async () => {
      mockSupabase.setResponse(null);

      await repo.updateChunk('chunk-001', 'content');

      const updateArg = mockSupabase.client._chain.update.mock.calls[0][0];
      expect(updateArg).not.toHaveProperty('metadata');
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateChunk('chunk-001', 'content')).rejects.toThrow(DatabaseError);
      await expect(repo.updateChunk('chunk-001', 'content')).rejects.toThrow(
        'Failed to update chunk',
      );
    });
  });

  // ── deleteChunk ──

  describe('deleteChunk', () => {
    it('should delete a chunk by id', async () => {
      mockSupabase.setResponse(null);

      await repo.deleteChunk('chunk-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'chunk-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.deleteChunk('chunk-001')).rejects.toThrow(DatabaseError);
      await expect(repo.deleteChunk('chunk-001')).rejects.toThrow('Failed to delete chunk');
    });
  });

  // ── updateEmbedding ──

  describe('updateEmbedding', () => {
    it('should update embedding for a chunk', async () => {
      mockSupabase.setResponse(null);

      const embedding = [0.1, 0.2, 0.3];
      await repo.updateEmbedding('chunk-001', embedding);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('document_chunks');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ embedding });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'chunk-001');
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateEmbedding('chunk-001', [0.1])).rejects.toThrow(DatabaseError);
      await expect(repo.updateEmbedding('chunk-001', [0.1])).rejects.toThrow(
        'Failed to update embedding',
      );
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([chunkRow]);

      const result = await repo.findByDocumentId('doc-001');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(chunkRow.id);
      expect(result[0].documentId).toBe(chunkRow.document_id);
      expect(result[0].content).toBe(chunkRow.content);
      expect(result[0].metadata).toEqual(chunkRow.metadata);
      expect(result[0].embedding).toEqual(chunkRow.embedding);
    });

    it('should handle null embedding', async () => {
      mockSupabase.setQueryResponse([chunkRowNoEmbedding]);

      const result = await repo.findByDocumentId('doc-001');

      expect(result[0].embedding).toBeNull();
    });
  });
});
