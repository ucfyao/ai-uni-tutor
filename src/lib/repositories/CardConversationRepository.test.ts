/**
 * CardConversationRepository Tests
 *
 * Tests card conversation database operations including
 * entity mapping, ordering, and error handling.
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
const { CardConversationRepository } = await import('./CardConversationRepository');

// ── Test Data ──

const conversationRow = {
  id: 'conv-001',
  card_id: 'card-001',
  card_type: 'knowledge' as const,
  user_id: 'user-001',
  session_id: 'session-001',
  course_code: 'CS101',
  role: 'user' as const,
  content: 'What does this concept mean?',
  created_at: '2025-06-01T10:00:00Z',
};

const conversationEntity = {
  id: 'conv-001',
  cardId: 'card-001',
  cardType: 'knowledge' as const,
  userId: 'user-001',
  sessionId: 'session-001',
  courseCode: 'CS101',
  role: 'user' as const,
  content: 'What does this concept mean?',
  createdAt: new Date('2025-06-01T10:00:00Z'),
};

const assistantRow = {
  id: 'conv-002',
  card_id: 'card-001',
  card_type: 'knowledge' as const,
  user_id: 'user-001',
  session_id: 'session-001',
  course_code: 'CS101',
  role: 'assistant' as const,
  content: 'This concept refers to...',
  created_at: '2025-06-01T10:01:00Z',
};

const assistantEntity = {
  id: 'conv-002',
  cardId: 'card-001',
  cardType: 'knowledge' as const,
  userId: 'user-001',
  sessionId: 'session-001',
  courseCode: 'CS101',
  role: 'assistant' as const,
  content: 'This concept refers to...',
  createdAt: new Date('2025-06-01T10:01:00Z'),
};

describe('CardConversationRepository', () => {
  let repo: InstanceType<typeof CardConversationRepository>;

  beforeEach(() => {
    repo = new CardConversationRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findByCardId ──

  describe('findByCardId', () => {
    it('should return conversations ordered by created_at ascending', async () => {
      mockSupabase.setQueryResponse([conversationRow, assistantRow]);

      const result = await repo.findByCardId('card-001', 'knowledge');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(conversationEntity);
      expect(result[1]).toEqual(assistantEntity);
    });

    it('should query with correct table, filters, and ordering', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByCardId('card-001', 'knowledge');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('card_conversations');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('card_id', 'card-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('card_type', 'knowledge');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('should filter by user card type', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findByCardId('card-002', 'user');

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('card_id', 'card-002');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('card_type', 'user');
    });

    it('should return empty array when no conversations exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByCardId('card-999', 'knowledge');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByCardId('card-001', 'knowledge');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.findByCardId('card-001', 'knowledge')).rejects.toThrow(DatabaseError);
      await expect(repo.findByCardId('card-001', 'knowledge')).rejects.toThrow(
        'Failed to fetch card conversations',
      );
    });
  });

  // ── create ──

  describe('create', () => {
    it('should insert a conversation and return the entity', async () => {
      mockSupabase.setSingleResponse(conversationRow);

      const dto = {
        cardId: 'card-001',
        cardType: 'knowledge' as const,
        userId: 'user-001',
        sessionId: 'session-001',
        courseCode: 'CS101',
        role: 'user' as const,
        content: 'What does this concept mean?',
      };

      const result = await repo.create(dto);

      expect(result).toEqual(conversationEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('card_conversations');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        card_id: 'card-001',
        card_type: 'knowledge',
        user_id: 'user-001',
        session_id: 'session-001',
        course_code: 'CS101',
        role: 'user',
        content: 'What does this concept mean?',
      });
    });

    it('should handle optional sessionId and courseCode as null', async () => {
      const rowNoOptionals = {
        ...conversationRow,
        session_id: null,
        course_code: null,
      };
      mockSupabase.setSingleResponse(rowNoOptionals);

      const dto = {
        cardId: 'card-001',
        cardType: 'knowledge' as const,
        userId: 'user-001',
        role: 'user' as const,
        content: 'Question',
      };

      await repo.create(dto);

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: null,
          course_code: null,
        }),
      );
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const dto = {
        cardId: 'card-001',
        cardType: 'knowledge' as const,
        userId: 'user-001',
        role: 'user' as const,
        content: 'Test',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.create(dto)).rejects.toThrow('Failed to create card conversation');
    });

    it('should throw DatabaseError when data is null', async () => {
      mockSupabase.setResponse(null);

      const dto = {
        cardId: 'card-001',
        cardType: 'knowledge' as const,
        userId: 'user-001',
        role: 'user' as const,
        content: 'Test',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([conversationRow]);

      const result = await repo.findByCardId('card-001', 'knowledge');

      expect(result[0].cardId).toBe(conversationRow.card_id);
      expect(result[0].cardType).toBe(conversationRow.card_type);
      expect(result[0].userId).toBe(conversationRow.user_id);
      expect(result[0].sessionId).toBe(conversationRow.session_id);
      expect(result[0].courseCode).toBe(conversationRow.course_code);
      expect(result[0].createdAt).toEqual(new Date(conversationRow.created_at));
    });
  });
});
