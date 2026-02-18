import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentStructure } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

const { analyzeStructure } = await import('./structure-analyzer');

describe('structure-analyzer', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns sections from LLM response', async () => {
    const mockStructure: DocumentStructure = {
      subject: 'Computer Science',
      documentType: 'lecture slides',
      sections: [
        { title: 'Introduction', startPage: 1, endPage: 3, contentType: 'overview' },
        { title: 'Binary Trees', startPage: 4, endPage: 12, contentType: 'definitions' },
        { title: 'Exercises', startPage: 13, endPage: 15, contentType: 'exercises' },
      ],
    };

    mockGemini.setGenerateJSON(mockStructure);

    const pages = Array.from({ length: 15 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content here with enough text to simulate real content.`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.subject).toBe('Computer Science');
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].contentType).toBe('overview');
  });

  it('skips LLM for short documents', async () => {
    const pages = Array.from({ length: 3 }, (_, i) => ({
      page: i + 1,
      text: `Short doc page ${i + 1}`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Full Document');
    expect(result.sections[0].startPage).toBe(1);
    expect(result.sections[0].endPage).toBe(3);
    expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
  });

  it('falls back to fixed segmentation on LLM failure', async () => {
    mockGemini.setGenerateError(new Error('API error'));

    const pages = Array.from({ length: 30 }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} content`,
    }));

    const result = await analyzeStructure(pages);

    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.subject).toBe('Unknown');
  });
});
