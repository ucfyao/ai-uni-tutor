'use server';

import { getBookmarkRepository } from '@/lib/repositories/BookmarkRepository';
import { getCurrentUser } from '@/lib/supabase/server';

export async function toggleBookmark(
  paperId: string,
): Promise<{ success: true; bookmarked: boolean } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const repo = getBookmarkRepository();
    const isBookmarked = await repo.isBookmarked(user.id, paperId);

    if (isBookmarked) {
      await repo.delete(user.id, paperId);
      return { success: true, bookmarked: false };
    } else {
      await repo.create(user.id, paperId);
      return { success: true, bookmarked: true };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle bookmark',
    };
  }
}

export async function getBookmarkedPaperIds(): Promise<string[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const repo = getBookmarkRepository();
    return repo.findByUserId(user.id);
  } catch {
    return [];
  }
}
