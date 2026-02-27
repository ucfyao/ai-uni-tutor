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

/**
 * Backward-compatibility helper: infer parent chain for legacy messages
 * that have parent_message_id = null.
 *
 * Messages are assumed sorted by created_at ASC (from DB).
 * Null-parent messages are chained to the previous message in chronological order.
 * Messages that already have a parentMessageId are left unchanged.
 */
export function inferParentChain(messages: MessageEntity[]): MessageEntity[] {
  let previousId: string | null = null;
  return messages.map((msg) => {
    if (msg.parentMessageId === null) {
      const inferred = { ...msg, parentMessageId: previousId };
      previousId = msg.id;
      return inferred;
    }
    previousId = msg.id;
    return msg;
  });
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
   * Build childrenMap and messageById from inferred messages.
   */
  private buildMaps(inferred: MessageEntity[]): {
    childrenMap: Map<string, MessageEntity[]>;
    messageById: Map<string, MessageEntity>;
  } {
    const childrenMap = new Map<string, MessageEntity[]>();
    const messageById = new Map<string, MessageEntity>();
    for (const msg of inferred) {
      messageById.set(msg.id, msg);
      const key = msg.parentMessageId ?? '__root__';
      const children = childrenMap.get(key) ?? [];
      children.push(msg);
      childrenMap.set(key, children);
    }
    return { childrenMap, messageById };
  }

  /**
   * Walk the tree from root, preferring children in the ancestor set of activeLeafId.
   * Falls back to latest child when activeLeafId is null/invalid or not in the ancestor set.
   */
  private walkPath(
    childrenMap: Map<string, MessageEntity[]>,
    messageById: Map<string, MessageEntity>,
    activeLeafId?: string | null,
  ): MessageEntity[] {
    // Build ancestor set from activeLeafId
    const ancestorSet = new Set<string>();
    if (activeLeafId && messageById.has(activeLeafId)) {
      let current: string | null = activeLeafId;
      while (current) {
        ancestorSet.add(current);
        const msg = messageById.get(current);
        current = msg?.parentMessageId ?? null;
      }
    }

    const path: MessageEntity[] = [];
    let currentParent = '__root__';
    while (true) {
      const children = childrenMap.get(currentParent);
      if (!children || children.length === 0) break;

      // Pick child in ancestor set if found, else latest
      const ancestorChild = ancestorSet.size > 0
        ? children.find((c) => ancestorSet.has(c.id))
        : undefined;
      const picked = ancestorChild ?? children[children.length - 1];
      path.push(picked);
      currentParent = picked.id;
    }
    return path;
  }

  /**
   * Walk the message tree from root, choosing the stored branch or latest child at each fork.
   * Returns a flat array representing the "active path" (current conversation view).
   * Uses inferParentChain for backward compatibility with legacy null-parent messages.
   */
  async getActivePath(
    sessionId: string,
    activeLeafId?: string | null,
  ): Promise<MessageEntity[]> {
    const allMessages = await this.findBySessionId(sessionId);
    if (allMessages.length === 0) return [];

    const inferred = inferParentChain(allMessages);
    const { childrenMap, messageById } = this.buildMaps(inferred);
    return this.walkPath(childrenMap, messageById, activeLeafId);
  }

  /**
   * Walk the message tree and also compute fork-point sibling info.
   * Returns both the active path and a siblingsMap for branch navigation.
   */
  async getActivePathWithForks(
    sessionId: string,
    activeLeafId?: string | null,
  ): Promise<{ path: MessageEntity[]; siblingsMap: Record<string, string[]> }> {
    const allMessages = await this.findBySessionId(sessionId);
    if (allMessages.length === 0) return { path: [], siblingsMap: {} };

    const inferred = inferParentChain(allMessages);
    const { childrenMap, messageById } = this.buildMaps(inferred);
    const path = this.walkPath(childrenMap, messageById, activeLeafId);

    // Compute siblings map: only fork points with >1 child, excluding __root__
    const siblingsMap: Record<string, string[]> = {};
    for (const [key, children] of childrenMap) {
      if (key !== '__root__' && children.length > 1) {
        siblingsMap[key] = children.map((c) => c.id);
      }
    }

    return { path, siblingsMap };
  }

  async create(dto: CreateMessageDTO): Promise<MessageEntity> {
    const supabase = await createClient();

    const insertData: {
      id?: string;
      session_id: string;
      role: 'user' | 'assistant';
      content: string;
      created_at: string;
      parent_message_id: string | null;
    } = {
      session_id: dto.sessionId,
      role: dto.role,
      content: dto.content,
      created_at: new Date(dto.timestamp).toISOString(),
      parent_message_id: dto.parentMessageId ?? null,
    };
    // Use client-provided UUID if given (keeps client/DB IDs in sync)
    if (dto.id) {
      insertData.id = dto.id;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(insertData)
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
