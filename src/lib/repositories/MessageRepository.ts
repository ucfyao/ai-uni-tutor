/**
 * Message Repository Implementation
 *
 * Supabase-based implementation of IMessageRepository.
 * Handles all message-related database operations.
 */

import type { IMessageRepository } from '@/lib/domain/interfaces/IMessageRepository';
import type { CreateMessageDTO, MessageEntity } from '@/lib/domain/models/Message';
import { createClient } from '@/lib/supabase/server';

// Database row type
interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  card_id: string | null;
  created_at: string;
}

export class MessageRepository implements IMessageRepository {
  /**
   * Map database row to domain entity
   */
  private mapToEntity(row: MessageRow): MessageEntity {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content ?? '',
      cardId: row.card_id,
      createdAt: new Date(row.created_at),
    };
  }

  async findBySessionId(sessionId: string): Promise<MessageEntity[]> {
    const supabase = await createClient();
    const db = supabase as any;
    const { data, error } = await db
      .from('chat_messages')
      .select('id, session_id, role, content, card_id, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return (data as MessageRow[]).map((row) => this.mapToEntity(row));
  }

  async findByCardId(cardId: string): Promise<MessageEntity[]> {
    const supabase = await createClient();
    const db = supabase as any;
    const { data, error } = await db
      .from('chat_messages')
      .select('id, session_id, role, content, card_id, created_at')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return (data as MessageRow[]).map((row) => this.mapToEntity(row));
  }

  async create(dto: CreateMessageDTO): Promise<MessageEntity> {
    const supabase = await createClient();
    const db = supabase as any;

    const { data, error } = await db
      .from('chat_messages')
      .insert({
        session_id: dto.sessionId,
        role: dto.role,
        content: dto.content,
        card_id: dto.cardId || null,
        created_at: new Date(dto.timestamp).toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);

    // Update session's updated_at timestamp
    await db
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', dto.sessionId);

    return this.mapToEntity(data as MessageRow);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    const supabase = await createClient();
    const db = supabase as any;
    const { error } = await db.from('chat_messages').delete().eq('session_id', sessionId);

    if (error) throw new Error(`Failed to delete messages: ${error.message}`);
  }
}

// Singleton instance
let _messageRepository: MessageRepository | null = null;

export function getMessageRepository(): MessageRepository {
  if (!_messageRepository) {
    _messageRepository = new MessageRepository();
  }
  return _messageRepository;
}
