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
const { MessageRepository } = await import('./MessageRepository');

describe('MessageRepository', () => {
  let repo: InstanceType<typeof MessageRepository>;

  beforeEach(() => {
    repo = new MessageRepository();
    mockSupabase.reset();
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
        'id, session_id, role, content, created_at',
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
      });
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

  // ── deleteBySessionId ──

  describe('deleteBySessionId', () => {
    it('should delete all messages for a session', async () => {
      mockSupabase.setResponse(null);

      await repo.deleteBySessionId('session-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('chat_messages');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('session_id', 'session-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.deleteBySessionId('session-001')).rejects.toThrow(DatabaseError);
      await expect(repo.deleteBySessionId('session-001')).rejects.toThrow(
        'Failed to delete messages',
      );
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
  });
});
