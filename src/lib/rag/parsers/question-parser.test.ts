import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGemini, type MockGeminiResult } from '@/__tests__/helpers/mockGemini';

// ── Mocks ──

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
const { parseQuestions } = await import('./question-parser');

describe('question-parser', () => {
  beforeEach(() => {
    mockGemini.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseQuestions', () => {
    it('should extract questions with answers when hasAnswers is true', async () => {
      const questions = [
        {
          questionNumber: '1',
          content: 'What is the capital of France?',
          referenceAnswer: 'Paris',
          score: 5,
          sourcePage: 1,
        },
        {
          questionNumber: '2',
          content: 'Explain the theory of relativity.',
          referenceAnswer: 'E = mc^2 describes the equivalence of mass and energy.',
          score: 10,
          sourcePage: 1,
        },
      ];

      mockGemini.setGenerateJSON(questions);

      const pages = [
        {
          text: 'Q1: What is the capital of France? A: Paris\nQ2: Explain the theory of relativity.',
          page: 1,
        },
      ];
      const result = await parseQuestions(pages, true);

      expect(result).toEqual(questions);
      expect(result).toHaveLength(2);
      expect(result[0].referenceAnswer).toBe('Paris');
      expect(result[1].score).toBe(10);
    });

    it('should extract questions without answers when hasAnswers is false', async () => {
      const questions = [
        {
          questionNumber: '1',
          content: 'Define photosynthesis.',
          sourcePage: 1,
        },
        {
          questionNumber: '2',
          content: 'List three types of rocks.',
          sourcePage: 2,
        },
      ];

      mockGemini.setGenerateJSON(questions);

      const pages = [
        { text: 'Q1: Define photosynthesis.', page: 1 },
        { text: 'Q2: List three types of rocks.', page: 2 },
      ];
      const result = await parseQuestions(pages, false);

      expect(result).toEqual(questions);
      expect(result[0].referenceAnswer).toBeUndefined();
      expect(result[1].referenceAnswer).toBeUndefined();
    });

    it('should include answer instruction in prompt based on hasAnswers flag', async () => {
      mockGemini.setGenerateJSON([]);

      const pages = [{ text: 'Question content', page: 1 }];

      // With answers
      await parseQuestions(pages, true);
      const callWithAnswers = mockGemini.client.models.generateContent.mock.calls[0][0];
      const promptWithAnswers = callWithAnswers.contents as string;
      expect(promptWithAnswers).toContain(
        'referenceAnswer: The reference answer or solution provided',
      );

      mockGemini.reset();
      mockGemini.setGenerateJSON([]);

      // Without answers
      await parseQuestions(pages, false);
      const callWithoutAnswers = mockGemini.client.models.generateContent.mock.calls[0][0];
      const promptWithoutAnswers = callWithoutAnswers.contents as string;
      expect(promptWithoutAnswers).toContain('referenceAnswer: Omit this field');
    });

    it('should handle multiple choice questions with options', async () => {
      const questions = [
        {
          questionNumber: '1',
          content: 'Which planet is closest to the Sun?',
          options: ['A. Mercury', 'B. Venus', 'C. Earth', 'D. Mars'],
          referenceAnswer: 'A. Mercury',
          sourcePage: 1,
        },
      ];

      mockGemini.setGenerateJSON(questions);

      const pages = [
        {
          text: 'Q1: Which planet is closest to the Sun?\nA. Mercury\nB. Venus\nC. Earth\nD. Mars',
          page: 1,
        },
      ];
      const result = await parseQuestions(pages, true);

      expect(result).toHaveLength(1);
      expect(result[0].options).toEqual(['A. Mercury', 'B. Venus', 'C. Earth', 'D. Mars']);
      expect(result[0].referenceAnswer).toBe('A. Mercury');
    });

    it('should call Gemini with correct model and JSON response type', async () => {
      mockGemini.setGenerateJSON([]);

      const pages = [{ text: 'Content', page: 1 }];
      await parseQuestions(pages, false);

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
        { text: 'First page questions', page: 1 },
        { text: 'Second page questions', page: 5 },
      ];
      await parseQuestions(pages, false);

      const callArgs = mockGemini.client.models.generateContent.mock.calls[0][0];
      const prompt = callArgs.contents as string;
      expect(prompt).toContain('[Page 1]');
      expect(prompt).toContain('First page questions');
      expect(prompt).toContain('[Page 5]');
      expect(prompt).toContain('Second page questions');
    });

    it('should handle empty pages array', async () => {
      mockGemini.setGenerateJSON([]);

      const result = await parseQuestions([], true);
      expect(result).toEqual([]);
    });

    it('should throw on invalid JSON response from AI', async () => {
      mockGemini.setGenerateResponse('this is not json');

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseQuestions(pages, false)).rejects.toThrow();
    });

    it('should handle empty string response from AI', async () => {
      mockGemini.setGenerateResponse('');

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseQuestions(pages, true)).rejects.toThrow();
    });

    it('should handle questions without optional score field', async () => {
      const questions = [
        {
          questionNumber: 'Q1',
          content: 'Describe the water cycle.',
          sourcePage: 3,
        },
      ];

      mockGemini.setGenerateJSON(questions);

      const pages = [{ text: 'Describe the water cycle.', page: 3 }];
      const result = await parseQuestions(pages, false);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeUndefined();
      expect(result[0].questionNumber).toBe('Q1');
    });

    it('should handle response.text being undefined (falls back to empty string)', async () => {
      mockGemini.client.models.generateContent.mockResolvedValue({ text: undefined });

      const pages = [{ text: 'Content', page: 1 }];
      await expect(parseQuestions(pages, false)).rejects.toThrow();
    });
  });
});
