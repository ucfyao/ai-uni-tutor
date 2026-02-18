import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { DocumentOutline, DocumentStructure, KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

const { generateDocumentOutline, generateCourseOutline } = await import('./outline-generator');

describe('outline-generator', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateDocumentOutline', () => {
    it('generates outline from structure and knowledge points via LLM', async () => {
      mockGemini.setGenerateJSON({
        title: 'Data Structures Lecture 5',
        summary: 'Covers binary trees and hash tables.',
        sections: [
          {
            title: 'Binary Trees',
            knowledgePoints: ['BST', 'AVL Tree'],
            briefDescription: 'Tree-based data structures.',
          },
        ],
      });

      const structure: DocumentStructure = {
        subject: 'Computer Science',
        documentType: 'lecture slides',
        sections: [
          { title: 'Binary Trees', startPage: 1, endPage: 10, contentType: 'definitions' },
        ],
      };

      const points: KnowledgePoint[] = [
        { title: 'BST', definition: 'Binary search tree', sourcePages: [3] },
        { title: 'AVL Tree', definition: 'Self-balancing BST', sourcePages: [7] },
      ];

      const result = await generateDocumentOutline('doc-123', structure, points);

      expect(result.documentId).toBe('doc-123');
      expect(result.subject).toBe('Computer Science');
      expect(result.totalKnowledgePoints).toBe(2);
      expect(result.sections).toHaveLength(1);
    });

    it('builds outline locally for small KP sets without calling LLM', async () => {
      // [m13] assert LLM not called
      const structure: DocumentStructure = {
        subject: 'Math',
        documentType: 'notes',
        sections: [
          { title: 'Calculus Basics', startPage: 1, endPage: 3, contentType: 'definitions' },
        ],
      };

      const points: KnowledgePoint[] = [
        { title: 'Derivative', definition: 'Rate of change', sourcePages: [1] },
      ];

      const result = await generateDocumentOutline('doc-456', structure, points);

      expect(result.documentId).toBe('doc-456');
      expect(result.totalKnowledgePoints).toBe(1);
      expect(mockGemini.client.models.generateContent).not.toHaveBeenCalled();
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
      expect(result.topics[0].subtopics).toContain('Binary Trees');
    });
  });
});
