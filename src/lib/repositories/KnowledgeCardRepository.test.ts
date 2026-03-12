/**
 * KnowledgeCardRepository Tests
 *
 * Tests knowledge card database operations including
 * embedding search, entity mapping, upsert dedup logic, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/lib/rag/config', () => ({
  RAG_CONFIG: {
    dedupSimilarityThreshold: 0.9,
  },
}));

// Import after mocks
const { KnowledgeCardRepository } = await import('./KnowledgeCardRepository');

// ── Test Data ──

const knowledgeCardRow = {
  id: 'kc-001',
  title: 'Binary Search',
  definition: 'An efficient search algorithm...',
  key_formulas: ['O(log n)'],
  key_concepts: ['divide and conquer', 'sorted array'],
  examples: ['Finding a word in a dictionary'],
  source_pages: [1, 5],
  embedding: [0.1, 0.2, 0.3],
  created_at: '2025-06-01T10:00:00Z',
  updated_at: '2025-06-01T10:00:00Z',
};

const knowledgeCardEntity = {
  id: 'kc-001',
  title: 'Binary Search',
  definition: 'An efficient search algorithm...',
  keyFormulas: ['O(log n)'],
  keyConcepts: ['divide and conquer', 'sorted array'],
  examples: ['Finding a word in a dictionary'],
  sourcePages: [1, 5],
  createdAt: new Date('2025-06-01T10:00:00Z'),
  updatedAt: new Date('2025-06-01T10:00:00Z'),
};

const knowledgeCardRow2 = {
  id: 'kc-002',
  title: 'Recursion',
  definition: 'A technique where a function calls itself...',
  key_formulas: ['T(n) = T(n-1) + O(1)'],
  key_concepts: ['base case', 'recursive case'],
  examples: ['Fibonacci sequence'],
  source_pages: [10],
  embedding: [0.4, 0.5, 0.6],
  created_at: '2025-06-02T10:00:00Z',
  updated_at: '2025-06-02T10:00:00Z',
};

const knowledgeCardEntity2 = {
  id: 'kc-002',
  title: 'Recursion',
  definition: 'A technique where a function calls itself...',
  keyFormulas: ['T(n) = T(n-1) + O(1)'],
  keyConcepts: ['base case', 'recursive case'],
  examples: ['Fibonacci sequence'],
  sourcePages: [10],
  createdAt: new Date('2025-06-02T10:00:00Z'),
  updatedAt: new Date('2025-06-02T10:00:00Z'),
};

describe('KnowledgeCardRepository', () => {
  let repo: InstanceType<typeof KnowledgeCardRepository>;

  beforeEach(() => {
    repo = new KnowledgeCardRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── searchByEmbedding ──

  describe('searchByEmbedding', () => {
    it('should call RPC with correct parameters and return entities', async () => {
      const rpcRow = {
        ...knowledgeCardRow,
        similarity: 0.95,
      };
      mockSupabase.setResponse([rpcRow]);

      const embedding = [0.1, 0.2, 0.3];
      const result = await repo.searchByEmbedding(embedding, 5);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(knowledgeCardEntity);
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('match_knowledge_cards', {
        query_embedding: embedding,
        match_count: 5,
      });
    });

    it('should return empty array when no matches found', async () => {
      mockSupabase.setResponse([]);

      const result = await repo.searchByEmbedding([0.1, 0.2], 5);

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.searchByEmbedding([0.1, 0.2], 5);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.searchByEmbedding([0.1, 0.2], 5)).rejects.toThrow(DatabaseError);
      await expect(repo.searchByEmbedding([0.1, 0.2], 5)).rejects.toThrow(
        'Failed to search knowledge cards',
      );
    });

    it('should handle null array fields with defaults', async () => {
      const rpcRow = {
        ...knowledgeCardRow,
        key_formulas: null,
        key_concepts: null,
        examples: null,
        source_pages: null,
        similarity: 0.95,
      };
      mockSupabase.setResponse([rpcRow]);

      const result = await repo.searchByEmbedding([0.1], 1);

      expect(result[0].keyFormulas).toEqual([]);
      expect(result[0].keyConcepts).toEqual([]);
      expect(result[0].examples).toEqual([]);
      expect(result[0].sourcePages).toEqual([]);
    });
  });

  // ── findByIds ──

  describe('findByIds', () => {
    it('should return knowledge cards matching the given ids', async () => {
      mockSupabase.setQueryResponse([knowledgeCardRow, knowledgeCardRow2]);

      const result = await repo.findByIds(['kc-001', 'kc-002']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(knowledgeCardEntity);
      expect(result[1]).toEqual(knowledgeCardEntity2);
    });

    it('should query with correct table and in filter', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByIds(['kc-001']);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('knowledge_cards');
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.in).toHaveBeenCalledWith('id', ['kc-001']);
    });

    it('should return empty array for empty ids input', async () => {
      const result = await repo.findByIds([]);

      expect(result).toEqual([]);
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByIds(['kc-001']);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findByIds(['kc-001'])).rejects.toThrow(DatabaseError);
      await expect(repo.findByIds(['kc-001'])).rejects.toThrow('Failed to find knowledge cards');
    });
  });

  // ── updateCard ──

  describe('updateCard', () => {
    it('should update a card and return the entity', async () => {
      const updatedRow = { ...knowledgeCardRow, title: 'Updated Title' };
      mockSupabase.setSingleResponse(updatedRow);

      const result = await repo.updateCard('kc-001', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('knowledge_cards');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'kc-001');
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateCard('kc-001', { title: 'X' })).rejects.toThrow(DatabaseError);
      await expect(repo.updateCard('kc-001', { title: 'X' })).rejects.toThrow(
        'Failed to update knowledge card',
      );
    });

    it('should throw DatabaseError when data is null', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.updateCard('kc-001', { title: 'X' })).rejects.toThrow(DatabaseError);
    });
  });

  // ── upsertByTitle ──

  describe('upsertByTitle', () => {
    it('should update existing card when embedding similarity is above threshold', async () => {
      // RPC returns a high-similarity match
      mockSupabase.setResponse([{ ...knowledgeCardRow, similarity: 0.95 }]);

      // After RPC, the update chain will use setSingleResponse
      // But since mock is shared, we need to set it for the final result
      // The RPC call resolves first, then update chain resolves
      // With our mock, both use the same response - so set for the update result
      mockSupabase.setSingleResponse(knowledgeCardRow);

      const dto = {
        title: 'Binary Search',
        definition: 'An efficient search algorithm...',
        keyFormulas: ['O(log n)'],
        keyConcepts: ['divide and conquer', 'sorted array'],
        examples: ['Finding a word in a dictionary'],
        sourcePages: [1, 5],
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await repo.upsertByTitle(dto);

      expect(result).toEqual(knowledgeCardEntity);
    });

    it('should fall back to DB upsert when no embedding provided', async () => {
      mockSupabase.setSingleResponse(knowledgeCardRow);

      const dto = {
        title: 'Binary Search',
        definition: 'An efficient search algorithm...',
      };

      const result = await repo.upsertByTitle(dto);

      expect(result).toEqual(knowledgeCardEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('knowledge_cards');
      expect(mockSupabase.client._chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Binary Search',
          definition: 'An efficient search algorithm...',
          embedding: null,
        }),
        { onConflict: 'title' },
      );
    });

    it('should fall back to DB upsert when no embedding provided', async () => {
      const upsertedRow = {
        id: 'card-new',
        title: 'New Card',
        definition: 'A brand new concept',
        key_formulas: [],
        key_concepts: [],
        examples: [],
        source_pages: [],
        embedding: null,
        created_at: '2025-06-01T00:00:00Z',
        updated_at: '2025-06-01T00:00:00Z',
      };
      mockSupabase.setSingleResponse(upsertedRow);

      const dto = {
        title: 'New Card',
        definition: 'A brand new concept',
      };

      const result = await repo.upsertByTitle(dto);

      expect(result.id).toBe('card-new');
      expect(result.title).toBe('New Card');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('knowledge_cards');
      expect(mockSupabase.client._chain.upsert).toHaveBeenCalled();
      // Should NOT call RPC since no embedding
      expect(mockSupabase.client.rpc).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on upsert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Upsert failed'));

      const dto = {
        title: 'Test',
        definition: 'Test definition',
      };

      await expect(repo.upsertByTitle(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.upsertByTitle(dto)).rejects.toThrow('Failed to upsert knowledge card');
    });

    it('should throw DatabaseError when upsert data is null', async () => {
      mockSupabase.setResponse(null);

      const dto = {
        title: 'Test',
        definition: 'Test definition',
      };

      await expect(repo.upsertByTitle(dto)).rejects.toThrow(DatabaseError);
    });

    it('should include optional fields with defaults in upsert', async () => {
      mockSupabase.setSingleResponse(knowledgeCardRow);

      const dto = {
        title: 'Test',
        definition: 'Test definition',
        keyFormulas: ['f=ma'],
        keyConcepts: ['force'],
        examples: ['pushing a box'],
        sourcePages: [3],
      };

      await repo.upsertByTitle(dto);

      expect(mockSupabase.client._chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key_formulas: ['f=ma'],
          key_concepts: ['force'],
          examples: ['pushing a box'],
          source_pages: [3],
          embedding: null,
        }),
        { onConflict: 'title' },
      );
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([knowledgeCardRow]);

      const result = await repo.findByIds(['kc-001']);

      expect(result[0].keyFormulas).toEqual(knowledgeCardRow.key_formulas);
      expect(result[0].keyConcepts).toEqual(knowledgeCardRow.key_concepts);
      expect(result[0].sourcePages).toEqual(knowledgeCardRow.source_pages);
      expect(result[0].createdAt).toEqual(new Date(knowledgeCardRow.created_at));
      expect(result[0].updatedAt).toEqual(new Date(knowledgeCardRow.updated_at));
    });

    it('should handle null array fields with empty array defaults', async () => {
      const rowWithNulls = {
        ...knowledgeCardRow,
        key_formulas: null,
        key_concepts: null,
        examples: null,
        source_pages: null,
      };
      mockSupabase.setQueryResponse([rowWithNulls]);

      const result = await repo.findByIds(['kc-001']);

      expect(result[0].keyFormulas).toEqual([]);
      expect(result[0].keyConcepts).toEqual([]);
      expect(result[0].examples).toEqual([]);
      expect(result[0].sourcePages).toEqual([]);
    });
  });
});
