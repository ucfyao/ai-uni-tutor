'use server';

import { mapError } from '@/lib/errors';
import { getBookmarkService } from '@/lib/services/BookmarkService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

export async function toggleBookmark(
  paperId: string,
): Promise<ActionResult<{ bookmarked: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const { bookmarked } = await getBookmarkService().toggleBookmark(user.id, paperId);
    return { success: true, data: { bookmarked } };
  } catch (error) {
    return mapError(error);
  }
}

export async function getBookmarkedPaperIds(): Promise<ActionResult<string[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const ids = await getBookmarkService().getBookmarkedPaperIds(user.id);
    return { success: true, data: ids };
  } catch (error) {
    return mapError(error);
  }
}
