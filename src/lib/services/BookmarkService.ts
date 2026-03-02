/**
 * Bookmark Service
 *
 * Business logic layer for exam paper bookmarks.
 * Uses BookmarkRepository for data access.
 */

import {
  getBookmarkRepository,
  type BookmarkRepository,
} from '@/lib/repositories/BookmarkRepository';

export class BookmarkService {
  private readonly repo: BookmarkRepository;

  constructor(repo?: BookmarkRepository) {
    this.repo = repo ?? getBookmarkRepository();
  }

  async isBookmarked(userId: string, paperId: string): Promise<boolean> {
    return this.repo.isBookmarked(userId, paperId);
  }

  async bookmark(userId: string, paperId: string): Promise<void> {
    await this.repo.create(userId, paperId);
  }

  async unbookmark(userId: string, paperId: string): Promise<void> {
    await this.repo.delete(userId, paperId);
  }

  async toggleBookmark(userId: string, paperId: string): Promise<{ bookmarked: boolean }> {
    const currently = await this.repo.isBookmarked(userId, paperId);
    if (currently) {
      await this.repo.delete(userId, paperId);
      return { bookmarked: false };
    } else {
      await this.repo.create(userId, paperId);
      return { bookmarked: true };
    }
  }

  async getBookmarkedPaperIds(userId: string): Promise<string[]> {
    return this.repo.findByUserId(userId);
  }
}

let _bookmarkService: BookmarkService | null = null;

export function getBookmarkService(): BookmarkService {
  if (!_bookmarkService) {
    _bookmarkService = new BookmarkService();
  }
  return _bookmarkService;
}
