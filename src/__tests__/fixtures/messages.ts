/**
 * Test Fixtures - Messages
 *
 * Matches MessageEntity from src/types/message.ts
 * and the chat_messages table Row from src/types/database.ts.
 */

import type { MessageEntity } from '@/types/message';

/* ---------- Database rows (snake_case) ---------- */

export const userMessageRow = {
  id: 'msg-001',
  session_id: 'session-001',
  role: 'user' as const,
  content: 'What is recursion?',
  created_at: '2025-06-01T10:05:00Z',
  parent_message_id: null,
};

export const assistantMessageRow = {
  id: 'msg-002',
  session_id: 'session-001',
  role: 'assistant' as const,
  content:
    'Recursion is a programming technique where a function calls itself to solve a problem by breaking it into smaller sub-problems.',
  created_at: '2025-06-01T10:05:05Z',
  parent_message_id: 'msg-001',
};

/* ---------- Domain entities (camelCase) ---------- */

export const userMessageEntity: MessageEntity = {
  id: userMessageRow.id,
  sessionId: userMessageRow.session_id,
  role: userMessageRow.role,
  content: userMessageRow.content,
  createdAt: new Date(userMessageRow.created_at),
  parentMessageId: userMessageRow.parent_message_id,
};

export const assistantMessageEntity: MessageEntity = {
  id: assistantMessageRow.id,
  sessionId: assistantMessageRow.session_id,
  role: assistantMessageRow.role,
  content: assistantMessageRow.content,
  createdAt: new Date(assistantMessageRow.created_at),
  parentMessageId: assistantMessageRow.parent_message_id,
};
