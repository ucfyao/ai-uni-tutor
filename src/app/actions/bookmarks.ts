'use server';

import { getBookmarkService } from '@/lib/services/BookmarkService';
import { getCurrentUser } from '@/lib/supabase/server';

export async function toggleBookmark(
  paperId: string,
): Promise<{ success: true; bookmarked: boolean } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { bookmarked } = await getBookmarkService().toggleBookmark(user.id, paperId);
    return { success: true, bookmarked };
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

    return getBookmarkService().getBookmarkedPaperIds(user.id);
  } catch {
    return [];
  }
}
