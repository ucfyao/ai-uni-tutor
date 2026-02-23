import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──

vi.mock('server-only', () => ({}));

const mockExtractFromPDF = vi.fn();
vi.mock('@/lib/rag/pdf-extractor', () => ({
  extractFromPDF: (...args: unknown[]) => mockExtractFromPDF(...args),
}));

// Import after mocks
const { parseLectureMultiPass, parseLecture } = await import('./lecture-parser');

describe('lecture-parser', () => {
  const dummyBuffer = Buffer.from('dummy-pdf');

  beforeEach(() => {
    mockExtractFromPDF.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLectureMultiPass', () => {
    it('should extract sections and knowledge points', async () => {
      const sections = [
        {
          title: 'Chapter 1',
          summary: 'Introduction to the topic',
          sourcePages: [1, 2],
          knowledgePoints: [
            { title: 'Concept A', content: 'Definition of A', sourcePages: [1] },
            { title: 'Concept B', content: 'Definition of B', sourcePages: [2] },
          ],
        },
      ];

      mockExtractFromPDF.mockResolvedValue({
        result: { sections },
        warnings: [],
      });

      const result = await parseLectureMultiPass(dummyBuffer);

      expect(result.sections).toHaveLength(1);
      expect(result.knowledgePoints).toHaveLength(2);
      expect(result.outline).toBeDefined();
      expect(result.warnings).toEqual([]);
    });

    it('should flatten knowledge points from multiple sections', async () => {
      const sections = [
        {
          title: 'Section 1',
          summary: 'First section',
          sourcePages: [1],
          knowledgePoints: [{ title: 'KP1', content: 'Content 1', sourcePages: [1] }],
        },
        {
          title: 'Section 2',
          summary: 'Second section',
          sourcePages: [2],
          knowledgePoints: [
            { title: 'KP2', content: 'Content 2', sourcePages: [2] },
            { title: 'KP3', content: 'Content 3', sourcePages: [2] },
          ],
        },
      ];

      mockExtractFromPDF.mockResolvedValue({
        result: { sections },
        warnings: [],
      });

      const result = await parseLectureMultiPass(dummyBuffer);

      expect(result.knowledgePoints).toHaveLength(3);
      expect(result.knowledgePoints[0].title).toBe('KP1');
      expect(result.knowledgePoints[2].title).toBe('KP3');
    });

    it('should return empty result when no sections found', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: { sections: [] },
        warnings: [],
      });

      const result = await parseLectureMultiPass(dummyBuffer);

      expect(result.sections).toEqual([]);
      expect(result.knowledgePoints).toEqual([]);
    });

    it('should propagate warnings', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: { sections: [] },
        warnings: ['Gemini returned empty response'],
      });

      const result = await parseLectureMultiPass(dummyBuffer);

      expect(result.warnings).toContain('Gemini returned empty response');
    });

    it('should call progress callback', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: { sections: [{ title: 'S', summary: 'S', sourcePages: [1], knowledgePoints: [] }] },
        warnings: [],
      });

      const progress = vi.fn();
      await parseLectureMultiPass(dummyBuffer, { onProgress: progress });

      expect(progress).toHaveBeenCalled();
    });
  });

  describe('parseLecture', () => {
    it('should return sections only', async () => {
      const sections = [
        {
          title: 'Only Section',
          summary: 'Summary',
          sourcePages: [1],
          knowledgePoints: [{ title: 'KP', content: 'Content', sourcePages: [1] }],
        },
      ];

      mockExtractFromPDF.mockResolvedValue({
        result: { sections },
        warnings: [],
      });

      const result = await parseLecture(dummyBuffer);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Only Section');
    });
  });
});
