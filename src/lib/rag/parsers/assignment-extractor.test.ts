import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──

vi.mock('server-only', () => ({}));

const mockExtractFromPDF = vi.fn();
vi.mock('@/lib/rag/pdf-extractor', () => ({
  extractFromPDF: (...args: unknown[]) => mockExtractFromPDF(...args),
}));

// Import after mocks
const { extractAssignmentQuestions } = await import('./assignment-extractor');

describe('assignment-extractor', () => {
  const dummyBuffer = Buffer.from('dummy-pdf');

  beforeEach(() => {
    mockExtractFromPDF.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract assignment items from PDF', async () => {
    const items = [
      {
        title: 'Q1',
        orderNum: 1,
        content: 'What is the derivative of x^2?',
        parentIndex: null,
        options: [],
        referenceAnswer: '2x',
        explanation: 'Power rule',
        points: 5,
        type: 'calculation',
        difficulty: 'easy',
        sourcePages: [1],
      },
    ];

    mockExtractFromPDF.mockResolvedValue({
      result: { metadata: {}, items },
      warnings: [],
    });

    const result = await extractAssignmentQuestions(dummyBuffer);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('What is the derivative of x^2?');
    expect(result.items[0].referenceAnswer).toBe('2x');
    expect(result.warnings).toEqual([]);
  });

  it('should handle empty extraction result', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: { metadata: {}, items: [] },
      warnings: ['Gemini returned empty response'],
    });

    const result = await extractAssignmentQuestions(dummyBuffer);

    expect(result.items).toEqual([]);
    expect(result.warnings).toContain('Gemini returned empty response');
  });

  it('should recover partial items on schema validation failure', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: {
        metadata: {},
        items: [
          {
            title: 'Q1',
            orderNum: 1,
            content: 'Valid question',
            parentIndex: null,
            options: [],
            referenceAnswer: 'Answer',
            explanation: '',
            points: 5,
            type: 'short_answer',
            difficulty: 'medium',
            sourcePages: [1],
          },
          {
            orderNum: 2,
            content: '', // empty content triggers min(1) failure
          },
        ],
      },
      warnings: [],
    });

    const result = await extractAssignmentQuestions(dummyBuffer);

    // Should recover at least the valid item
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].content).toBe('Valid question');
  });

  it('should extract metadata', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: {
        metadata: { totalPoints: 100, duration: '2 hours' },
        items: [
          {
            title: 'Q1',
            orderNum: 1,
            content: 'Question content',
            parentIndex: null,
            referenceAnswer: '',
            explanation: '',
            points: 10,
            type: 'short_answer',
            difficulty: 'medium',
            sourcePages: [1],
          },
        ],
      },
      warnings: [],
    });

    const result = await extractAssignmentQuestions(dummyBuffer);

    expect(result.metadata?.totalPoints).toBe(100);
    expect(result.metadata?.duration).toBe('2 hours');
  });

  it('should pass Buffer and signal to extractFromPDF', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: { metadata: {}, items: [] },
      warnings: [],
    });

    const controller = new AbortController();
    await extractAssignmentQuestions(dummyBuffer, controller.signal);

    expect(mockExtractFromPDF).toHaveBeenCalledWith(
      dummyBuffer,
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('should handle aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await extractAssignmentQuestions(dummyBuffer, controller.signal);

    expect(result.items).toEqual([]);
    expect(mockExtractFromPDF).not.toHaveBeenCalled();
  });

  it('should handle sourcePages as string range', async () => {
    mockExtractFromPDF.mockResolvedValue({
      result: {
        metadata: {},
        items: [
          {
            title: 'Q1',
            orderNum: 1,
            content: 'Question about pages',
            parentIndex: null,
            referenceAnswer: '',
            explanation: '',
            points: 0,
            type: '',
            difficulty: 'medium',
            sourcePages: '1-3',
          },
        ],
      },
      warnings: [],
    });

    const result = await extractAssignmentQuestions(dummyBuffer);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].sourcePages).toEqual([1, 2, 3]);
  });
});
