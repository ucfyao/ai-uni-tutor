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
  /** Ephemeral: used in-memory for AI context only, not persisted to DB. */
  images?: {
    data: string;
    mimeType: string;
  }[];
  createdAt: Date;
  parentMessageId: string | null;
}

export interface CreateMessageDTO {
  /** Optional: client-provided UUID. If omitted, DB generates one. */
  id?: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  images?: {
    data: string;
    mimeType: string;
  }[];
  timestamp: number;
  parentMessageId?: string | null;
}
