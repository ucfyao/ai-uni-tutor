/**
 * Repository Interface - Message Repository
 */

import type { CreateMessageDTO, MessageEntity } from '../models/Message';

export interface IMessageRepository {
  findBySessionId(sessionId: string): Promise<MessageEntity[]>;
  create(data: CreateMessageDTO): Promise<MessageEntity>;
}
