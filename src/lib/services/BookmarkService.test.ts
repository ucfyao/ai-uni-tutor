import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkRepository } from '@/lib/repositories/BookmarkRepository';
import { BookmarkService } from './BookmarkService';

function createMockRepo(): { [K in keyof BookmarkRepository]: ReturnType<typeof vi.fn> } {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    findByUserId: vi.fn(),
    isBookmarked: vi.fn(),
  };
}

const USER_ID = 'user-001';
const PAPER_ID = 'paper-001';

describe('BookmarkService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: BookmarkService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new BookmarkService(repo as unknown as BookmarkRepository);
  });

  describe('isBookmarked', () => {
    it('returns true when bookmarked', async () => {
      repo.isBookmarked.mockResolvedValue(true);
      const result = await service.isBookmarked(USER_ID, PAPER_ID);
      expect(result).toBe(true);
      expect(repo.isBookmarked).toHaveBeenCalledWith(USER_ID, PAPER_ID);
    });

    it('returns false when not bookmarked', async () => {
      repo.isBookmarked.mockResolvedValue(false);
      const result = await service.isBookmarked(USER_ID, PAPER_ID);
      expect(result).toBe(false);
    });
  });

  describe('bookmark', () => {
    it('delegates to repo.create', async () => {
      repo.create.mockResolvedValue(undefined);
      await service.bookmark(USER_ID, PAPER_ID);
      expect(repo.create).toHaveBeenCalledWith(USER_ID, PAPER_ID);
    });
  });

  describe('unbookmark', () => {
    it('delegates to repo.delete', async () => {
      repo.delete.mockResolvedValue(undefined);
      await service.unbookmark(USER_ID, PAPER_ID);
      expect(repo.delete).toHaveBeenCalledWith(USER_ID, PAPER_ID);
    });
  });

  describe('toggleBookmark', () => {
    it('removes bookmark when currently bookmarked', async () => {
      repo.isBookmarked.mockResolvedValue(true);
      repo.delete.mockResolvedValue(undefined);
      const result = await service.toggleBookmark(USER_ID, PAPER_ID);
      expect(result).toEqual({ bookmarked: false });
      expect(repo.delete).toHaveBeenCalledWith(USER_ID, PAPER_ID);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('adds bookmark when not currently bookmarked', async () => {
      repo.isBookmarked.mockResolvedValue(false);
      repo.create.mockResolvedValue(undefined);
      const result = await service.toggleBookmark(USER_ID, PAPER_ID);
      expect(result).toEqual({ bookmarked: true });
      expect(repo.create).toHaveBeenCalledWith(USER_ID, PAPER_ID);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('getBookmarkedPaperIds', () => {
    it('returns paper IDs from repo', async () => {
      repo.findByUserId.mockResolvedValue(['paper-1', 'paper-2']);
      const result = await service.getBookmarkedPaperIds(USER_ID);
      expect(result).toEqual(['paper-1', 'paper-2']);
      expect(repo.findByUserId).toHaveBeenCalledWith(USER_ID);
    });

    it('returns empty array when no bookmarks', async () => {
      repo.findByUserId.mockResolvedValue([]);
      const result = await service.getBookmarkedPaperIds(USER_ID);
      expect(result).toEqual([]);
    });
  });
});
