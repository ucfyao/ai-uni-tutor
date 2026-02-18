import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgePoint, PipelineProgress } from './types';

vi.mock('server-only', () => ({}));

// Mock all 4 pass modules
const mockAnalyzeStructure = vi.fn();
const mockExtractSections = vi.fn();
const mockQualityGate = vi.fn();
const mockGenerateDocumentOutline = vi.fn();

vi.mock('./structure-analyzer', () => ({
  analyzeStructure: (...args: unknown[]) => mockAnalyzeStructure(...args),
}));
vi.mock('./section-extractor', () => ({
  extractSections: (...args: unknown[]) => mockExtractSections(...args),
}));
vi.mock('./quality-gate', () => ({
  qualityGate: (...args: unknown[]) => mockQualityGate(...args),
}));
vi.mock('./outline-generator', () => ({
  generateDocumentOutline: (...args: unknown[]) => mockGenerateDocumentOutline(...args),
}));

const { parseLecture, parseLectureMultiPass } = await import('./lecture-parser');

function setupDefaultMocks(points: KnowledgePoint[] = []) {
  mockAnalyzeStructure.mockResolvedValue({
    subject: 'CS',
    documentType: 'lecture',
    sections: [{ title: 'A', startPage: 1, endPage: 5, contentType: 'mixed' }],
  });
  mockExtractSections.mockResolvedValue(points);
  mockQualityGate.mockResolvedValue(points);
  mockGenerateDocumentOutline.mockResolvedValue({
    documentId: 'doc-1',
    title: 'Test',
    subject: 'CS',
    totalKnowledgePoints: points.length,
    sections: [],
    summary: 'Test',
  });
}

describe('lecture-parser (multi-pass)', () => {
  beforeEach(() => {
    mockAnalyzeStructure.mockReset();
    mockExtractSections.mockReset();
    mockQualityGate.mockReset();
    mockGenerateDocumentOutline.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLectureMultiPass', () => {
    it('chains all four passes and returns knowledge points + outline', async () => {
      const kp: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [5] },
      ];
      setupDefaultMocks(kp);

      const pages = Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: `P${i + 1}` }));
      const result = await parseLectureMultiPass(pages, { documentId: 'doc-1' });

      expect(result.knowledgePoints).toHaveLength(1);
      expect(result.outline).toBeDefined();
      expect(result.outline?.documentId).toBe('doc-1');
      expect(mockAnalyzeStructure).toHaveBeenCalledWith(pages);
      expect(mockExtractSections).toHaveBeenCalled();
      expect(mockQualityGate).toHaveBeenCalled();
    });

    it('reports progress through all phases', async () => {
      const kp = [{ title: 'X', definition: 'Y', sourcePages: [1] }];
      setupDefaultMocks(kp);

      const pages = [{ page: 1, text: 'Page 1' }];
      const progressEvents: PipelineProgress[] = [];

      await parseLectureMultiPass(pages, {
        documentId: 'doc-2',
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      const phases = progressEvents.map((e) => e.phase);
      expect(phases).toContain('structure_analysis');
      expect(phases).toContain('extraction');
      expect(phases).toContain('quality_gate');
      expect(phases).toContain('outline_generation');
    });
  });

  describe('parseLecture (backward compat)', () => {
    it('returns KnowledgePoint[] directly', async () => {
      setupDefaultMocks([]);

      const result = await parseLecture([{ page: 1, text: 'P1' }]);

      expect(Array.isArray(result)).toBe(true);
    });

    it('[C2] accepts a function as second argument (old SSE route pattern)', async () => {
      setupDefaultMocks([]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], batchCb);

      expect(batchCb).toHaveBeenCalled();
    });

    it('accepts ParseLectureOptions as second argument', async () => {
      setupDefaultMocks([]);

      const batchCb = vi.fn();
      await parseLecture([{ page: 1, text: 'P1' }], { onBatchProgress: batchCb });

      expect(batchCb).toHaveBeenCalled();
    });
  });
});
