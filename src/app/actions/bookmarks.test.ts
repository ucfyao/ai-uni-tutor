import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock BookmarkService
const mockBookmarkService = {
  toggleBookmark: vi.fn(),
  getBookmarkedPaperIds: vi.fn(),
};
vi.mock('@/lib/services/BookmarkService', () => ({
  getBookmarkService: () => mockBookmarkService,
}));

// Mock mapError passthrough
vi.mock('@/lib/errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/errors')>();
  return { ...actual };
});

const { getBookmarkedPaperIds, toggleBookmark } = await import('./bookmarks');

const MOCK_USER = { id: 'user-1', email: 'test@example.com' };

describe('toggleBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  it('should return error when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await toggleBookmark('paper-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unauthorized');
    }
  });

  it('should return bookmarked status on success', async () => {
    mockBookmarkService.toggleBookmark.mockResolvedValue({ bookmarked: true });
    const result = await toggleBookmark('paper-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ bookmarked: true });
    }
    expect(mockBookmarkService.toggleBookmark).toHaveBeenCalledWith('user-1', 'paper-1');
  });

  it('should return bookmarked false when unbookmarking', async () => {
    mockBookmarkService.toggleBookmark.mockResolvedValue({ bookmarked: false });
    const result = await toggleBookmark('paper-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ bookmarked: false });
    }
  });

  it('should handle service errors', async () => {
    mockBookmarkService.toggleBookmark.mockRejectedValue(new Error('DB failure'));
    const result = await toggleBookmark('paper-1');
    expect(result.success).toBe(false);
  });
});

describe('getBookmarkedPaperIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_USER);
  });

  it('should return error when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await getBookmarkedPaperIds();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unauthorized');
    }
  });

  it('should return paper IDs on success', async () => {
    const ids = ['paper-1', 'paper-2', 'paper-3'];
    mockBookmarkService.getBookmarkedPaperIds.mockResolvedValue(ids);
    const result = await getBookmarkedPaperIds();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(ids);
    }
    expect(mockBookmarkService.getBookmarkedPaperIds).toHaveBeenCalledWith('user-1');
  });

  it('should return empty array when no bookmarks', async () => {
    mockBookmarkService.getBookmarkedPaperIds.mockResolvedValue([]);
    const result = await getBookmarkedPaperIds();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('should handle service errors', async () => {
    mockBookmarkService.getBookmarkedPaperIds.mockRejectedValue(new Error('DB failure'));
    const result = await getBookmarkedPaperIds();
    expect(result.success).toBe(false);
  });
});
