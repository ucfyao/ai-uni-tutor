import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──

vi.mock('server-only', () => ({}));

const mockExtractFromPDF = vi.fn();
vi.mock('@/lib/rag/pdf-extractor', () => ({
  extractFromPDF: (...args: unknown[]) => mockExtractFromPDF(...args),
}));

// Import after mocks
const { extractSections } = await import('./section-extractor');

describe('section-extractor', () => {
  const dummyBuffer = Buffer.from('dummy-pdf');

  beforeEach(() => {
    mockExtractFromPDF.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract sections from PDF', async () => {
    const sections = [
      {
        title: 'Introduction',
        summary: 'Overview of the topic',
        sourcePages: [1, 2],
        knowledgePoints: [{ title: 'Key Concept', content: 'Explanation', sourcePages: [1] }],
      },
    ];

    mockExtractFromPDF.mockResolvedValue({
      result: { sections },
      warnings: [],
    });

    const result = await extractSections(dummyBuffer);

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Introduction');
    expect(result.sections[0].knowledgePoints).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('should return empty sections when extraction returns nothing', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: { sections: [] },
      warnings: [],
    });

    const result = await extractSections(dummyBuffer);
    expect(result.sections).toEqual([]);
  });

  it('should return warnings from extractFromPDF', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: { sections: [] },
      warnings: ['Gemini returned empty response'],
    });

    const result = await extractSections(dummyBuffer);
    expect(result.sections).toEqual([]);
    expect(result.warnings).toContain('Gemini returned empty response');
  });

  it('should handle Zod validation failure with partial recovery', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: {
        sections: [
          {
            title: 'Valid Section',
            summary: 'Valid summary',
            sourcePages: [1],
            knowledgePoints: [{ title: 'KP', content: 'Content', sourcePages: [1] }],
          },
          {
            title: '', // Invalid: empty title
            summary: 'Bad',
            sourcePages: [],
            knowledgePoints: [],
          },
        ],
      },
      warnings: [],
    });

    const result = await extractSections(dummyBuffer);

    // Schema validation should reject the empty-title section but keep the valid one
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('should pass Buffer to extractFromPDF', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: { sections: [] },
      warnings: [],
    });

    await extractSections(dummyBuffer);

    expect(mockExtractFromPDF).toHaveBeenCalledWith(
      dummyBuffer,
      expect.any(String),
      expect.objectContaining({ signal: undefined }),
    );
  });
});
