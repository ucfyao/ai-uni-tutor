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

    const { sections } = await extractSections(pages);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Binary Search Trees');
    expect(sections[0].knowledgePoints).toHaveLength(1);
    expect(sections[0].knowledgePoints[0].title).toBe('Binary Search Tree');
    // Always exactly 1 Gemini call, even for 100 pages
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('handles Gemini API failure by throwing', async () => {
    mockGemini.setGenerateError(new Error('429 RESOURCE_EXHAUSTED'));

    const pages = [{ page: 1, text: 'Content' }];

    await expect(extractSections(pages)).rejects.toThrow(
      'AI service rate limited. Please retry shortly.',
    );
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const pages = [{ page: 1, text: 'Content' }];

    const { sections, warnings } = await extractSections(pages, controller.signal);

    expect(sections).toEqual([]);
    expect(warnings).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('returns empty sections with warnings when Gemini returns invalid data', async () => {
    mockGemini.setGenerateJSON({ sections: [{ invalid: 'not a section' }] });

    const pages = [{ page: 1, text: 'Content' }];
    const { sections, warnings } = await extractSections(pages);

    expect(sections).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('validation failed'))).toBe(true);
  });

  it('validates sections with Zod and returns valid ones', async () => {
    mockGemini.setGenerateJSON({
      sections: [
        {
          title: 'Valid Section',
          summary: 'A real section',
          sourcePages: [1],
          knowledgePoints: [{ title: 'Valid', content: 'A real point', sourcePages: [1] }],
        },
      ],
    });

    const pages = [{ page: 1, text: 'Content' }];
    const { sections, warnings } = await extractSections(pages);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Valid Section');
    expect(warnings).toEqual([]);
  });

  it('coerces string sourcePages to arrays', async () => {
    mockGemini.setGenerateJSON({
      sections: [
        {
          title: 'Section with string pages',
          summary: 'Gemini returned sourcePages as string',
          sourcePages: '4-8',
          knowledgePoints: [
            { title: 'KP One', content: 'Content here', sourcePages: '4, 5' },
            { title: 'KP Two', content: 'More content', sourcePages: '7' },
          ],
        },
      ],
    });

    const pages = [{ page: 1, text: 'Content' }];
    const { sections, warnings } = await extractSections(pages);

    expect(sections).toHaveLength(1);
    expect(warnings).toEqual([]);
    expect(sections[0].sourcePages).toEqual([4, 5, 6, 7, 8]);
    expect(sections[0].knowledgePoints[0].sourcePages).toEqual([4, 5]);
    expect(sections[0].knowledgePoints[1].sourcePages).toEqual([7]);
  });
});
