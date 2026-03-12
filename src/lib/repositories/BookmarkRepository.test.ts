/**
 * BookmarkRepository Tests
 *
 * Tests all bookmark-related database operations including
 * create (upsert), delete, findByUserId, and isBookmarked.
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
const { BookmarkRepository } = await import('./BookmarkRepository');

describe('BookmarkRepository', () => {
  let repo: InstanceType<typeof BookmarkRepository>;

  beforeEach(() => {
    repo = new BookmarkRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──

  describe('create', () => {
    it('should upsert a bookmark with correct table and conflict key', async () => {
      mockSupabase.setResponse(null);

      await repo.create('user-1', 'paper-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('bookmarked_papers');
      expect(mockSupabase.client._chain.upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', paper_id: 'paper-1' },
        { onConflict: 'user_id,paper_id' },
      );
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.create('user-1', 'paper-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(repo.create('user-1', 'paper-1')).rejects.toThrow(DatabaseError);
      await expect(repo.create('user-1', 'paper-1')).rejects.toThrow(
        'Failed to bookmark paper',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a bookmark with correct filters', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('user-1', 'paper-1');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('bookmarked_papers');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('paper_id', 'paper-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.delete('user-1', 'paper-1')).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('user-1', 'paper-1')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('user-1', 'paper-1')).rejects.toThrow(
        'Failed to remove bookmark',
      );
    });
  });

  // ── findByUserId ──

  describe('findByUserId', () => {
    it('should return an array of paper IDs', async () => {
      mockSupabase.setQueryResponse([
        { paper_id: 'paper-1' },
        { paper_id: 'paper-2' },
        { paper_id: 'paper-3' },
      ]);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual(['paper-1', 'paper-2', 'paper-3']);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('bookmarked_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('paper_id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should return an empty array when no bookmarks exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual([]);
    });

    it('should return an empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByUserId('user-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findByUserId('user-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findByUserId('user-1')).rejects.toThrow('Failed to fetch bookmarks');
    });
  });

  // ── isBookmarked ──

  describe('isBookmarked', () => {
    it('should return true when bookmark exists', async () => {
      mockSupabase.setSingleResponse({ id: 'bookmark-1' });

      const result = await repo.isBookmarked('user-1', 'paper-1');

      expect(result).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('bookmarked_papers');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('paper_id', 'paper-1');
      expect(mockSupabase.client._chain.maybeSingle).toHaveBeenCalled();
    });

    it('should return false when bookmark does not exist', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.isBookmarked('user-1', 'paper-1');

      expect(result).toBe(false);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Check failed'));

      await expect(repo.isBookmarked('user-1', 'paper-1')).rejects.toThrow(DatabaseError);
      await expect(repo.isBookmarked('user-1', 'paper-1')).rejects.toThrow(
        'Failed to check bookmark',
      );
    });
  });
});
