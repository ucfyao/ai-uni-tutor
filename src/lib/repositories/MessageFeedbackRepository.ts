/**
 * Message Feedback Repository
 *
 * Handles persistence of 👍/👎 feedback on AI messages.
 * One feedback per user per message, with upsert semantics.
 */

import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export type FeedbackType = 'up' | 'down';

export interface MessageFeedbackEntity {
  id: string;
  messageId: string;
  userId: string;
  feedbackType: FeedbackType;
  createdAt: Date;
}

interface FeedbackRow {
  id: string;
  message_id: string;
  user_id: string;
  feedback_type: FeedbackType;
  created_at: string;
}

export class MessageFeedbackRepository {
  private mapToEntity(row: FeedbackRow): MessageFeedbackEntity {
    return {
      id: row.id,
      messageId: row.message_id,
      userId: row.user_id,
      feedbackType: row.feedback_type as FeedbackType,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Insert or update feedback for a message.
   * Uses Supabase upsert with onConflict on (message_id, user_id).
   */
  async upsert(
    messageId: string,
    userId: string,
    feedbackType: FeedbackType,
  ): Promise<MessageFeedbackEntity> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('message_feedback')
      .upsert(
        {
          message_id: messageId,
          user_id: userId,
          feedback_type: feedbackType,
        },
        { onConflict: 'message_id,user_id' },
      )
      .select()
      .single();

    if (error) throw new DatabaseError(`Failed to upsert feedback: ${error.message}`, error);

    return this.mapToEntity(data as FeedbackRow);
  }

  /**
   * Remove feedback for a message (toggle off).
   */
  async delete(messageId: string, userId: string): Promise<void> {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('message_feedback')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) throw new DatabaseError(`Failed to delete feedback: ${error.message}`, error);
  }

  /**
   * Batch-fetch feedback for multiple messages (for loading saved state).
   */
  async findByMessageIds(messageIds: string[], userId: string): Promise<MessageFeedbackEntity[]> {
    if (messageIds.length === 0) return [];

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('message_feedback')
      .select('id, message_id, user_id, feedback_type, created_at')
      .in('message_id', messageIds)
      .eq('user_id', userId);

    if (error) throw new DatabaseError(`Failed to fetch feedback: ${error.message}`, error);

    return (data ?? []).map((row: FeedbackRow) => this.mapToEntity(row));
  }
}

// Singleton
let _repo: MessageFeedbackRepository | null = null;

export function getMessageFeedbackRepository(): MessageFeedbackRepository {
  if (!_repo) {
    _repo = new MessageFeedbackRepository();
  }
  return _repo;
}
