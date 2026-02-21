import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';

// Mock the gemini module before importing the module under test
let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return {
    ...actual,
    genAI: mockGemini.client,
    getGenAI: () => mockGemini.client,
  };
});

// Import after mock setup
const { generateEmbedding, generateEmbeddingWithRetry } = await import('./embedding');
const { GEMINI_MODELS } = await import('@/lib/gemini');

describe('embedding', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── generateEmbedding ──

  describe('generateEmbedding', () => {
    it('should return an embedding vector', async () => {
      const fakeVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockGemini.setEmbeddingResponse(fakeVector);

      const result = await generateEmbedding('Hello world');
      expect(result).toEqual(fakeVector);
    });

    it('should call embedContent with correct parameters', async () => {
      mockGemini.setEmbeddingResponse([1, 2, 3]);
      await generateEmbedding('test text');

      expect(mockGemini.client.models.embedContent).toHaveBeenCalledWith({
        model: GEMINI_MODELS.embedding,
        contents: 'test text',
        config: {
          outputDimensionality: 768,
        },
      });
    });

    it('should return empty array when embeddings are missing', async () => {
      mockGemini.client.models.embedContent.mockResolvedValue({
        embeddings: undefined,
      });

      const result = await generateEmbedding('test');
      expect(result).toEqual([]);
    });

    it('should return empty array when values are missing', async () => {
      mockGemini.client.models.embedContent.mockResolvedValue({
        embeddings: [{ values: undefined }],
      });

      const result = await generateEmbedding('test');
      expect(result).toEqual([]);
    });

    it('should return empty array when embeddings array is empty', async () => {
      mockGemini.client.models.embedContent.mockResolvedValue({
        embeddings: [],
      });

      const result = await generateEmbedding('test');
      expect(result).toEqual([]);
    });
  });

  // ── generateEmbeddingWithRetry ──

  describe('generateEmbeddingWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return result on first successful try', async () => {
      const fakeVector = [0.5, 0.6, 0.7];
      mockGemini.setEmbeddingResponse(fakeVector);

      const result = await generateEmbeddingWithRetry('test');
      expect(result).toEqual(fakeVector);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fakeVector = [0.1, 0.2];
      mockGemini.client.models.embedContent
        .mockRejectedValueOnce(new Error('API rate limit'))
        .mockResolvedValueOnce({
          embeddings: [{ values: fakeVector }],
        });

      const promise = generateEmbeddingWithRetry('test');

      // Advance past the first retry delay (1000 * 2^0 = 1000ms)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toEqual(fakeVector);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(2);
    });

    it('should retry multiple times and succeed on third attempt', async () => {
      const fakeVector = [0.3, 0.4];
      mockGemini.client.models.embedContent
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          embeddings: [{ values: fakeVector }],
        });

      const promise = generateEmbeddingWithRetry('test');

      // First retry delay: 1000 * 2^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // Second retry delay: 1000 * 2^1 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toEqual(fakeVector);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries are exhausted', async () => {
      mockGemini.client.models.embedContent
        .mockRejectedValueOnce(new Error('Persistent failure'))
        .mockRejectedValueOnce(new Error('Persistent failure'))
        .mockRejectedValueOnce(new Error('Persistent failure'));

      // Eagerly catch the promise so the rejection is handled
      const promise = generateEmbeddingWithRetry('test', 3).catch((e: Error) => e);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(1000); // 2^0 * 1000
      await vi.advanceTimersByTimeAsync(2000); // 2^1 * 1000

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('AI service error.');
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retry delays', async () => {
      mockGemini.client.models.embedContent
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'));

      // Eagerly catch the promise so the rejection is handled
      const promise = generateEmbeddingWithRetry('test', 3).catch((e: Error) => e);

      // After 999ms: still on first retry wait (1000ms)
      await vi.advanceTimersByTimeAsync(999);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(1);

      // At 1000ms: first retry fires
      await vi.advanceTimersByTimeAsync(1);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(2);

      // After 1999ms more: still on second retry wait (2000ms)
      await vi.advanceTimersByTimeAsync(1999);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(2);

      // At 2000ms: second retry fires
      await vi.advanceTimersByTimeAsync(1);
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(3);

      // All 3 attempts failed -> should have rejected with last error
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('AI service error.');
    });

    it('should respect custom maxRetries parameter', async () => {
      mockGemini.client.models.embedContent.mockRejectedValueOnce(new Error('fail'));

      const promise = generateEmbeddingWithRetry('test', 1).catch((e: Error) => e);
      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('AI service error.');
      expect(mockGemini.client.models.embedContent).toHaveBeenCalledTimes(1);
    });
  });
});
