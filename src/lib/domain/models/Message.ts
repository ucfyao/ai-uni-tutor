/**
 * Domain Models - Message Entity
 *
 * Represents a chat message in the domain layer.
 */

export interface MessageEntity {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  cardId: string | null;
  /** Ephemeral: used in-memory for AI context only, not persisted to DB. */
  images?: {
    data: string;
    mimeType: string;
  }[];
  createdAt: Date;
}

export interface CreateMessageDTO {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  cardId?: string;
  images?: {
    data: string;
    mimeType: string;
  }[];
  timestamp: number;
}
