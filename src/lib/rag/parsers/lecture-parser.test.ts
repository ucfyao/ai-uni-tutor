import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgePoint, PipelineProgress } from './types';

vi.mock('server-only', () => ({}));

const mockExtractKnowledgePoints = vi.fn();
const mockBuildOutlineFromPoints = vi.fn();

vi.mock('./section-extractor', () => ({
  extractKnowledgePoints: (...args: unknown[]) => mockExtractKnowledgePoints(...args),
  deduplicateByTitle: (pts: KnowledgePoint[]) => pts, // passthrough for tests
}));
vi.mock('./outline-generator', () => ({
  buildOutlineFromPoints: (...args: unknown[]) => mockBuildOutlineFromPoints(...args),
}));

const { parseLecture, parseLectureMultiPass } = await import('./lecture-parser');

function setupDefaultMocks(points: KnowledgePoint[] = []) {
  mockExtractKnowledgePoints.mockResolvedValue(points);
  mockBuildOutlineFromPoints.mockReturnValue({
    documentId: 'doc-1',
    title: 'Test',
    subject: '',
    totalKnowledgePoints: points.length,
    sections: [],
    summary: 'Test',
  });
}

describe('lecture-parser (single-pass)', () => {
  beforeEach(() => {
    mockExtractKnowledgePoints.mockReset();
    mockBuildOutlineFromPoints.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLectureMultiPass', () => {
    it('extracts knowledge points and builds local outline', async () => {
      const kp: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [5] },
      ];
      setupDefaultMocks(kp);

      const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `P${i + 1}` }));
      const result = await parseLectureMultiPass(pages, { documentId: 'doc-1' });

      expect(result.knowledgePoints).toHaveLength(1);
      expect(result.outline).toBeDefined();
      expect(result.outline?.documentId).toBe('doc-1');
      expect(mockExtractKnowledgePoints).toHaveBeenCalledWith(
        pages,
        expect.any(Function),
        undefined,
      );
      expect(mockBuildOutlineFromPoints).toHaveBeenCalledWith('doc-1', kp);
    });

    it('reports progress through extraction and outline phases', async () => {
      const kp = [{ title: 'X', definition: 'Y', sourcePages: [1] }];
      setupDefaultMocks(kp);

      const pages = [{ page: 1, text: 'Page 1' }];
      const progressEvents: PipelineProgress[] = [];

      await parseLectureMultiPass(pages, {
        documentId: 'doc-2',
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      const phases = progressEvents.map((e) => e.phase);
      expect(phases).toContain('extraction');
      expect(phases).toContain('outline_generation');
      // Old phases should NOT appear
      expect(phases).not.toContain('structure_analysis');
      expect(phases).not.toContain('quality_gate');
    });

    it('skips outline when no documentId provided', async () => {
      setupDefaultMocks([{ title: 'A', definition: 'B', sourcePages: [1] }]);

      const result = await parseLectureMultiPass([{ page: 1, text: 'P1' }]);

      expect(result.outline).toBeUndefined();
      expect(mockBuildOutlineFromPoints).not.toHaveBeenCalled();
    });

    it('returns empty result when no knowledge points extracted', async () => {
      setupDefaultMocks([]);

      const result = await parseLectureMultiPass([{ page: 1, text: 'P1' }]);

      expect(result.knowledgePoints).toHaveLength(0);
    });
  });

  describe('parseLecture (backward compat)', () => {
    it('returns KnowledgePoint[] directly', async () => {
      setupDefaultMocks([]);

      const result = await parseLecture([{ page: 1, text: 'P1' }]);

      expect(Array.isArray(result)).toBe(true);
    });

    it('[C2] accepts a function as second argument', async () => {
      setupDefaultMocks([{ title: 'X', definition: 'Y', sourcePages: [1] }]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], batchCb);

      expect(batchCb).toHaveBeenCalled();
    });

    it('accepts ParseLectureOptions as second argument', async () => {
      setupDefaultMocks([{ title: 'X', definition: 'Y', sourcePages: [1] }]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], { onBatchProgress: batchCb });

      expect(batchCb).toHaveBeenCalled();
    });
  });
});
