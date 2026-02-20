import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtractedSection, PipelineProgress } from './types';

vi.mock('server-only', () => ({}));

const mockExtractSections = vi.fn();

vi.mock('./section-extractor', () => ({
  extractSections: (...args: unknown[]) => mockExtractSections(...args),
}));

const { parseLecture, parseLectureMultiPass } = await import('./lecture-parser');

function setupDefaultMocks(sections: ExtractedSection[] = []) {
  mockExtractSections.mockResolvedValue({ sections, warnings: [] });
}

describe('lecture-parser', () => {
  beforeEach(() => {
    mockExtractSections.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLectureMultiPass', () => {
    it('extracts sections and builds local outline', async () => {
      const sections: ExtractedSection[] = [
        {
          title: 'Binary Search Trees',
          summary: 'Introduction to BST',
          sourcePages: [5],
          knowledgePoints: [
            { title: 'BST', content: 'Binary search tree', sourcePages: [5] },
          ],
        },
      ];
      setupDefaultMocks(sections);

      const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `P${i + 1}` }));
      const result = await parseLectureMultiPass(pages, { documentId: 'doc-1' });

      expect(result.knowledgePoints).toHaveLength(1);
      expect(result.outline).toBeDefined();
      expect(result.outline?.documentId).toBe('doc-1');
      expect(mockExtractSections).toHaveBeenCalledWith(pages, undefined);
    });

    it('reports progress through extraction phase', async () => {
      const sections: ExtractedSection[] = [
        {
          title: 'Section 1',
          summary: 'Summary',
          sourcePages: [1],
          knowledgePoints: [{ title: 'X', content: 'Y', sourcePages: [1] }],
        },
      ];
      setupDefaultMocks(sections);

      const pages = [{ page: 1, text: 'Page 1' }];
      const progressEvents: PipelineProgress[] = [];

      await parseLectureMultiPass(pages, {
        documentId: 'doc-2',
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      const phases = progressEvents.map((e) => e.phase);
      expect(phases).toContain('extraction');
    });

    it('passes signal to extractor', async () => {
      const sections: ExtractedSection[] = [
        {
          title: 'Section 1',
          summary: 'Summary',
          sourcePages: [1],
          knowledgePoints: [{ title: 'A', content: 'B', sourcePages: [1] }],
        },
      ];
      setupDefaultMocks(sections);

      const controller = new AbortController();
      const pages = [{ page: 1, text: 'P1' }];

      await parseLectureMultiPass(pages, { signal: controller.signal });

      expect(mockExtractSections).toHaveBeenCalledWith(pages, controller.signal);
    });

    it('skips outline when no documentId provided', async () => {
      const sections: ExtractedSection[] = [
        {
          title: 'Section 1',
          summary: 'Summary',
          sourcePages: [1],
          knowledgePoints: [{ title: 'A', content: 'B', sourcePages: [1] }],
        },
      ];
      setupDefaultMocks(sections);

      const result = await parseLectureMultiPass([{ page: 1, text: 'P1' }]);

      expect(result.outline).toBeUndefined();
    });

    it('returns empty result when no sections extracted', async () => {
      setupDefaultMocks([]);

      const result = await parseLectureMultiPass([{ page: 1, text: 'P1' }]);

      expect(result.knowledgePoints).toHaveLength(0);
      expect(result.sections).toHaveLength(0);
    });
  });

  describe('parseLecture (backward compat)', () => {
    it('returns ExtractedSection[] directly', async () => {
      setupDefaultMocks([]);

      const result = await parseLecture([{ page: 1, text: 'P1' }]);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
