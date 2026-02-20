import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

const { extractKnowledgePoints, deduplicateByTitle } = await import('./section-extractor');

describe('section-extractor (single-pass)', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts knowledge points from all pages in a single Gemini call', async () => {
    const mockKPs: KnowledgePoint[] = [
      {
        title: 'Binary Search Tree',
        definition: 'A binary tree where left < root < right',
        keyConcepts: ['BST', 'ordering'],
        sourcePages: [4, 5],
      },
    ];

    mockGemini.setGenerateJSON(mockKPs);

    const pages = Array.from({ length: 10 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content about data structures`,
    }));

    const result = await extractKnowledgePoints(pages);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Binary Search Tree');
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('batches long documents (>singlePassMaxPages) into page ranges', async () => {
    // With default singlePassMaxPages=50, batchPages=30, overlap=3 → step=27
    // a 60-page doc makes 3 calls (pages 1-30, 28-57, 55-60)
    const kpsBatch1: KnowledgePoint[] = [
      { title: 'Concept A', definition: 'Def A', sourcePages: [5] },
    ];
    const kpsBatch2: KnowledgePoint[] = [
      { title: 'Concept B', definition: 'Def B', sourcePages: [45] },
    ];

    mockGemini.client.models.generateContent
      .mockResolvedValueOnce({ text: JSON.stringify(kpsBatch1) })
      .mockResolvedValueOnce({ text: JSON.stringify(kpsBatch2) })
      .mockResolvedValueOnce({ text: JSON.stringify([]) });

    const pages = Array.from({ length: 60 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const result = await extractKnowledgePoints(pages);

    expect(result).toHaveLength(2);
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(3);
  });

  it('deduplicates by title across batches', async () => {
    const kpsBatch1: KnowledgePoint[] = [
      { title: 'Same Concept', definition: 'Short def', sourcePages: [5] },
    ];
    const kpsBatch2: KnowledgePoint[] = [
      { title: 'Same Concept', definition: 'A much longer and better definition', sourcePages: [35] },
    ];

    mockGemini.client.models.generateContent
      .mockResolvedValueOnce({ text: JSON.stringify(kpsBatch1) })
      .mockResolvedValueOnce({ text: JSON.stringify(kpsBatch2) })
      .mockResolvedValueOnce({ text: JSON.stringify([]) });

    const pages = Array.from({ length: 60 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await extractKnowledgePoints(pages);

    expect(result).toHaveLength(1);
    expect(result[0].definition).toBe('A much longer and better definition');
    expect(result[0].sourcePages).toEqual([5, 35]);
  });

  it('handles Gemini API failure by throwing', async () => {
    mockGemini.setGenerateError(new Error('429 RESOURCE_EXHAUSTED'));

    const pages = [{ page: 1, text: 'Content' }];

    await expect(extractKnowledgePoints(pages)).rejects.toThrow('429 RESOURCE_EXHAUSTED');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const pages = Array.from({ length: 60 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await extractKnowledgePoints(pages, undefined, controller.signal);

    expect(result).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('returns empty array when Gemini returns no valid items', async () => {
    mockGemini.setGenerateJSON([{ invalid: 'not a knowledge point' }]);

    const pages = [{ page: 1, text: 'Content' }];
    const result = await extractKnowledgePoints(pages);

    expect(result).toEqual([]);
  });
});

describe('deduplicateByTitle', () => {
  it('keeps the longer definition and merges sourcePages', () => {
    const points: KnowledgePoint[] = [
      { title: 'BST', definition: 'Short', sourcePages: [1] },
      { title: 'bst', definition: 'A much longer definition', sourcePages: [5, 6] },
    ];

    const result = deduplicateByTitle(points);

    expect(result).toHaveLength(1);
    expect(result[0].definition).toBe('A much longer definition');
    expect(result[0].sourcePages).toEqual([1, 5, 6]);
  });
});
