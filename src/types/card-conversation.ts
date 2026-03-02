/**
 * Domain Models - Card Conversation Entity
 *
 * Follow-up Q&A messages on knowledge/user cards.
 * Stored separately from main chat for analytics.
 */

export interface CardConversationEntity {
  id: string;
  cardId: string;
  cardType: 'knowledge' | 'user';
  userId: string;
  sessionId: string | null;
  courseCode: string | null;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export interface CreateCardConversationDTO {
  cardId: string;
  cardType: 'knowledge' | 'user';
  userId: string;
  sessionId?: string;
  courseCode?: string;
  role: 'user' | 'assistant';
  content: string;
}
