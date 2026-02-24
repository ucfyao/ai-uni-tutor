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
    it('should extract questions with answers and explanations', async () => {
      const questions = [
        {
          questionNumber: '1',
          content: 'What is the capital of France?',
          referenceAnswer: 'Paris',
          explanation: 'Paris is the capital and largest city of France.',
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

      const result = await parseQuestions(dummyBuffer);

      expect(result).toHaveLength(2);
      expect(result[0].referenceAnswer).toBe('Paris');
      expect(result[0].explanation).toBe('Paris is the capital and largest city of France.');
      expect(result[0].parentIndex).toBeNull(); // Zod default
      expect(result[1].score).toBe(10);
    });

    it('should handle questions without answers or explanations', async () => {
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

      const result = await parseQuestions(dummyBuffer);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Define photosynthesis.');
      expect(result[0].referenceAnswer).toBeUndefined();
      expect(result[0].explanation).toBeUndefined();
    });

    it('should always include referenceAnswer and explanation in prompt', async () => {
      mockExtractFromPDF.mockResolvedValue({ result: [], warnings: [] });

      await parseQuestions(dummyBuffer);
      const prompt = mockExtractFromPDF.mock.calls[0][1] as string;
      expect(prompt).toContain(
        'referenceAnswer: The reference answer or solution if provided in the document',
      );
      expect(prompt).toContain(
        'explanation: Step-by-step solution explanation if provided in the document',
      );
    });

    it('should handle multiple choice questions with options', async () => {
      const questions = [
        {
          questionNumber: '1',
          content: 'Which planet is closest to the Sun?',
          type: 'choice',
          options: ['A. Mercury', 'B. Venus', 'C. Earth', 'D. Mars'],
          referenceAnswer: 'A. Mercury',
          sourcePage: 1,
        },
      ];

      mockExtractFromPDF.mockResolvedValue({ result: questions, warnings: [] });

      const result = await parseQuestions(dummyBuffer);

      expect(result).toHaveLength(1);
      expect(result[0].options).toEqual(['A. Mercury', 'B. Venus', 'C. Earth', 'D. Mars']);
      expect(result[0].referenceAnswer).toBe('A. Mercury');
    });

    it('should pass Buffer to extractFromPDF', async () => {
      mockExtractFromPDF.mockResolvedValue({ result: [], warnings: [] });

      await parseQuestions(dummyBuffer);

      expect(mockExtractFromPDF).toHaveBeenCalledWith(
        dummyBuffer,
        expect.any(String),
        expect.objectContaining({ signal: undefined }),
      );
    });

    it('should handle empty buffer', async () => {
      const result = await parseQuestions(Buffer.alloc(0));
      expect(result).toEqual([]);
    });

    it('should throw on extraction failure with no results', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: [],
        warnings: ['Gemini returned invalid JSON (500 chars)'],
      });

      await expect(parseQuestions(dummyBuffer)).rejects.toThrow();
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

      const result = await parseQuestions(dummyBuffer);

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

      await parseQuestions(dummyBuffer, progress);

      expect(progress).toHaveBeenCalledWith(0, 1);
      expect(progress).toHaveBeenCalledWith(1, 1);
    });

    it('should recover valid questions when some items fail Zod validation', async () => {
      const mixed = [
        { questionNumber: '1', content: 'Valid Q', sourcePage: 1 },
        { questionNumber: 2, content: '', sourcePage: 'bad' }, // invalid
        { questionNumber: '3', content: 'Another valid Q', sourcePage: 3 },
      ];

      mockExtractFromPDF.mockResolvedValue({ result: mixed, warnings: [] });

      const result = await parseQuestions(dummyBuffer);

      expect(result).toHaveLength(2);
      expect(result[0].questionNumber).toBe('1');
      expect(result[1].questionNumber).toBe('3');
    });

    it('should return empty array gracefully for non-array LLM output', async () => {
      mockExtractFromPDF.mockResolvedValue({
        result: { error: 'not an array' },
        warnings: [],
      });

      const result = await parseQuestions(dummyBuffer);
      expect(result).toEqual([]);
    });
  });
});
