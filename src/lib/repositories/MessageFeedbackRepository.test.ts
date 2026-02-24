/**
 * MessageFeedbackRepository Tests
 *
 * Tests upsert, delete, and findByMessageIds operations
 * for the message_feedback table.
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
const { MessageFeedbackRepository } = await import('./MessageFeedbackRepository');

// ── Fixtures ──

const feedbackRow = {
  id: 'fb-001',
  message_id: 'msg-001',
  user_id: 'user-001',
  feedback_type: 'up' as const,
  created_at: '2025-06-01T10:05:00Z',
};

const feedbackEntity = {
  id: 'fb-001',
  messageId: 'msg-001',
  userId: 'user-001',
  feedbackType: 'up' as const,
  createdAt: new Date('2025-06-01T10:05:00Z'),
};

describe('MessageFeedbackRepository', () => {
  let repo: InstanceType<typeof MessageFeedbackRepository>;

  beforeEach(() => {
    repo = new MessageFeedbackRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── upsert ──

  describe('upsert', () => {
    it('should upsert feedback and return entity', async () => {
      mockSupabase.setSingleResponse(feedbackRow);

      const result = await repo.upsert('msg-001', 'user-001', 'up');

      expect(result).toEqual(feedbackEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('message_feedback');
      expect(mockSupabase.client._chain.upsert).toHaveBeenCalledWith(
        {
          message_id: 'msg-001',
          user_id: 'user-001',
          feedback_type: 'up',
        },
        { onConflict: 'message_id,user_id' },
      );
    });

    it('should throw DatabaseError on upsert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Upsert failed'));

      await expect(repo.upsert('msg-001', 'user-001', 'up')).rejects.toThrow(DatabaseError);
      await expect(repo.upsert('msg-001', 'user-001', 'up')).rejects.toThrow(
        'Failed to upsert feedback',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete feedback for a message', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('msg-001', 'user-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('message_feedback');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('message_id', 'msg-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('msg-001', 'user-001')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('msg-001', 'user-001')).rejects.toThrow('Failed to delete feedback');
    });
  });

  // ── findByMessageIds ──

  describe('findByMessageIds', () => {
    it('should return empty array for empty messageIds', async () => {
      const result = await repo.findByMessageIds([], 'user-001');

      expect(result).toEqual([]);
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should fetch feedback for given message IDs', async () => {
      mockSupabase.setQueryResponse([feedbackRow]);

      const result = await repo.findByMessageIds(['msg-001'], 'user-001');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(feedbackEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('message_feedback');
      expect(mockSupabase.client._chain.in).toHaveBeenCalledWith('message_id', ['msg-001']);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByMessageIds(['msg-001'], 'user-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findByMessageIds(['msg-001'], 'user-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findByMessageIds(['msg-001'], 'user-001')).rejects.toThrow(
        'Failed to fetch feedback',
      );
    });
  });

  // ── entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([feedbackRow]);

      const result = await repo.findByMessageIds(['msg-001'], 'user-001');

      expect(result[0].messageId).toBe(feedbackRow.message_id);
      expect(result[0].userId).toBe(feedbackRow.user_id);
      expect(result[0].feedbackType).toBe(feedbackRow.feedback_type);
      expect(result[0].createdAt).toEqual(new Date(feedbackRow.created_at));
    });
  });
});
