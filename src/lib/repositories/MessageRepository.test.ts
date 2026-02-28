/**
 * MessageRepository Tests
 *
 * Tests all message-related database operations including
 * entity mapping, ordering, session timestamp updates on create,
 * and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assistantMessageEntity,
  assistantMessageRow,
  userMessageEntity,
  userMessageRow,
} from '@/__tests__/fixtures/messages';
import {
  createMockSupabase,
  dbError,
  type MockSupabaseResult,
} from '@/__tests__/helpers/mockSupabase';
import type { MessageEntity } from '@/lib/domain/models/Message';
import { DatabaseError } from '@/lib/errors';

// ── Mocks ──

let mockSupabase: MockSupabaseResult;

vi.mock('@/lib/supabase/server', () => {
  mockSupabase = createMockSupabase();
  return {
    createClient: vi.fn().mockResolvedValue(mockSupabase.client),
  };
});

// Import after mocks
const { MessageRepository, buildAncestorSet, buildPathFromChildren } =
  await import('./MessageRepository');

describe('MessageRepository', () => {
  let repo: InstanceType<typeof MessageRepository>;

  beforeEach(() => {
    repo = new MessageRepository();
    mockSupabase.reset();
  });

  // ── cycle guards ──

  describe('cycle guards', () => {
    it('buildAncestorSet should stop on parent cycles', () => {
      const a: MessageEntity = {
        id: 'a',
        sessionId: 's',
        role: 'user' as const,
        content: 'a',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        parentMessageId: 'b',
      };
      const b: MessageEntity = {
        id: 'b',
        sessionId: 's',
        role: 'assistant' as const,
        content: 'b',
        createdAt: new Date('2025-01-01T00:00:01Z'),
        parentMessageId: 'a',
      };
      const messageById = new Map<string, MessageEntity>([
        ['a', a],
        ['b', b],
      ]);

      const set = buildAncestorSet(messageById, 'a');

      expect(set.size).toBe(2);
      expect(set.has('a')).toBe(true);
      expect(set.has('b')).toBe(true);
    });

    it('buildPathFromChildren should stop when path loops', () => {
      const a: MessageEntity = {
        id: 'a',
        sessionId: 's',
        role: 'user' as const,
        content: 'a',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        parentMessageId: null,
      };
      const b: MessageEntity = {
        id: 'b',
        sessionId: 's',
        role: 'assistant' as const,
        content: 'b',
        createdAt: new Date('2025-01-01T00:00:01Z'),
        parentMessageId: 'a',
      };

      const childrenMap = new Map<string, MessageEntity[]>([
        ['__root__', [a]],
        ['a', [b]],
        ['b', [a]], // cycle back to a
      ]);

      const path = buildPathFromChildren(childrenMap, new Set(), 10);

      expect(path.map((m) => m.id)).toEqual(['a', 'b']);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findBySessionId ──

  describe('findBySessionId', () => {
    it('should return messages ordered by created_at ascending', async () => {
      mockSupabase.setQueryResponse([userMessageRow, assistantMessageRow]);

      const result = await repo.findBySessionId('session-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(userMessageEntity);
      expect(result[1]).toEqual(assistantMessageEntity);
    });

    it('should query with correct fields and ordering', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findBySessionId('session-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('chat_messages');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith(
        'id, session_id, role, content, created_at, parent_message_id',
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('session_id', 'session-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('should return empty array when no messages exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findBySessionId('session-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findBySessionId('session-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findBySessionId('session-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findBySessionId('session-001')).rejects.toThrow('Failed to fetch messages');
    });
  });

  // ── create ──

  describe('create', () => {
    it('should insert a message and return the entity', async () => {
      mockSupabase.setSingleResponse(userMessageRow);

      const dto = {
        sessionId: 'session-001',
        role: 'user' as const,
        content: 'What is recursion?',
        timestamp: new Date('2025-06-01T10:05:00Z').getTime(),
      };

      const result = await repo.create(dto);

      expect(result).toEqual(userMessageEntity);
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        session_id: 'session-001',
        role: 'user',
        content: 'What is recursion?',
        created_at: expect.any(String),
        parent_message_id: null,
      });
    });

    it('should pass parentMessageId when provided', async () => {
      mockSupabase.setSingleResponse(assistantMessageRow);

      const dto = {
        sessionId: 'session-001',
        role: 'assistant' as const,
        content: 'Response',
        timestamp: Date.now(),
        parentMessageId: 'msg-001',
      };

      await repo.create(dto);

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ parent_message_id: 'msg-001' }),
      );
    });

    it('should not update session timestamp (handled at service layer)', async () => {
      mockSupabase.setSingleResponse(userMessageRow);

      const dto = {
        sessionId: 'session-001',
        role: 'user' as const,
        content: 'Hello',
        timestamp: Date.now(),
      };

      await repo.create(dto);

      // Session timestamp update was moved to SessionService
      const fromCalls = mockSupabase.client.from.mock.calls;
      expect(fromCalls).toHaveLength(1);
      expect(fromCalls[0][0]).toBe('chat_messages');
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const dto = {
        sessionId: 'session-001',
        role: 'user' as const,
        content: 'Test',
        timestamp: Date.now(),
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.create(dto)).rejects.toThrow('Failed to create message');
    });
  });

  // ── getChildren ──

  describe('getChildren', () => {
    it('should return all messages with the same parent_message_id', async () => {
      mockSupabase.setQueryResponse([assistantMessageRow]);

      const result = await repo.getChildren('msg-001');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(assistantMessageEntity);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('parent_message_id', 'msg-001');
    });

    it('should return empty array when no children exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.getChildren('msg-999');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.getChildren('msg-001')).rejects.toThrow(DatabaseError);
      await expect(repo.getChildren('msg-001')).rejects.toThrow('Failed to fetch children');
    });
  });

  // ── getActivePath ──

  describe('getActivePath', () => {
    it('should return empty array when no messages exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.getActivePath('session-001');

      expect(result).toEqual([]);
    });

    it('should return linear path for non-branching conversation', async () => {
      mockSupabase.setQueryResponse([userMessageRow, assistantMessageRow]);

      const result = await repo.getActivePath('session-001');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-001');
      expect(result[1].id).toBe('msg-002');
    });

    it('should pick the latest child at each fork', async () => {
      const rootMsg = {
        ...userMessageRow,
        id: 'msg-root',
        parent_message_id: null,
        created_at: '2025-06-01T10:00:00Z',
      };
      const childA = {
        ...assistantMessageRow,
        id: 'msg-a',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:01:00Z',
      };
      const childB = {
        ...assistantMessageRow,
        id: 'msg-b',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:02:00Z',
      };
      mockSupabase.setQueryResponse([rootMsg, childA, childB]);

      const result = await repo.getActivePath('session-001');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-b'); // latest child
    });

    it('should follow stored branch when activeLeafId is set', async () => {
      // root → childA (older), childB (newer) — childA has a descendant leaf
      const rootMsg = {
        ...userMessageRow,
        id: 'msg-root',
        parent_message_id: null,
        created_at: '2025-06-01T10:00:00Z',
      };
      const childA = {
        ...assistantMessageRow,
        id: 'msg-a',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:01:00Z',
      };
      const childB = {
        ...assistantMessageRow,
        id: 'msg-b',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:02:00Z',
      };
      const leafA = {
        ...userMessageRow,
        id: 'msg-leaf-a',
        parent_message_id: 'msg-a',
        created_at: '2025-06-01T10:03:00Z',
      };
      mockSupabase.setQueryResponse([rootMsg, childA, childB, leafA]);

      // activeLeafId points to leafA, which is on the childA branch
      const result = await repo.getActivePath('session-001', 'msg-leaf-a');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-a'); // follows ancestor, not latest
      expect(result[2].id).toBe('msg-leaf-a');
    });

    it('should fall back to latest when activeLeafId is invalid', async () => {
      const rootMsg = {
        ...userMessageRow,
        id: 'msg-root',
        parent_message_id: null,
        created_at: '2025-06-01T10:00:00Z',
      };
      const childA = {
        ...assistantMessageRow,
        id: 'msg-a',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:01:00Z',
      };
      const childB = {
        ...assistantMessageRow,
        id: 'msg-b',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:02:00Z',
      };
      mockSupabase.setQueryResponse([rootMsg, childA, childB]);

      const result = await repo.getActivePath('session-001', 'nonexistent-id');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-b'); // latest child (fallback)
    });

    it('should extend past activeLeafId with latest child when new messages exist', async () => {
      // root → childA → leafA → newChild (added after branch selection)
      const rootMsg = {
        ...userMessageRow,
        id: 'msg-root',
        parent_message_id: null,
        created_at: '2025-06-01T10:00:00Z',
      };
      const childA = {
        ...assistantMessageRow,
        id: 'msg-a',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:01:00Z',
      };
      const childB = {
        ...assistantMessageRow,
        id: 'msg-b',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:02:00Z',
      };
      const leafA = {
        ...userMessageRow,
        id: 'msg-leaf-a',
        parent_message_id: 'msg-a',
        created_at: '2025-06-01T10:03:00Z',
      };
      const newChild = {
        ...assistantMessageRow,
        id: 'msg-new',
        parent_message_id: 'msg-leaf-a',
        created_at: '2025-06-01T10:04:00Z',
      };
      mockSupabase.setQueryResponse([rootMsg, childA, childB, leafA, newChild]);

      // activeLeafId points to leafA, but newChild was added below it
      const result = await repo.getActivePath('session-001', 'msg-leaf-a');

      expect(result).toHaveLength(4);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-a');
      expect(result[2].id).toBe('msg-leaf-a');
      expect(result[3].id).toBe('msg-new'); // continues past stored leaf
    });

    it('should handle null activeLeafId same as no argument', async () => {
      const rootMsg = {
        ...userMessageRow,
        id: 'msg-root',
        parent_message_id: null,
        created_at: '2025-06-01T10:00:00Z',
      };
      const childA = {
        ...assistantMessageRow,
        id: 'msg-a',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:01:00Z',
      };
      const childB = {
        ...assistantMessageRow,
        id: 'msg-b',
        parent_message_id: 'msg-root',
        created_at: '2025-06-01T10:02:00Z',
      };
      mockSupabase.setQueryResponse([rootMsg, childA, childB]);

      const result = await repo.getActivePath('session-001', null);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-root');
      expect(result[1].id).toBe('msg-b'); // latest child
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([userMessageRow]);

      const result = await repo.findBySessionId('session-001');

      expect(result[0].sessionId).toBe(userMessageRow.session_id);
      expect(result[0].createdAt).toEqual(new Date(userMessageRow.created_at));
    });

    it('should handle null content by defaulting to empty string', async () => {
      const rowWithNullContent = { ...userMessageRow, content: null };
      mockSupabase.setQueryResponse([rowWithNullContent]);

      const result = await repo.findBySessionId('session-001');

      expect(result[0].content).toBe('');
    });

    it('should map parent_message_id to parentMessageId', async () => {
      mockSupabase.setQueryResponse([assistantMessageRow]);

      const result = await repo.findBySessionId('session-001');

      expect(result[0].parentMessageId).toBe('msg-001');
    });

    it('should map null parent_message_id to null parentMessageId', async () => {
      mockSupabase.setQueryResponse([userMessageRow]);

      const result = await repo.findBySessionId('session-001');

      expect(result[0].parentMessageId).toBeNull();
    });
  });
});
