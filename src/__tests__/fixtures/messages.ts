/**
 * Test Fixtures - Messages
 *
 * Matches MessageEntity from src/lib/domain/models/Message.ts
 * and the chat_messages table Row from src/types/database.ts.
 */

import type { MessageEntity } from '@/lib/domain/models/Message';

/* ---------- Database rows (snake_case) ---------- */

export const userMessageRow = {
  id: 'msg-001',
  session_id: 'session-001',
  role: 'user' as const,
  content: 'What is recursion?',
  card_id: null as string | null,
  created_at: '2025-06-01T10:05:00Z',
};

export const assistantMessageRow = {
  id: 'msg-002',
  session_id: 'session-001',
  role: 'assistant' as const,
  content:
    'Recursion is a programming technique where a function calls itself to solve a problem by breaking it into smaller sub-problems.',
  card_id: null as string | null,
  created_at: '2025-06-01T10:05:05Z',
};

/* ---------- Domain entities (camelCase) ---------- */

export const userMessageEntity: MessageEntity = {
  id: userMessageRow.id,
  sessionId: userMessageRow.session_id,
  role: userMessageRow.role,
  content: userMessageRow.content,
  cardId: userMessageRow.card_id,
  createdAt: new Date(userMessageRow.created_at),
};

export const assistantMessageEntity: MessageEntity = {
  id: assistantMessageRow.id,
  sessionId: assistantMessageRow.session_id,
  role: assistantMessageRow.role,
  content: assistantMessageRow.content,
  cardId: assistantMessageRow.card_id,
  createdAt: new Date(assistantMessageRow.created_at),
};

/* ---------- Variants ---------- */

export const messageWithCardRow = {
  ...userMessageRow,
  id: 'msg-003',
  card_id: 'card-001',
  content: 'Explain this concept from my notes.',
};

export const messageWithCardEntity: MessageEntity = {
  id: messageWithCardRow.id,
  sessionId: messageWithCardRow.session_id,
  role: messageWithCardRow.role,
  content: messageWithCardRow.content,
  cardId: messageWithCardRow.card_id,
  createdAt: new Date(messageWithCardRow.created_at),
};
