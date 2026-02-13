import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import { createMockSupabase, type MockSupabaseResult } from '@/__tests__/helpers/mockSupabase';

// ── Mocks ──

let mockGemini: MockGeminiResult;
let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/gemini', () => {
  mockGemini = createMockGemini();
  return {
    genAI: mockGemini.client,
    getGenAI: () => mockGemini.client,
  };
});

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

// Import after mocks
const { retrieveContext } = await import('./retrieval');

describe('retrieval', () => {
  beforeEach(() => {
    mockGemini.reset();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── retrieveContext ──

  describe('retrieveContext', () => {
    it('should return formatted context with page citations', async () => {
      const fakeEmbedding = [0.1, 0.2, 0.3];
      mockGemini.setEmbeddingResponse(fakeEmbedding);

      mockSupabase.setResponse([
        { content: 'First chunk of content.', metadata: { page: 1 } },
        { content: 'Second chunk of content.', metadata: { page: 3 } },
      ]);

      const result = await retrieveContext('What is machine learning?');

      expect(result).toBe(
        'First chunk of content. (Page 1)\n\n---\n\nSecond chunk of content. (Page 3)',
      );
    });

    it('should call embedding with the query text', async () => {
      mockGemini.setEmbeddingResponse([0.1, 0.2]);
      mockSupabase.setResponse([]);

      await retrieveContext('test query');

      expect(mockGemini.client.models.embedContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: 'test query',
        }),
      );
    });

    it('should call hybrid_search RPC with correct parameters', async () => {
      const fakeEmbedding = [0.5, 0.6];
      mockGemini.setEmbeddingResponse(fakeEmbedding);
      mockSupabase.setResponse([]);

      await retrieveContext('query text', { knowledge_id: 'abc' }, 10);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('hybrid_search', {
        query_text: 'query text',
        query_embedding: fakeEmbedding,
        match_threshold: 0.5, // RAG_CONFIG.matchThreshold
        match_count: 10,
        rrf_k: 60, // RAG_CONFIG.rrfK
        filter: { knowledge_id: 'abc' },
      });
    });

    it('should return empty string when results are empty', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse([]);

      const result = await retrieveContext('empty query');
      expect(result).toBe('');
    });

    it('should return empty string on RPC error', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse(null, {
        code: 'PGRST000',
        message: 'Database error',
        details: '',
        hint: '',
      });

      const result = await retrieveContext('failing query');
      expect(result).toBe('');
    });

    it('should handle chunks without page metadata', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse([
        { content: 'No page info here.', metadata: {} },
        { content: 'Also no page.', metadata: null },
      ]);

      const result = await retrieveContext('query');
      expect(result).toBe('No page info here.\n\n---\n\nAlso no page.');
    });

    it('should handle chunk with null metadata gracefully', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse([{ content: 'Content only.', metadata: null }]);

      const result = await retrieveContext('query');
      expect(result).toBe('Content only.');
    });

    it('should handle mixed chunks with and without page numbers', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse([
        { content: 'Has page.', metadata: { page: 5 } },
        { content: 'No page.', metadata: {} },
        { content: 'Has page too.', metadata: { page: 12 } },
      ]);

      const result = await retrieveContext('query');
      expect(result).toBe(
        'Has page. (Page 5)\n\n---\n\nNo page.\n\n---\n\nHas page too. (Page 12)',
      );
    });

    it('should use default filter and matchCount when not specified', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      mockSupabase.setResponse([]);

      await retrieveContext('query');

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('hybrid_search', {
        query_text: 'query',
        query_embedding: [0.1],
        match_threshold: 0.5,
        match_count: 5, // RAG_CONFIG.matchCount default
        rrf_k: 60,
        filter: {},
      });
    });

    it('should handle non-array data gracefully', async () => {
      mockGemini.setEmbeddingResponse([0.1]);
      // If data is not an array (unexpected), should default to empty
      mockSupabase.setResponse('not an array');

      const result = await retrieveContext('query');
      expect(result).toBe('');
    });
  });
});
