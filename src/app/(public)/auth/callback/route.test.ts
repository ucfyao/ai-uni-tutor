import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExchangeCodeForSession = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { sanitizeRedirectPath, GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildRequest(params: Record<string, string>, headers?: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/auth/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    headers: new Headers(headers),
  });
}

// ---------------------------------------------------------------------------
// sanitizeRedirectPath — unit tests
// ---------------------------------------------------------------------------

describe('sanitizeRedirectPath', () => {
  it('returns /study for undefined', () => {
    expect(sanitizeRedirectPath(undefined)).toBe('/study');
  });

  it('returns /study for empty string', () => {
    expect(sanitizeRedirectPath('')).toBe('/study');
  });

  it('returns /study for bare slash', () => {
    expect(sanitizeRedirectPath('/')).toBe('/study');
  });

  it('allows known internal paths', () => {
    expect(sanitizeRedirectPath('/study')).toBe('/study');
    expect(sanitizeRedirectPath('/study/abc')).toBe('/study/abc');
    expect(sanitizeRedirectPath('/exam/123')).toBe('/exam/123');
    expect(sanitizeRedirectPath('/lecture/1')).toBe('/lecture/1');
    expect(sanitizeRedirectPath('/admin')).toBe('/admin');
    expect(sanitizeRedirectPath('/assignment')).toBe('/assignment');
    expect(sanitizeRedirectPath('/help')).toBe('/help');
    expect(sanitizeRedirectPath('/personalization')).toBe('/personalization');
    expect(sanitizeRedirectPath('/pricing')).toBe('/pricing');
    expect(sanitizeRedirectPath('/settings')).toBe('/settings');
    expect(sanitizeRedirectPath('/share/abc-123')).toBe('/share/abc-123');
    expect(sanitizeRedirectPath('/zh')).toBe('/zh');
  });

  it('allows /reset-password path', () => {
    expect(sanitizeRedirectPath('/reset-password')).toBe('/reset-password');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBe('/study');
    expect(sanitizeRedirectPath('//evil.com/study')).toBe('/study');
  });

  it('rejects absolute URLs with protocol', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/study');
    expect(sanitizeRedirectPath('http://evil.com/study')).toBe('/study');
  });

  it('rejects unknown path prefixes', () => {
    expect(sanitizeRedirectPath('/unknown')).toBe('/study');
    expect(sanitizeRedirectPath('/login')).toBe('/study');
    expect(sanitizeRedirectPath('/evil')).toBe('/study');
  });

  it('rejects paths that do not start with /', () => {
    expect(sanitizeRedirectPath('study')).toBe('/study');
    expect(sanitizeRedirectPath('evil.com')).toBe('/study');
  });
});

// ---------------------------------------------------------------------------
// GET handler — integration tests
// ---------------------------------------------------------------------------

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /study after successful auth with no next param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(buildRequest({ code: 'valid-code' }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/study');
  });

  it('redirects to allowed next path after successful auth', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(buildRequest({ code: 'valid-code', next: '/study/abc' }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/study/abc');
  });

  it('rejects //evil.com and redirects to /study', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(buildRequest({ code: 'valid-code', next: '//evil.com' }));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/study');
  });

  it('rejects absolute URL next param', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      buildRequest({ code: 'valid-code', next: 'https://evil.com/study' }),
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/study');
  });

  it('redirects to error page when code is missing', async () => {
    const response = await GET(buildRequest({}));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/auth-code-error');
  });

  it('redirects to error page when auth exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid' } });

    const response = await GET(buildRequest({ code: 'bad-code' }));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/auth/auth-code-error');
  });
});
