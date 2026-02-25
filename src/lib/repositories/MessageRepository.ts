/**
 * Message Repository Implementation
 *
 * Supabase-based implementation of IMessageRepository.
 * Handles all message-related database operations.
 */

import type { IMessageRepository } from '@/lib/domain/interfaces/IMessageRepository';
import type { CreateMessageDTO, MessageEntity } from '@/lib/domain/models/Message';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

// Database row type
interface MessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  parent_message_id: string | null;
}

const SELECT_COLS = 'id, session_id, role, content, created_at, parent_message_id';

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
      createdAt: new Date(row.created_at),
      parentMessageId: row.parent_message_id,
    };
  }

  async findBySessionId(sessionId: string): Promise<MessageEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select(SELECT_COLS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch messages: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row as MessageRow));
  }

  /** Get all children of a parent message (= siblings at a fork point) */
  async getChildren(parentMessageId: string): Promise<MessageEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .select(SELECT_COLS)
      .eq('parent_message_id', parentMessageId)
      .order('created_at', { ascending: true });

    if (error) throw new DatabaseError(`Failed to fetch children: ${error.message}`, error);
    return (data ?? []).map((row) => this.mapToEntity(row as MessageRow));
  }

  /**
   * Walk the message tree from root, choosing the latest child at each fork.
   * Returns a flat array representing the "active path" (current conversation view).
   */
  async getActivePath(sessionId: string): Promise<MessageEntity[]> {
    const allMessages = await this.findBySessionId(sessionId);
    if (allMessages.length === 0) return [];

    // Build parent→children map
    const childrenMap = new Map<string, MessageEntity[]>();
    for (const msg of allMessages) {
      const key = msg.parentMessageId ?? '__root__';
      const children = childrenMap.get(key) ?? [];
      children.push(msg);
      childrenMap.set(key, children);
    }

    // Walk from root, always picking the latest child at each fork
    const path: MessageEntity[] = [];
    let currentParent = '__root__';
    while (true) {
      const children = childrenMap.get(currentParent);
      if (!children || children.length === 0) break;
      const latestChild = children[children.length - 1];
      path.push(latestChild);
      currentParent = latestChild.id;
    }

    return path;
  }

  async create(dto: CreateMessageDTO): Promise<MessageEntity> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: dto.sessionId,
        role: dto.role,
        content: dto.content,
        created_at: new Date(dto.timestamp).toISOString(),
        parent_message_id: dto.parentMessageId ?? null,
      })
      .select(SELECT_COLS)
      .single();

    if (error) throw new DatabaseError(`Failed to create message: ${error.message}`, error);

    return this.mapToEntity(data as MessageRow);
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
