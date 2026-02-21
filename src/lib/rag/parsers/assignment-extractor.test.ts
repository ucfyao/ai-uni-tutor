import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockGenerateContent = vi.fn();

vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: { parse: 'gemini-test' },
  getGenAI: () => ({
    models: { generateContent: mockGenerateContent },
  }),
}));

const { extractAssignmentQuestions } = await import('./assignment-extractor');

function validResponse(items: unknown[]) {
  return {
    text: JSON.stringify({ items }),
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Question 1',
    orderNum: 1,
    content: 'What is 2+2?',
    options: ['3', '4', '5'],
    referenceAnswer: '4',
    explanation: 'Basic addition',
    points: 5,
    type: 'choice',
    difficulty: 'easy',
    parentIndex: null,
    sourcePages: [1],
    ...overrides,
  };
}

describe('assignment-extractor', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractAssignmentQuestions', () => {
    it('parses a valid Gemini response', async () => {
      mockGenerateContent.mockResolvedValue(validResponse([makeItem()]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'Q1: What is 2+2?' }]);

      expect(result.items).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.items[0].content).toBe('What is 2+2?');
      expect(result.items[0].points).toBe(5);
      expect(result.items[0].type).toBe('choice');
    });

    it('returns empty result when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await extractAssignmentQuestions(
        [{ page: 1, text: 'test' }],
        controller.signal,
      );

      expect(result.items).toHaveLength(0);
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns warning for empty Gemini response', async () => {
      mockGenerateContent.mockResolvedValue({ text: '' });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(0);
      expect(result.warnings).toContain('Gemini returned empty response');
    });

    it('returns warning for invalid JSON response', async () => {
      mockGenerateContent.mockResolvedValue({ text: 'not json {{{' });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(0);
      expect(result.warnings[0]).toMatch(/invalid JSON/);
    });

    it('extracts title field from response', async () => {
      mockGenerateContent.mockResolvedValue(
        validResponse([makeItem({ title: 'Question 5.2(a)' })]),
      );

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].title).toBe('Question 5.2(a)');
    });

    it('defaults title to empty string when not provided', async () => {
      const { title: _, ...itemWithoutTitle } = makeItem();
      mockGenerateContent.mockResolvedValue(validResponse([itemWithoutTitle]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].title).toBe('');
    });

    it('applies default values for optional fields', async () => {
      const item = {
        orderNum: 1,
        content: 'Explain gravity.',
        sourcePages: [2],
      };
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 2, text: 'Explain gravity.' }]);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].points).toBe(0);
      expect(result.items[0].difficulty).toBe('medium');
      expect(result.items[0].referenceAnswer).toBe('');
      expect(result.items[0].explanation).toBe('');
      expect(result.items[0].type).toBe('');
      expect(result.items[0].parentIndex).toBeNull();
    });

    it('extracts multiple items', async () => {
      const items = [
        makeItem({ orderNum: 1, parentIndex: null }),
        makeItem({ orderNum: 2, parentIndex: 0, content: 'What is 3+3?' }),
        makeItem({
          orderNum: 3,
          parentIndex: null,
          content: 'Explain addition.',
          type: 'short_answer',
        }),
      ];
      mockGenerateContent.mockResolvedValue(validResponse(items));

      const result = await extractAssignmentQuestions([
        { page: 1, text: 'Part A' },
        { page: 2, text: 'Part B' },
      ]);

      expect(result.items).toHaveLength(3);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('metadata extraction', () => {
    it('extracts metadata from response', async () => {
      const response = {
        metadata: {
          totalPoints: 100,
          totalQuestions: 25,
          duration: '120 minutes',
          instructions: 'Use blue or black ink pen.',
          examDate: '2026-03-15',
        },
        items: [makeItem()],
      };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(response) });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(1);
      expect(result.metadata).toEqual({
        totalPoints: 100,
        totalQuestions: 25,
        duration: '120 minutes',
        instructions: 'Use blue or black ink pen.',
        examDate: '2026-03-15',
      });
    });

    it('returns empty metadata when not present in response', async () => {
      mockGenerateContent.mockResolvedValue(validResponse([makeItem()]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(1);
      expect(result.metadata).toEqual({});
    });

    it('ignores invalid metadata fields', async () => {
      const response = {
        metadata: {
          totalPoints: 'not a number',
          totalQuestions: -5,
          duration: 123,
          bogusField: 'ignored',
        },
        items: [makeItem()],
      };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(response) });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(1);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.totalPoints).toBeUndefined();
    });
  });

  describe('partial recovery', () => {
    it('recovers valid items when overall schema fails', async () => {
      const raw = {
        items: [makeItem(), { invalid: true }],
      };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(raw) });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.join(' ')).toMatch(/Recovered 1\/2/);
    });

    it('returns empty result when no items can be recovered', async () => {
      const raw = {
        sections: [],
        items: [{ invalid: true }],
      };
      mockGenerateContent.mockResolvedValue({ text: JSON.stringify(raw) });

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items).toHaveLength(0);
    });
  });

  describe('coerceSourcePages (via schema)', () => {
    it('passes through valid arrays', async () => {
      const item = makeItem({ sourcePages: [1, 3, 5] });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([1, 3, 5]);
    });

    it('coerces a single number to array', async () => {
      const item = makeItem({ sourcePages: 3 });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([3]);
    });

    it('coerces a comma-separated string to array', async () => {
      const item = makeItem({ sourcePages: '1, 2, 3' });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([1, 2, 3]);
    });

    it('coerces a range string to array', async () => {
      const item = makeItem({ sourcePages: '2-5' });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([2, 3, 4, 5]);
    });

    it('returns empty array for null/undefined', async () => {
      const item = makeItem({ sourcePages: null });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([]);
    });

    it('filters out invalid values from arrays', async () => {
      const item = makeItem({ sourcePages: [1, NaN, -1, 0, 3] });
      mockGenerateContent.mockResolvedValue(validResponse([item]));

      const result = await extractAssignmentQuestions([{ page: 1, text: 'test' }]);

      expect(result.items[0].sourcePages).toEqual([1, 3]);
    });
  });
});
