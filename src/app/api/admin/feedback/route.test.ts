import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();

// Chainable Supabase mock
function createChainableMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const result = { data: null as unknown, error: null as unknown };

  chain.from = vi.fn().mockReturnThis();
  chain.select = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(result));
  chain.in = vi.fn().mockImplementation(() => Promise.resolve(result));

  return { chain, result };
}

const feedbackMock = createChainableMock();
const messagesMock = createChainableMock();
const profilesMock = createChainableMock();

// Track from() calls to return different chains
let fromCallCount = 0;
const mockSupabase = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'message_feedback') {
      fromCallCount++;
      return feedbackMock.chain;
    }
    if (table === 'chat_messages') return messagesMock.chain;
    if (table === 'profiles') return profilesMock.chain;
    return feedbackMock.chain;
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  createClient: () => Promise.resolve(mockSupabase),
}));

const mockFindById = vi.fn();
vi.mock('@/lib/repositories', () => ({
  getProfileRepository: () => ({ findById: mockFindById }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { GET } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'admin@example.com' };

function setupSuperAdmin() {
  mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  mockFindById.mockResolvedValue({ id: 'user-1', role: 'super_admin' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallCount = 0;

    // Reset chainable mock results
    feedbackMock.result.data = null;
    feedbackMock.result.error = null;
    messagesMock.result.data = null;
    messagesMock.result.error = null;
    profilesMock.result.data = null;
    profilesMock.result.error = null;

    // Re-wire chain methods after clearAllMocks
    feedbackMock.chain.from = vi.fn().mockReturnThis();
    feedbackMock.chain.select = vi.fn().mockReturnThis();
    feedbackMock.chain.order = vi.fn().mockReturnThis();
    feedbackMock.chain.limit = vi.fn().mockImplementation(() => Promise.resolve(feedbackMock.result));
    feedbackMock.chain.in = vi.fn().mockImplementation(() => Promise.resolve(feedbackMock.result));

    messagesMock.chain.from = vi.fn().mockReturnThis();
    messagesMock.chain.select = vi.fn().mockReturnThis();
    messagesMock.chain.in = vi.fn().mockImplementation(() => Promise.resolve(messagesMock.result));

    profilesMock.chain.from = vi.fn().mockReturnThis();
    profilesMock.chain.select = vi.fn().mockReturnThis();
    profilesMock.chain.in = vi.fn().mockImplementation(() => Promise.resolve(profilesMock.result));

    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'message_feedback') return feedbackMock.chain;
      if (table === 'chat_messages') return messagesMock.chain;
      if (table === 'profiles') return profilesMock.chain;
      return feedbackMock.chain;
    });
  });

  // =========================================================================
  // Authentication & Authorization
  // =========================================================================

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not super_admin', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue({ id: 'user-1', role: 'user' });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when profile is not found', async () => {
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
    mockFindById.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  // =========================================================================
  // Success path
  // =========================================================================

  it('returns enriched feedback items with stats', async () => {
    setupSuperAdmin();

    const feedbackData = [
      {
        id: 'fb-1',
        message_id: 'msg-1',
        user_id: 'u-1',
        feedback_type: 'up',
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: 'fb-2',
        message_id: 'msg-2',
        user_id: 'u-2',
        feedback_type: 'down',
        created_at: '2026-03-02T00:00:00Z',
      },
    ];
    feedbackMock.result.data = feedbackData;
    feedbackMock.result.error = null;

    messagesMock.result.data = [
      { id: 'msg-1', content: 'Hello AI response content here', role: 'assistant', session_id: 's-1' },
      { id: 'msg-2', content: 'Another message', role: 'assistant', session_id: 's-2' },
    ];

    profilesMock.result.data = [
      { id: 'u-1', email: 'user1@example.com' },
      { id: 'u-2', email: 'user2@example.com' },
    ];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].feedbackType).toBe('up');
    expect(body.items[0].userEmail).toBe('user1@example.com');
    expect(body.items[0].messagePreview).toBe('Hello AI response content here');
    expect(body.items[1].feedbackType).toBe('down');
    expect(body.stats.total).toBe(2);
    expect(body.stats.thumbsUp).toBe(1);
    expect(body.stats.thumbsDown).toBe(1);
    expect(body.stats.satisfactionRate).toBe(50);
  });

  it('returns empty items when no feedback exists', async () => {
    setupSuperAdmin();

    feedbackMock.result.data = [];
    feedbackMock.result.error = null;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.stats.total).toBe(0);
    expect(body.stats.satisfactionRate).toBe(0);
  });

  it('handles deleted messages gracefully', async () => {
    setupSuperAdmin();

    feedbackMock.result.data = [
      {
        id: 'fb-1',
        message_id: 'msg-deleted',
        user_id: 'u-1',
        feedback_type: 'up',
        created_at: '2026-03-01T00:00:00Z',
      },
    ];
    feedbackMock.result.error = null;

    messagesMock.result.data = [];
    profilesMock.result.data = [{ id: 'u-1', email: 'user1@example.com' }];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].messagePreview).toBe('(deleted)');
    expect(body.items[0].messageRole).toBe('unknown');
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when feedback query fails', async () => {
    setupSuperAdmin();

    feedbackMock.result.data = null;
    feedbackMock.result.error = { message: 'DB error' };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch feedback');
    consoleSpy.mockRestore();
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    setupSuperAdmin();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make the supabase from() throw
    mockSupabase.from = vi.fn().mockImplementation(() => {
      throw new Error('Unexpected failure');
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    consoleSpy.mockRestore();
  });
});
