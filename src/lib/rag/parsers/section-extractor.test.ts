import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentStructure, KnowledgePoint } from './types';

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

  it('extracts knowledge points per section, skipping overview', async () => {
    const mockKPs: KnowledgePoint[] = [
      {
        title: 'Binary Search Tree',
        definition: 'A binary tree where left < root < right',
        keyConcepts: ['BST', 'ordering'],
        sourcePages: [4, 5],
      },
    ];

    mockGemini.setGenerateJSON(mockKPs);

    const pages = Array.from({ length: 15 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content about data structures`,
    }));

    const structure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [
        { title: 'Intro', startPage: 1, endPage: 3, contentType: 'overview' },
        { title: 'Binary Trees', startPage: 4, endPage: 12, contentType: 'definitions' },
      ],
    };

    const result = await extractSections(pages, structure);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe('Binary Search Tree');
    // LLM should only be called for non-overview sections
    expect(mockGemini.client.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when all sections are overview', async () => {
    const structure: DocumentStructure = {
      subject: 'Math',
      documentType: 'textbook',
      sections: [
        { title: 'Table of Contents', startPage: 1, endPage: 2, contentType: 'overview' },
        { title: 'References', startPage: 3, endPage: 4, contentType: 'overview' },
      ],
    };

    const pages = Array.from({ length: 4 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1}`,
    }));

    const result = await extractSections(pages, structure);

    expect(result).toEqual([]);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('handles LLM failure for one section gracefully', async () => {
    // First call fails, second succeeds
    mockGemini.client.models.generateContent
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        text: JSON.stringify([{ title: 'Concept B', definition: 'Def B', sourcePages: [15] }]),
      });

    const pages = Array.from({ length: 20 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const structure: DocumentStructure = {
      subject: 'Physics',
      documentType: 'lecture',
      sections: [
        { title: 'Section A', startPage: 1, endPage: 10, contentType: 'definitions' },
        { title: 'Section B', startPage: 11, endPage: 20, contentType: 'theorems' },
      ],
    };

    // With concurrency=3, both sections process in same batch
    const result = await extractSections(pages, structure);

    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Concept B');
  });
});
