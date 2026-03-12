import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const mockFeedbackRepo = {
  upsert: vi.fn(),
  delete: vi.fn(),
};
vi.mock('@/lib/repositories/MessageFeedbackRepository', () => ({
  getMessageFeedbackRepository: () => mockFeedbackRepo,
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks are registered)
// ---------------------------------------------------------------------------

const { POST } = await import('./route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };
const VALID_MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeRequest(body?: unknown) {
  if (body === undefined) {
    return new Request('http://localhost/api/chat/feedback', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as NextRequest;
  }
  return new Request('http://localhost/api/chat/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: 'up' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  // =========================================================================
  // Request validation
  // =========================================================================

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when messageId is not a UUID', async () => {
    const response = await POST(makeRequest({ messageId: 'not-a-uuid', feedbackType: 'up' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
    expect(body.details).toBeDefined();
  });

  it('returns 400 when messageId is missing', async () => {
    const response = await POST(makeRequest({ feedbackType: 'up' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  it('returns 400 when feedbackType is invalid string', async () => {
    const response = await POST(
      makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: 'invalid' }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  // =========================================================================
  // Delete feedback (feedbackType === null)
  // =========================================================================

  it('calls repo.delete when feedbackType is null', async () => {
    mockFeedbackRepo.delete.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: null }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFeedbackRepo.delete).toHaveBeenCalledWith(VALID_MESSAGE_ID, 'user-1');
    expect(mockFeedbackRepo.upsert).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Upsert feedback (feedbackType === 'up' or 'down')
  // =========================================================================

  it('calls repo.upsert when feedbackType is "up"', async () => {
    mockFeedbackRepo.upsert.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: 'up' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFeedbackRepo.upsert).toHaveBeenCalledWith(VALID_MESSAGE_ID, 'user-1', 'up');
    expect(mockFeedbackRepo.delete).not.toHaveBeenCalled();
  });

  it('calls repo.upsert when feedbackType is "down"', async () => {
    mockFeedbackRepo.upsert.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: 'down' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockFeedbackRepo.upsert).toHaveBeenCalledWith(VALID_MESSAGE_ID, 'user-1', 'down');
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when repo throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFeedbackRepo.upsert.mockRejectedValue(new Error('DB connection failed'));

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: 'up' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to save feedback');
    consoleSpy.mockRestore();
  });

  it('returns 500 when delete throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFeedbackRepo.delete.mockRejectedValue(new Error('DB error'));

    const response = await POST(makeRequest({ messageId: VALID_MESSAGE_ID, feedbackType: null }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to save feedback');
    consoleSpy.mockRestore();
  });
});
