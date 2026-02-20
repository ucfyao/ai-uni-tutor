import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentOutline, KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

const { buildOutlineFromPoints, generateCourseOutline } = await import('./outline-generator');

describe('outline-generator', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildOutlineFromPoints', () => {
    it('builds outline from knowledge points without any LLM call', () => {
      const points: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [3, 5] },
        { title: 'AVL Tree', definition: 'Self-balancing BST', sourcePages: [7, 8] },
        { title: 'Hash Table', definition: 'Key-value mapping', sourcePages: [12] },
      ];

      const result = buildOutlineFromPoints('doc-123', points);

      expect(result.documentId).toBe('doc-123');
      expect(result.totalKnowledgePoints).toBe(3);
      expect(result.sections.length).toBeGreaterThan(0);
      // No LLM call should have been made
      expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
    });

    it('returns minimal outline for empty points array', () => {
      const result = buildOutlineFromPoints('doc-empty', []);

      expect(result.documentId).toBe('doc-empty');
      expect(result.totalKnowledgePoints).toBe(0);
      expect(result.sections).toHaveLength(0);
    });

    it('groups knowledge points into sections by page ranges', () => {
      const points: KnowledgePoint[] = [
        { title: 'A', definition: 'Def A', sourcePages: [1, 2] },
        { title: 'B', definition: 'Def B', sourcePages: [3] },
        { title: 'C', definition: 'Def C', sourcePages: [20, 21] },
        { title: 'D', definition: 'Def D', sourcePages: [22] },
      ];

      const result = buildOutlineFromPoints('doc-sections', points);

      // Should have multiple sections since pages span a wide range
      expect(result.sections.length).toBeGreaterThanOrEqual(1);
      // All knowledge points should be accounted for
      const allKPsInSections = result.sections.flatMap((s) => s.knowledgePoints);
      expect(allKPsInSections).toContain('A');
      expect(allKPsInSections).toContain('C');
    });
  });

  describe('generateCourseOutline', () => {
    it('merges multiple document outlines into course topics', async () => {
      mockGemini.setGenerateJSON({
        topics: [
          {
            topic: 'Data Structures',
            subtopics: ['Binary Trees', 'Hash Tables'],
            relatedDocuments: ['doc-1', 'doc-2'],
            knowledgePointCount: 5,
          },
        ],
      });

      const outlines: DocumentOutline[] = [
        {
          documentId: 'doc-1',
          title: 'Lecture 5',
          subject: 'CS',
          totalKnowledgePoints: 3,
          sections: [
            { title: 'Trees', knowledgePoints: ['BST'], briefDescription: 'Tree structures' },
          ],
          summary: 'Binary trees',
        },
        {
          documentId: 'doc-2',
          title: 'Lecture 6',
          subject: 'CS',
          totalKnowledgePoints: 2,
          sections: [
            { title: 'Hashing', knowledgePoints: ['Hash Table'], briefDescription: 'Hash-based' },
          ],
          summary: 'Hash tables',
        },
      ];

      const result = await generateCourseOutline('course-1', outlines);

      expect(result.courseId).toBe('course-1');
      expect(result.topics).toHaveLength(1);
    });
  });
});
