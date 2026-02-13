/**
 * SessionRepository Tests
 *
 * Tests all session-related database operations including
 * entity mapping (snake_case -> camelCase), error handling,
 * and Supabase query construction.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pinnedSessionRow,
  sessionEntity,
  sessionRow,
  sharedSessionRow,
  testCourse,
} from '@/__tests__/fixtures/sessions';
import {
  createMockSupabase,
  dbError,
  PGRST116,
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
const { SessionRepository } = await import('./SessionRepository');

describe('SessionRepository', () => {
  let repo: InstanceType<typeof SessionRepository>;

  beforeEach(() => {
    repo = new SessionRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a session entity when found', async () => {
      mockSupabase.setSingleResponse(sessionRow);

      const result = await repo.findById('session-001');

      expect(result).toEqual(sessionEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('chat_sessions');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'session-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when session is not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('session-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Connection timeout'));

      await expect(repo.findById('session-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('session-001')).rejects.toThrow('Failed to fetch session');
    });
  });

  // ── findByIdAndUserId ──

  describe('findByIdAndUserId', () => {
    it('should return a session entity when found', async () => {
      mockSupabase.setSingleResponse(sessionRow);

      const result = await repo.findByIdAndUserId('session-001', 'user-free-001');

      expect(result).toEqual(sessionEntity);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'session-001');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-free-001');
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findByIdAndUserId('session-001', 'wrong-user');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findByIdAndUserId('session-001', 'user-free-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Internal error'));

      await expect(repo.findByIdAndUserId('session-001', 'user-free-001')).rejects.toThrow(
        DatabaseError,
      );
    });
  });

  // ── findAllByUserId ──

  describe('findAllByUserId', () => {
    it('should return an array of session entities', async () => {
      mockSupabase.setQueryResponse([sessionRow, pinnedSessionRow]);

      const result = await repo.findAllByUserId('user-free-001');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-001');
      expect(result[1].id).toBe('session-002');
      expect(result[1].isPinned).toBe(true);
    });

    it('should order by is_pinned desc then updated_at desc', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.findAllByUserId('user-free-001');

      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('is_pinned', {
        ascending: false,
      });
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('updated_at', {
        ascending: false,
      });
    });

    it('should return empty array when no sessions exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findAllByUserId('user-free-001');

      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findAllByUserId('user-free-001');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findAllByUserId('user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findAllByUserId('user-free-001')).rejects.toThrow(
        'Failed to fetch sessions',
      );
    });
  });

  // ── findSharedById ──

  describe('findSharedById', () => {
    it('should return a shared session with valid expiry', async () => {
      mockSupabase.setSingleResponse(sharedSessionRow);

      const result = await repo.findSharedById('session-003');

      expect(result).not.toBeNull();
      expect(result!.isShared).toBe(true);
      expect(result!.shareExpiresAt).toEqual(new Date('2026-12-31T23:59:59Z'));
    });

    it('should filter by is_shared=true and valid expiry', async () => {
      mockSupabase.setSingleResponse(sharedSessionRow);

      await repo.findSharedById('session-003');

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'session-003');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('is_shared', true);
      expect(mockSupabase.client._chain.or).toHaveBeenCalledWith(
        expect.stringContaining('share_expires_at.is.null'),
      );
    });

    it('should return null when not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findSharedById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findSharedById('session-003');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.findSharedById('session-003')).rejects.toThrow(DatabaseError);
      await expect(repo.findSharedById('session-003')).rejects.toThrow(
        'Failed to fetch shared session',
      );
    });
  });

  // ── create ──

  describe('create', () => {
    it('should create a session and return the entity', async () => {
      mockSupabase.setSingleResponse(sessionRow);

      const dto = {
        userId: 'user-free-001',
        course: testCourse,
        mode: 'Lecture Helper' as const,
        title: 'My First Session',
      };

      const result = await repo.create(dto);

      expect(result).toEqual(sessionEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('chat_sessions');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-free-001',
        course: testCourse,
        mode: 'Lecture Helper',
        title: 'My First Session',
        is_pinned: false,
        is_shared: false,
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      const dto = {
        userId: 'user-free-001',
        course: testCourse,
        mode: null,
        title: 'Test',
      };

      await expect(repo.create(dto)).rejects.toThrow(DatabaseError);
      await expect(repo.create(dto)).rejects.toThrow('Failed to create session');
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update title with snake_case mapping', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', { title: 'Updated Title' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'session-001');
    });

    it('should map isPinned to is_pinned', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', { isPinned: true });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_pinned: true,
        }),
      );
    });

    it('should map isShared to is_shared', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', { isShared: true });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_shared: true,
        }),
      );
    });

    it('should map shareExpiresAt to share_expires_at ISO string', async () => {
      mockSupabase.setResponse(null);
      const expiryDate = new Date('2026-12-31T23:59:59Z');

      await repo.update('session-001', { shareExpiresAt: expiryDate });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          share_expires_at: expiryDate.toISOString(),
        }),
      );
    });

    it('should map shareExpiresAt null to null', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', { shareExpiresAt: null });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          share_expires_at: null,
        }),
      );
    });

    it('should map mode to mode', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', { mode: 'Mock Exam' as const });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'Mock Exam',
        }),
      );
    });

    it('should always include updated_at', async () => {
      mockSupabase.setResponse(null);

      await repo.update('session-001', {});

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
      );
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('session-001', { title: 'New' })).rejects.toThrow(DatabaseError);
      await expect(repo.update('session-001', { title: 'New' })).rejects.toThrow(
        'Failed to update session',
      );
    });
  });

  // ── delete ──

  describe('delete', () => {
    it('should delete a session by id', async () => {
      mockSupabase.setResponse(null);

      await repo.delete('session-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('chat_sessions');
      expect(mockSupabase.client._chain.delete).toHaveBeenCalled();
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'session-001');
    });

    it('should throw DatabaseError on delete failure', async () => {
      mockSupabase.setErrorResponse(dbError('Delete failed'));

      await expect(repo.delete('session-001')).rejects.toThrow(DatabaseError);
      await expect(repo.delete('session-001')).rejects.toThrow('Failed to delete session');
    });
  });

  // ── verifyOwnership ──

  describe('verifyOwnership', () => {
    it('should return true when session belongs to user', async () => {
      mockSupabase.setSingleResponse(sessionRow);

      const result = await repo.verifyOwnership('session-001', 'user-free-001');

      expect(result).toBe(true);
    });

    it('should return false when session does not belong to user', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.verifyOwnership('session-001', 'wrong-user');

      expect(result).toBe(false);
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(sessionRow);

      const result = await repo.findById('session-001');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(sessionRow.user_id);
      expect(result!.isPinned).toBe(sessionRow.is_pinned);
      expect(result!.isShared).toBe(sessionRow.is_shared);
      expect(result!.shareExpiresAt).toBeNull();
      expect(result!.createdAt).toEqual(new Date(sessionRow.created_at));
      expect(result!.updatedAt).toEqual(new Date(sessionRow.updated_at));
    });

    it('should convert shareExpiresAt string to Date', async () => {
      mockSupabase.setSingleResponse(sharedSessionRow);

      const result = await repo.findById('session-003');

      expect(result!.shareExpiresAt).toEqual(new Date('2026-12-31T23:59:59Z'));
    });
  });
});
