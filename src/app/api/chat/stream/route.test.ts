import { NextRequest } from 'next/server';
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

const mockChatService = {
  generateStream: vi.fn(),
};
vi.mock('@/lib/services/ChatService', () => ({
  getChatService: () => mockChatService,
}));

// Mock MODE_CONFIGS to avoid importing lucide-react icons in Node
vi.mock('@/constants/modes', () => ({
  MODE_CONFIGS: {
    'Lecture Helper': {
      temperature: 0.7,
      ragMatchCount: 5,
      knowledgeCards: true,
      buildSystemInstruction: () => 'system instruction',
    },
    'Assignment Coach': {
      temperature: 0.5,
      ragMatchCount: 3,
      knowledgeCards: false,
      buildSystemInstruction: () => 'system instruction',
      preprocessInput: (input: string) => input,
      postprocessResponse: (response: string) => response,
    },
  },
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST, sanitizeError } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

const VALID_BODY = {
  course: { code: 'CS101', name: 'Intro to CS' },
  mode: 'Lecture Helper' as const,
  history: [{ role: 'user' as const, content: 'Hello', timestamp: 1000 }],
  userInput: 'What is recursion?',
};

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    // Invalid JSON case: use a raw Request with bad body
    return new NextRequest(
      new Request('http://localhost/api/chat/stream', {
        method: 'POST',
        body: 'not-json{{{',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  return new NextRequest(
    new Request('http://localhost/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

/** Read the full SSE stream body as a string. */
async function readStream(response: Response): Promise<string> {
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

/** Create an async generator that yields given chunks. */
async function* fakeStreamGenerator(chunks: string[]): AsyncGenerator<string, void, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });
  });

  // =========================================================================
  // Request validation
  // =========================================================================

  describe('request validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const response = await POST(makeRequest());
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid JSON body');
    });

    it('returns 400 when required fields are missing', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);

      const response = await POST(makeRequest({ course: { code: 'CS101', name: 'Intro' } }));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid request body');
    });

    it('returns 400 when mode is invalid', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);

      const response = await POST(
        makeRequest({
          ...VALID_BODY,
          mode: 'Invalid Mode',
        }),
      );
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid request body');
    });

    it('returns 400 when userInput is empty', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);

      const response = await POST(
        makeRequest({
          ...VALID_BODY,
          userInput: '',
        }),
      );
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid request body');
    });

    it('returns 400 when course code is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);

      const response = await POST(
        makeRequest({
          ...VALID_BODY,
          course: { name: 'Intro to CS' },
        }),
      );
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid request body');
    });

    it('returns 400 when history has invalid role', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);

      const response = await POST(
        makeRequest({
          ...VALID_BODY,
          history: [{ role: 'system', content: 'hack' }],
        }),
      );
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid request body');
    });
  });

  // =========================================================================
  // Missing API key
  // =========================================================================

  describe('missing API key', () => {
    it('returns 500 when GEMINI_API_KEY is not set', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(500);
      expect(body.error).toBe('Missing GEMINI_API_KEY');
    });
  });

  // =========================================================================
  // Quota enforcement
  // =========================================================================

  describe('quota enforcement', () => {
    it('returns 429 with isLimitError when quota is exceeded', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({
        allowed: false,
        error: 'Daily limit reached. Please upgrade your plan.',
      });

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(429);
      expect(body.error).toBe('Daily limit reached. Please upgrade your plan.');
      expect(body.isLimitError).toBe(true);
    });

    it('returns default quota error when no error message provided', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: false });

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(429);
      expect(body.error).toBe('Daily limit reached. Please upgrade your plan.');
      expect(body.isLimitError).toBe(true);
    });
  });

  // =========================================================================
  // Successful SSE streaming
  // =========================================================================

  describe('SSE streaming', () => {
    it('returns 200 with SSE headers on success', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['Hello']));

      const response = await POST(makeRequest(VALID_BODY));

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');

      // Consume the stream to prevent leaks
      await readStream(response);
    });

    it('streams data in SSE format with data: prefix', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['Hello', ' world']));

      const response = await POST(makeRequest(VALID_BODY));
      const streamContent = await readStream(response);

      // Each chunk should be sent as `data: {...}\n\n`
      expect(streamContent).toContain('data: {"text":"Hello"}');
      expect(streamContent).toContain('data: {"text":" world"}');
    });

    it('ends the stream with [DONE] terminator', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['chunk']));

      const response = await POST(makeRequest(VALID_BODY));
      const streamContent = await readStream(response);

      expect(streamContent).toContain('data: [DONE]');
      // [DONE] should be the last data event
      const lines = streamContent
        .trim()
        .split('\n')
        .filter((l: string) => l.startsWith('data:'));
      expect(lines[lines.length - 1]).toBe('data: [DONE]');
    });

    it('sends multiple chunks in correct order', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['A', 'B', 'C']));

      const response = await POST(makeRequest(VALID_BODY));
      const streamContent = await readStream(response);

      const dataLines = streamContent
        .split('\n')
        .filter((l: string) => l.startsWith('data:') && !l.includes('[DONE]'));

      expect(dataLines).toHaveLength(3);
      expect(dataLines[0]).toContain('"text":"A"');
      expect(dataLines[1]).toContain('"text":"B"');
      expect(dataLines[2]).toContain('"text":"C"');
    });
  });

  // =========================================================================
  // Stream error handling
  // =========================================================================

  describe('stream error handling', () => {
    it('sends error event when stream generator throws', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });

      async function* failingStream(): AsyncGenerator<string, void, unknown> {
        yield 'start';
        throw new Error('Something broke');
      }
      mockChatService.generateStream.mockReturnValue(failingStream());

      const response = await POST(makeRequest(VALID_BODY));
      const streamContent = await readStream(response);

      // Should contain the initial chunk
      expect(streamContent).toContain('data: {"text":"start"}');
      // Should contain an error event
      expect(streamContent).toContain('"error"');
      expect(streamContent).toContain('"isLimitError"');
    });

    it('sends Gemini rate limit error with isLimitError=false', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });

      // eslint-disable-next-line require-yield
      async function* rateLimitStream(): AsyncGenerator<string, void, unknown> {
        throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
      }
      mockChatService.generateStream.mockReturnValue(rateLimitStream());

      const response = await POST(makeRequest(VALID_BODY));
      const streamContent = await readStream(response);

      // The error should NOT be flagged as a user limit error
      expect(streamContent).toContain('"isLimitError":false');
      expect(streamContent).toContain('rate limited');
    });
  });

  // =========================================================================
  // Fatal errors (before stream starts)
  // =========================================================================

  describe('fatal errors before stream', () => {
    it('returns 500 when getChatService or generateStream throws synchronously', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockImplementation(() => {
        throw new Error('Service init failed');
      });

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(500);
      expect(body.error).toContain('AI service error');
      expect(body.isRetryable).toBe(true);
    });

    it('returns 429 for Gemini rate limit errors thrown before stream', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockImplementation(() => {
        throw new Error('429 RESOURCE_EXHAUSTED');
      });

      const response = await POST(makeRequest(VALID_BODY));
      const body = JSON.parse(await response.text());

      expect(response.status).toBe(429);
      expect(body.isLimitError).toBe(false);
      expect(body.isRetryable).toBe(true);
      expect(body.error).toContain('rate limited');
    });
  });

  // =========================================================================
  // Integration: passes correct args to services
  // =========================================================================

  describe('service integration', () => {
    it('calls checkAndConsume with the authenticated user id', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['ok']));

      const response = await POST(makeRequest(VALID_BODY));
      await readStream(response);

      expect(mockQuotaService.checkAndConsume).toHaveBeenCalledWith('user-1');
    });

    it('passes parsed options to chatService.generateStream', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['ok']));

      const response = await POST(makeRequest(VALID_BODY));
      await readStream(response);

      expect(mockChatService.generateStream).toHaveBeenCalledWith(
        expect.objectContaining({
          course: { code: 'CS101', name: 'Intro to CS' },
          mode: 'Lecture Helper',
          userInput: 'What is recursion?',
        }),
      );
    });

    it('includes optional images when provided', async () => {
      mockGetCurrentUser.mockResolvedValue(MOCK_USER);
      mockQuotaService.checkAndConsume.mockResolvedValue({ allowed: true });
      mockChatService.generateStream.mockReturnValue(fakeStreamGenerator(['ok']));

      const bodyWithImages = {
        ...VALID_BODY,
        images: [{ data: 'base64data', mimeType: 'image/png' }],
      };

      const response = await POST(makeRequest(bodyWithImages));
      await readStream(response);

      expect(mockChatService.generateStream).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [{ data: 'base64data', mimeType: 'image/png' }],
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// sanitizeError — unit tests
// ---------------------------------------------------------------------------

describe('sanitizeError', () => {
  it('redacts ?key= query parameter from URLs', () => {
    const err = new Error('Request to https://api.google.com/v1?key=AIzaSyB123secret failed');
    expect(sanitizeError(err)).not.toContain('AIzaSyB123secret');
    expect(sanitizeError(err)).toContain('?key=[REDACTED]');
  });

  it('redacts &key= query parameter from URLs', () => {
    const result = sanitizeError('https://api.google.com/v1?foo=bar&key=SECRET123 returned 400');
    expect(result).not.toContain('SECRET123');
    expect(result).toContain('?key=[REDACTED]');
  });

  it('redacts GEMINI_API_KEY env value by exact match', () => {
    const result = sanitizeError(new Error('Auth failed for token test-key'));
    expect(result).not.toContain('test-key');
    expect(result).toContain('[REDACTED]');
  });

  it('handles non-Error values', () => {
    expect(sanitizeError('url?key=SECRET')).toContain('[REDACTED]');
    expect(sanitizeError(42)).toBe('42');
    expect(sanitizeError(null)).toBe('null');
  });

  it('preserves useful error context after redaction', () => {
    const err = new Error('429 RESOURCE_EXHAUSTED ?key=SECRET');
    const sanitized = sanitizeError(err);
    expect(sanitized).toContain('429');
    expect(sanitized).toContain('RESOURCE_EXHAUSTED');
    expect(sanitized).not.toContain('SECRET');
  });
});
