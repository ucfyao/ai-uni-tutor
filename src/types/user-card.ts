/**
 * Domain Models - User Card Entity
 *
 * User-created cards from text selection in chat.
 */

export interface UserCardEntity {
  id: string;
  userId: string;
  sessionId: string | null;
  title: string;
  content: string;
  excerpt: string;
  sourceMessageId: string | null;
  sourceRole: string | null;
  createdAt: Date;
}

export interface CreateUserCardDTO {
  userId: string;
  sessionId?: string;
  title: string;
  content?: string;
  excerpt?: string;
  sourceMessageId?: string;
  sourceRole?: 'user' | 'assistant';
}
