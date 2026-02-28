import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export class BookmarkRepository {
  async create(userId: string, paperId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('bookmarked_papers')
      .upsert({ user_id: userId, paper_id: paperId }, { onConflict: 'user_id,paper_id' });
    if (error) throw new DatabaseError(`Failed to bookmark paper: ${error.message}`, error);
  }

  async delete(userId: string, paperId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('bookmarked_papers')
      .delete()
      .eq('user_id', userId)
      .eq('paper_id', paperId);
    if (error) throw new DatabaseError(`Failed to remove bookmark: ${error.message}`, error);
  }

  async findByUserId(userId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bookmarked_papers')
      .select('paper_id')
      .eq('user_id', userId);
    if (error) throw new DatabaseError(`Failed to fetch bookmarks: ${error.message}`, error);
    return (data ?? []).map((row) => row.paper_id);
  }

  async isBookmarked(userId: string, paperId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('bookmarked_papers')
      .select('id')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .maybeSingle();
    if (error) throw new DatabaseError(`Failed to check bookmark: ${error.message}`, error);
    return !!data;
  }
}

let _instance: BookmarkRepository | null = null;
export function getBookmarkRepository(): BookmarkRepository {
  if (!_instance) _instance = new BookmarkRepository();
  return _instance;
}
