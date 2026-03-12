import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockQuotaService = {
  enforce: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

const mockMockExamService = {
  generateQuestionsFromTopic: vi.fn(),
};
vi.mock('@/lib/services/MockExamService', () => ({
  getMockExamService: () => mockMockExamService,
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/exam/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readSSEEvents(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    events.push(decoder.decode(value, { stream: true }));
  }
  return events;
}

function parseSSEData(raw: string[]): Array<{ event: string; data: Record<string, unknown> }> {
  const joined = raw.join('');
  const parsed: Array<{ event: string; data: Record<string, unknown> }> = [];
  const eventBlocks = joined.split('\n\n').filter(Boolean);
  for (const block of eventBlocks) {
    const eventMatch = block.match(/^event: (.+)$/m);
    const dataMatch = block.match(/^data: (.+)$/m);
    if (eventMatch && dataMatch) {
      parsed.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/exam/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.enforce.mockResolvedValue(undefined);
    mockMockExamService.generateQuestionsFromTopic.mockResolvedValue(undefined);
  });

  it('returns SSE response with correct headers', async () => {
    const response = await POST(
      makeRequest({ mockId: 'mock-1', topic: 'Math', numQuestions: 5 }),
    );

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    await readSSEEvents(response);
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  it('sends error SSE event when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ mockId: 'mock-1', topic: 'Math', numQuestions: 5 }),
    );
    const events = parseSSEData(await readSSEEvents(response));

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('error');
    expect(events[0].data.message).toBe('Unauthorized');
    expect(events[0].data.code).toBe('AUTH');
  });

  // =========================================================================
  // Validation
  // =========================================================================

  it('sends error SSE event when required fields are missing', async () => {
    const response = await POST(makeRequest({ mockId: 'mock-1' }));
    const events = parseSSEData(await readSSEEvents(response));

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.message).toBe('Missing required fields');
    expect(errorEvent!.data.code).toBe('VALIDATION');
  });

  it('sends validation error when topic is missing', async () => {
    const response = await POST(makeRequest({ mockId: 'mock-1', numQuestions: 5 }));
    const events = parseSSEData(await readSSEEvents(response));

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.code).toBe('VALIDATION');
  });

  it('sends validation error when mockId is missing', async () => {
    const response = await POST(makeRequest({ topic: 'Math', numQuestions: 5 }));
    const events = parseSSEData(await readSSEEvents(response));

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.code).toBe('VALIDATION');
  });

  // =========================================================================
  // Success path
  // =========================================================================

  it('sends progress and complete events on success', async () => {
    const response = await POST(
      makeRequest({ mockId: 'mock-1', topic: 'Math', numQuestions: 3 }),
    );
    const events = parseSSEData(await readSSEEvents(response));

    const progressEvents = events.filter((e) => e.event === 'exam_progress');
    const completeEvents = events.filter((e) => e.event === 'exam_complete');

    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(completeEvents).toHaveLength(1);
    expect(completeEvents[0].data.mockId).toBe('mock-1');
  });

  it('calls generateQuestionsFromTopic with correct params', async () => {
    const response = await POST(
      makeRequest({
        mockId: 'mock-1',
        topic: 'Calculus',
        numQuestions: 5,
        difficulty: 'hard',
        questionTypes: ['mcq'],
        mode: 'ai_mock',
      }),
    );
    await readSSEEvents(response);

    expect(mockMockExamService.generateQuestionsFromTopic).toHaveBeenCalledWith(
      'user-1',
      'mock-1',
      {
        topic: 'Calculus',
        numQuestions: 5,
        difficulty: 'hard',
        questionTypes: ['mcq'],
        mode: 'ai_mock',
      },
    );
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('sends error event when quota enforcement fails', async () => {
    mockQuotaService.enforce.mockRejectedValue(new Error('Quota exceeded'));

    const response = await POST(
      makeRequest({ mockId: 'mock-1', topic: 'Math', numQuestions: 5 }),
    );
    const events = parseSSEData(await readSSEEvents(response));

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.message).toBe('Quota exceeded');
    expect(errorEvent!.data.code).toBe('GENERATION_ERROR');
  });

  it('sends error event when generation fails', async () => {
    mockMockExamService.generateQuestionsFromTopic.mockRejectedValue(
      new Error('Generation failed'),
    );

    const response = await POST(
      makeRequest({ mockId: 'mock-1', topic: 'Math', numQuestions: 5 }),
    );
    const events = parseSSEData(await readSSEEvents(response));

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.data.message).toBe('Generation failed');
    expect(errorEvent!.data.code).toBe('GENERATION_ERROR');
  });
});
