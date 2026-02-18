import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';
import type { KnowledgePoint } from './types';

vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>();
  mockGemini = createMockGemini();
  return { ...actual, genAI: mockGemini.client, getGenAI: () => mockGemini.client };
});

// Mock embedding to return controllable vectors
const mockGenerateEmbeddingBatch = vi.fn();
vi.mock('@/lib/rag/embedding', () => ({
  generateEmbeddingBatch: (...args: unknown[]) => mockGenerateEmbeddingBatch(...args),
}));

const { qualityGate, mergeBySemanticSimilarity } = await import('./quality-gate');

describe('quality-gate', () => {
  beforeEach(() => {
    mockGemini.reset();
    mockGenerateEmbeddingBatch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters out irrelevant knowledge points', async () => {
    const points: KnowledgePoint[] = [
      {
        title: 'Binary Tree',
        definition: 'A tree data structure with at most two children per node',
        sourcePages: [5],
      },
      { title: 'Homework Due', definition: 'Submit by Friday', sourcePages: [1] },
      {
        title: 'Hash Table',
        definition: 'Maps keys to values using a hash function',
        sourcePages: [10],
      },
    ];

    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ]);

    mockGemini.setGenerateJSON([
      { index: 0, isRelevant: true, qualityScore: 9, issues: [] },
      { index: 1, isRelevant: false, qualityScore: 1, issues: ['Not academic content'] },
      { index: 2, isRelevant: true, qualityScore: 8, issues: [] },
    ]);

    const result = await qualityGate(points);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.title)).toEqual(['Binary Tree', 'Hash Table']);
  });

  it('merges semantically duplicate knowledge points', async () => {
    const points: KnowledgePoint[] = [
      { title: 'BST', definition: 'Binary search tree - ordered binary tree', sourcePages: [5] },
      {
        title: 'Binary Search Tree',
        definition: 'A tree where left subtree < root < right subtree',
        sourcePages: [8],
        keyConcepts: ['ordering'],
      },
    ];

    // Cosine similarity of these ≈ 0.999 (> 0.9 threshold)
    mockGenerateEmbeddingBatch.mockResolvedValueOnce([
      [0.95, 0.31, 0],
      [0.96, 0.28, 0],
    ]);

    const result = await mergeBySemanticSimilarity(points);

    expect(result).toHaveLength(1);
    expect(result[0].definition).toContain('subtree');
    expect(result[0].sourcePages).toContain(5);
    expect(result[0].sourcePages).toContain(8);
  });

  it('returns all points when quality review fails (graceful degradation)', async () => {
    const points: KnowledgePoint[] = [
      { title: 'Concept A', definition: 'Definition A', sourcePages: [1] },
    ];

    mockGenerateEmbeddingBatch.mockResolvedValueOnce([[1, 0, 0]]);
    mockGemini.setGenerateError(new Error('API error'));

    const result = await qualityGate(points);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Concept A');
  });

  it('returns all points when embedding fails (dedup fallback)', async () => {
    // [M3] mergeBySemanticSimilarity failure should degrade gracefully
    const points: KnowledgePoint[] = [
      { title: 'X', definition: 'Def X', sourcePages: [1] },
      { title: 'Y', definition: 'Def Y', sourcePages: [2] },
    ];

    mockGenerateEmbeddingBatch.mockRejectedValueOnce(new Error('Embedding API down'));
    // Quality review still works
    mockGemini.setGenerateJSON([
      { index: 0, isRelevant: true, qualityScore: 8, issues: [] },
      { index: 1, isRelevant: true, qualityScore: 7, issues: [] },
    ]);

    const result = await qualityGate(points);

    // Should still return both points (dedup skipped, review passed)
    expect(result).toHaveLength(2);
  });
});
