import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockQuotaService = {
  checkAndConsume: vi.fn(),
};
vi.mock('@/lib/services/QuotaService', () => ({
  getQuotaService: () => mockQuotaService,
}));

const mockWritingService = {
  analyze: vi.fn(),
};
vi.mock('@/lib/services/WritingAssistantService', () => ({
  getWritingAssistantService: () => mockWritingService,
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const VALID_BODY = {
  content: 'This is my essay about climate change.',
  services: ['format'] as const,
};

function makeRequest(body?: unknown) {
  if (body === undefined) {
    return new Request('http://localhost/api/tools/writing/analyze', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest;
  }
  return new Request('http://localhost/api/tools/writing/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

async function readSSEEvents(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/tools/writing/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
  });

  // =========================================================================
  // Request validation (returns JSON, not SSE)
  // =========================================================================

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 400 when content is empty', async () => {
    const response = await POST(makeRequest({ content: '', services: ['format'] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when services array is empty', async () => {
    const response = await POST(makeRequest({ content: 'some text', services: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when services contains invalid value', async () => {
    const response = await POST(makeRequest({ content: 'text', services: ['invalid'] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when content is missing', async () => {
    const response = await POST(makeRequest({ services: ['format'] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  // =========================================================================
  // Authentication (returns JSON)
  // =========================================================================

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  // =========================================================================
  // Quota enforcement (returns JSON)
  // =========================================================================

  it('returns 429 when quota is exceeded', async () => {
    mockQuotaService.checkAndConsume.mockResolvedValue({
      allowed: false,
      error: 'Daily limit reached. Please upgrade your plan.',
    });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Daily limit reached. Please upgrade your plan.');
    expect(body.isLimitError).toBe(true);
  });

  it('returns 429 with default message when no error string provided', async () => {
    mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: false });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Daily limit reached. Please upgrade your plan.');
  });

  // =========================================================================
  // Success path (SSE response)
  // =========================================================================

  it('returns 200 with SSE headers on success', async () => {
    mockWritingService.analyze.mockResolvedValue([
      { service: 'format', suggestions: [], overallScore: 85 },
    ]);

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    await readSSEEvents(response);
  });

  it('streams writing_result events for each service', async () => {
    mockWritingService.analyze.mockResolvedValue([
      { service: 'format', suggestions: [{ id: 's1' }], overallScore: 90 },
      { service: 'polish', suggestions: [{ id: 's2' }], overallScore: 80 },
    ]);

    const response = await POST(
      makeRequest({ content: 'My essay text', services: ['format', 'polish'] }),
    );
    const raw = await readSSEEvents(response);

    expect(raw).toContain('event: writing_result');
    expect(raw).toContain('"service":"format"');
    expect(raw).toContain('"service":"polish"');
  });

  it('passes citationStyle to the service', async () => {
    mockWritingService.analyze.mockResolvedValue([]);

    const response = await POST(makeRequest({ ...VALID_BODY, citationStyle: 'apa' }));
    await readSSEEvents(response);

    expect(mockWritingService.analyze).toHaveBeenCalledWith({
      content: VALID_BODY.content,
      services: VALID_BODY.services,
      citationStyle: 'apa',
    });
  });

  // =========================================================================
  // Error handling in SSE stream
  // =========================================================================

  it('sends error event when analysis throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockWritingService.analyze.mockRejectedValue(new Error('AI service down'));

    const response = await POST(makeRequest(VALID_BODY));
    const raw = await readSSEEvents(response);

    expect(raw).toContain('event: error');
    expect(raw).toContain('AI service error.');
    consoleSpy.mockRestore();
  });
});
