import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';

// ── Mocks ──

// Suppress server-only guard in tests
vi.mock('server-only', () => ({}));

let mockGemini: MockGeminiResult;

vi.mock('@/lib/gemini', () => {
  mockGemini = createMockGemini();
  return {
    genAI: mockGemini.client,
    getGenAI: () => mockGemini.client,
  };
});

// Import after mocks
const { parseLecture } = await import('./lecture-parser');

describe('lecture-parser', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseLecture', () => {
    it('should extract knowledge points from pages', async () => {
      const knowledgePoints = [
        {
          title: "Newton's First Law",
          definition: 'An object at rest stays at rest unless acted upon by a force.',
          keyFormulas: ['F = 0 → a = 0'],
          keyConcepts: ['inertia', 'equilibrium'],
          examples: ['A book on a table'],
          sourcePages: [1],
        },
        {
          title: "Newton's Second Law",
          definition: 'Force equals mass times acceleration.',
          keyFormulas: ['F = ma'],
          keyConcepts: ['force', 'mass', 'acceleration'],
          examples: ['Pushing a shopping cart'],
          sourcePages: [2, 3],
        },
      ];

      mockGemini.setGenerateJSON(knowledgePoints);

      const pages = [
        { text: "Introduction to Newton's First Law of Motion...", page: 1 },
        { text: "Newton's Second Law states that F = ma...", page: 2 },
        { text: 'Examples of the second law in practice...', page: 3 },
      ];

      const result = await parseLecture(pages);

      expect(result).toEqual(knowledgePoints);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Newton's First Law");
      expect(result[1].keyFormulas).toContain('F = ma');
      expect(result[1].sourcePages).toEqual([2, 3]);
    });

    it('should call Gemini with correct model and JSON response type', async () => {
      mockGemini.setGenerateJSON([]);

      const pages = [{ text: 'Some content', page: 1 }];
      await parseLecture(pages);

      expect(mockGemini.client.models.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.0-flash',
          config: {
            responseMimeType: 'application/json',
          },
        }),
      );
    });

    it('should format page text with page markers in the prompt', async () => {
      mockGemini.setGenerateJSON([]);

      const pages = [
        { text: 'Page one content', page: 1 },
        { text: 'Page two content', page: 2 },
      ];
      await parseLecture(pages);

      const callArgs = mockGemini.client.models.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents as string;
      expect(prompt).toContain('[Page 1]');
      expect(prompt).toContain('Page one content');
      expect(prompt).toContain('[Page 2]');
      expect(prompt).toContain('Page two content');
    });

    it('should handle empty pages array', async () => {
      mockGemini.setGenerateJSON([]);

      const result = await parseLecture([]);
      expect(result).toEqual([]);
    });

    it('should handle knowledge points without optional fields', async () => {
      const knowledgePoints = [
        {
          title: 'Simple Concept',
          definition: 'A basic definition.',
          sourcePages: [1],
        },
      ];

      mockGemini.setGenerateJSON(knowledgePoints);

      const pages = [{ text: 'Simple concept explanation', page: 1 }];
      const result = await parseLecture(pages);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Simple Concept');
      expect(result[0].keyFormulas).toBeUndefined();
      expect(result[0].keyConcepts).toBeUndefined();
      expect(result[0].examples).toBeUndefined();
    });

    it('should throw on invalid JSON response from AI', async () => {
      mockGemini.setGenerateResponse('not valid json at all');

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseLecture(pages)).rejects.toThrow();
    });

    it('should handle empty string response from AI', async () => {
      // When response.text is empty string, JSON.parse('') throws
      mockGemini.setGenerateResponse('');

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseLecture(pages)).rejects.toThrow();
    });

    it('should handle response.text being undefined (falls back to empty string)', async () => {
      // Simulate undefined text → falls back to ''
      mockGemini.client.models.generateContent.mockResolvedValue({ text: undefined });

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseLecture(pages)).rejects.toThrow();
    });
  });
});
