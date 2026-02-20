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

const { extractKnowledgePoints } = await import('./section-extractor');

describe('section-extractor', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts knowledge points in a single Gemini call regardless of page count', async () => {
    const mockKPs: KnowledgePoint[] = [
      {
        title: 'Binary Search Tree',
        definition: 'A binary tree where left < root < right',
        keyConcepts: ['BST', 'ordering'],
        sourcePages: [4, 5],
      },
    ];

    mockGemini.setGenerateJSON(mockKPs);

    const pages = Array.from({ length: 100 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content about data structures`,
    }));

    const result = await extractKnowledgePoints(pages);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Binary Search Tree');
    // Always exactly 1 Gemini call, even for 100 pages
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('handles Gemini API failure by throwing', async () => {
    mockGemini.setGenerateError(new Error('429 RESOURCE_EXHAUSTED'));

    const pages = [{ page: 1, text: 'Content' }];

    await expect(extractKnowledgePoints(pages)).rejects.toThrow('429 RESOURCE_EXHAUSTED');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const pages = [{ page: 1, text: 'Content' }];

    const result = await extractKnowledgePoints(pages, controller.signal);

    expect(result).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('returns empty array when Gemini returns no valid items', async () => {
    mockGemini.setGenerateJSON([{ invalid: 'not a knowledge point' }]);

    const pages = [{ page: 1, text: 'Content' }];
    const result = await extractKnowledgePoints(pages);

    expect(result).toEqual([]);
  });

  it('validates each item with Zod and skips invalid ones', async () => {
    mockGemini.setGenerateJSON([
      { title: 'Valid', definition: 'A real point', sourcePages: [1] },
      { title: '', definition: 'Missing title' },
      { noTitle: true },
    ]);

    const pages = [{ page: 1, text: 'Content' }];
    const result = await extractKnowledgePoints(pages);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid');
  });
});
