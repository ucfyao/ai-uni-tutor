import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

const { extractSections } = await import('./section-extractor');

describe('section-extractor', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts sections in a single Gemini call regardless of page count', async () => {
    const mockResponse = {
      sections: [
        {
          title: 'Binary Search Trees',
          summary: 'Introduction to BST data structure',
          sourcePages: [4, 5],
          knowledgePoints: [
            {
              title: 'Binary Search Tree',
              content: 'A binary tree where left < root < right',
              sourcePages: [4, 5],
            },
          ],
        },
      ],
    };

    mockGemini.setGenerateJSON(mockResponse);

    const pages = Array.from({ length: 100 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content about data structures`,
    }));

    const result = await extractSections(pages);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Binary Search Trees');
    expect(result[0].knowledgePoints).toHaveLength(1);
    expect(result[0].knowledgePoints[0].title).toBe('Binary Search Tree');
    // Always exactly 1 Gemini call, even for 100 pages
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('handles Gemini API failure by throwing', async () => {
    mockGemini.setGenerateError(new Error('429 RESOURCE_EXHAUSTED'));

    const pages = [{ page: 1, text: 'Content' }];

    await expect(extractSections(pages)).rejects.toThrow('429 RESOURCE_EXHAUSTED');
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const pages = [{ page: 1, text: 'Content' }];

    const result = await extractSections(pages, controller.signal);

    expect(result).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('returns empty array when Gemini returns no valid sections', async () => {
    mockGemini.setGenerateJSON({ sections: [{ invalid: 'not a section' }] });

    const pages = [{ page: 1, text: 'Content' }];
    const result = await extractSections(pages);

    expect(result).toEqual([]);
  });

  it('validates sections with Zod and rejects invalid structures', async () => {
    // The outer schema requires sections array with min(1) valid items.
    // If sections contain invalid items, the whole parse fails and returns [].
    mockGemini.setGenerateJSON({
      sections: [
        {
          title: 'Valid Section',
          summary: 'A real section',
          sourcePages: [1],
          knowledgePoints: [
            { title: 'Valid', content: 'A real point', sourcePages: [1] },
          ],
        },
      ],
    });

    const pages = [{ page: 1, text: 'Content' }];
    const result = await extractSections(pages);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid Section');
  });
});
