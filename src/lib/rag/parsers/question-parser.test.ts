import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──

vi.mock('server-only', () => ({}));

const mockExtractFromPDF = vi.fn();
vi.mock('@/lib/rag/pdf-extractor', () => ({
  extractFromPDF: (...args: unknown[]) => mockExtractFromPDF(...args),
}));

// Import after mocks
const { parseQuestions } = await import('./question-parser');

describe('question-parser', () => {
  const dummyBuffer = Buffer.from('dummy-pdf');

  beforeEach(() => {
    mockExtractFromPDF.mockReset();
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

      mockExtractFromPDF.mockResolvedValue({ result: questions, warnings: [] });

      const result = await parseQuestions(dummyBuffer, true);

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

      mockExtractFromPDF.mockResolvedValue({ result: questions, warnings: [] });

      const result = await parseQuestions(dummyBuffer, false);

      expect(result).toEqual(questions);
      expect(result[0].referenceAnswer).toBeUndefined();
      expect(result[1].referenceAnswer).toBeUndefined();
    });

    it('should include answer instruction in prompt based on hasAnswers flag', async () => {
      mockExtractFromPDF.mockResolvedValue({ result: [], warnings: [] });

      // With answers
      await parseQuestions(dummyBuffer, true);
      const promptWithAnswers = mockExtractFromPDF.mock.calls[0][1] as string;
      expect(promptWithAnswers).toContain(
        'referenceAnswer: The reference answer or solution provided',
      );

      mockExtractFromPDF.mockReset();
      mockExtractFromPDF.mockResolvedValue({ result: [], warnings: [] });

      // Without answers
      await parseQuestions(dummyBuffer, false);
      const promptWithoutAnswers = mockExtractFromPDF.mock.calls[0][1] as string;
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

      mockExtractFromPDF.mockResolvedValue({ result: questions, warnings: [] });

      const result = await parseQuestions(dummyBuffer, true);

      expect(result).toHaveLength(1);
      expect(result[0].options).toEqual(['A. Mercury', 'B. Venus', 'C. Earth', 'D. Mars']);
      expect(result[0].referenceAnswer).toBe('A. Mercury');
    });

    it('should pass Buffer to extractFromPDF', async () => {
      mockExtractFromPDF.mockResolvedValue({ result: [], warnings: [] });

      await parseQuestions(dummyBuffer, false);

      expect(mockExtractFromPDF).toHaveBeenCalledWith(dummyBuffer, expect.any(String), undefined);
    });

    it('should handle empty buffer', async () => {
      const result = await parseQuestions(Buffer.alloc(0), true);
      expect(result).toEqual([]);
    });

    it('should throw on extraction failure with no results', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: [],
        warnings: ['Gemini returned invalid JSON (500 chars)'],
      });

      await expect(parseQuestions(dummyBuffer, false)).rejects.toThrow();
    });

    it('should handle questions without optional score field', async () => {
      const questions = [
        {
          questionNumber: 'Q1',
          content: 'Describe the water cycle.',
          sourcePage: 3,
        },
      ];

      mockExtractFromPDF.mockResolvedValue({ result: questions, warnings: [] });

      const result = await parseQuestions(dummyBuffer, false);

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeUndefined();
      expect(result[0].questionNumber).toBe('Q1');
    });

    it('should call progress callback', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: [{ questionNumber: '1', content: 'Q', sourcePage: 1 }],
        warnings: [],
      });
      const progress = vi.fn();

      await parseQuestions(dummyBuffer, false, progress);

      expect(progress).toHaveBeenCalledWith(0, 1);
      expect(progress).toHaveBeenCalledWith(1, 1);
    });
  });
});
