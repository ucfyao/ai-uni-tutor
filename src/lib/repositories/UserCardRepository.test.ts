/**
 * UserCardRepository Tests
 *
 * Tests user card database operations including
 * entity mapping, filtering, ordering, and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const { UserCardRepository } = await import('./UserCardRepository');

// ── Test Data ──

const userCardRow = {
  id: 'uc-001',
  user_id: 'user-001',
  session_id: 'session-001',
  title: 'Recursion',
  content: 'Recursion is a method of solving problems...',
  excerpt: 'A method of solving problems',
  source_message_id: 'msg-001',
  source_role: 'assistant' as const,
  created_at: '2025-06-01T10:00:00Z',
};

const userCardEntity = {
  id: 'uc-001',
  userId: 'user-001',
  sessionId: 'session-001',
  title: 'Recursion',
  content: 'Recursion is a method of solving problems...',
  excerpt: 'A method of solving problems',
  sourceMessageId: 'msg-001',
  sourceRole: 'assistant' as const,
  createdAt: new Date('2025-06-01T10:00:00Z'),
};

const userCardRow2 = {
  id: 'uc-002',
  user_id: 'user-001',
  session_id: 'session-002',
  title: 'Binary Search',
  content: 'Binary search is an efficient algorithm...',
  excerpt: 'An efficient algorithm',
  source_message_id: 'msg-010',
  source_role: 'assistant' as const,
  created_at: '2025-06-02T10:00:00Z',
};

const userCardEntity2 = {
  id: 'uc-002',
  userId: 'user-001',
  sessionId: 'session-002',
  title: 'Binary Search',
  content: 'Binary search is an efficient algorithm...',
  excerpt: 'An efficient algorithm',
  sourceMessageId: 'msg-010',
  sourceRole: 'assistant' as const,
  createdAt: new Date('2025-06-02T10:00:00Z'),
};

describe('UserCardRepository', () => {
  let repo: InstanceType<typeof UserCardRepository>;

  beforeEach(() => {
    repo = new UserCardRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findByUserId ──

  describe('findByUserId', () => {
    it('should return user cards ordered by created_at descending', async () => {
      mockSupabase.setQueryResponse([userCardRow2, userCardRow]);

      const result = await repo.findByUserId('user-001');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(userCardEntity2);
      expect(result[1]).toEqual(userCardEntity);
    });

    it('should query with correct table, filter, and ordering', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByUserId('user-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('user_cards');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should return empty array when no cards exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByUserId('user-999');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByUserId('user-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findByUserId('user-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findByUserId('user-001')).rejects.toThrow('Failed to fetch user cards');
    });
  });

  // ── findBySessionId ──

  describe('findBySessionId', () => {
    it('should return user cards filtered by session and user', async () => {
      mockSupabase.setQueryResponse([userCardRow]);

      const result = await repo.findBySessionId('session-001', 'user-001');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(userCardEntity);
    });

    it('should query with correct filters and ordering', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findBySessionId('session-001', 'user-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('user_cards');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('session_id', 'session-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('should return empty array when no cards exist for session', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findBySessionId('session-999', 'user-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findBySessionId('session-001', 'user-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findBySessionId('session-001', 'user-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findBySessionId('session-001', 'user-001')).rejects.toThrow(
        'Failed to fetch user cards by session',
      );
    });
  });

  // ── create ──

  describe('create', () => {
    it('should insert a user card and return the entity', async () => {
      mockSupabase.setSingleResponse(userCardRow);

      const dto = {
        userId: 'user-001',
        sessionId: 'session-001',
        title: 'Recursion',
        content: 'Recursion is a method of solving problems...',
        excerpt: 'A method of solving problems',
        sourceMessageId: 'msg-001',
        sourceRole: 'assistant' as const,
      };

      const result = await repo.create(dto);

      expect(result).toEqual(userCardEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('user_cards');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-001',
        session_id: 'session-001',
        title: 'Recursion',
        content: 'Recursion is a method of solving problems...',
        excerpt: 'A method of solving problems',
        source_message_id: 'msg-001',
        source_role: 'assistant',
      });
    });

    it('should handle optional fields as null/empty', async () => {
      const rowMinimal = {
        ...userCardRow,
        session_id: null,
        source_message_id: null,
        source_role: null,
        content: '',
        excerpt: '',
      };
      mockSupabase.setSingleResponse(rowMinimal);

      const dto = {
        userId: 'user-001',
        title: 'Minimal Card',
      };

      await repo.create(dto);

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: null,
          source_message_id: null,
          source_role: null,
          content: '',
          excerpt: '',
        }),
      );
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const dto = {
        userId: 'user-001',
        title: 'Test',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.create(dto)).rejects.toThrow('Failed to create user card');
    });

    it('should throw DatabaseError when data is null', async () => {
      mockSupabase.setResponse(null);

      const dto = {
        userId: 'user-001',
        title: 'Test',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a user card by id and userId', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('uc-001', 'user-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('user_cards');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'uc-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('uc-001', 'user-001')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('uc-001', 'user-001')).rejects.toThrow(
        'Failed to delete user card',
      );
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([userCardRow]);

      const result = await repo.findByUserId('user-001');

      expect(result[0].userId).toBe(userCardRow.user_id);
      expect(result[0].sessionId).toBe(userCardRow.session_id);
      expect(result[0].sourceMessageId).toBe(userCardRow.source_message_id);
      expect(result[0].sourceRole).toBe(userCardRow.source_role);
      expect(result[0].createdAt).toEqual(new Date(userCardRow.created_at));
    });
  });
});
