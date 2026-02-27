/**
 * Repository Interface - Message Repository
 */

import type { CreateMessageDTO, MessageEntity } from '../models/Message';

export interface IMessageRepository {
  findBySessionId(sessionId: string): Promise<MessageEntity[]>;
  create(data: CreateMessageDTO): Promise<MessageEntity>;
  /** Get all children of a message (siblings at a fork point) */
  getChildren(parentMessageId: string): Promise<MessageEntity[]>;
  /** Walk the tree from root choosing stored branch or latest child at each fork. Returns flat active path. */
  getActivePath(sessionId: string, activeLeafId?: string | null): Promise<MessageEntity[]>;
}
