/**
 * InstitutionRepository Tests
 *
 * Tests institution, member, and invite database operations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const { InstitutionRepository } = await import('./InstitutionRepository');

describe('InstitutionRepository', () => {
  let repo: InstanceType<typeof InstitutionRepository>;

  beforeEach(() => {
    repo = new InstitutionRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test data ──

  const institutionRow = {
    id: 'inst-1',
    name: 'Test University',
    admin_id: 'admin-1',
    commission_rate: 0.2,
    contact_info: { phone: '123' },
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const memberRow = {
    id: 'member-1',
    institution_id: 'inst-1',
    user_id: 'user-1',
    status: 'active',
    invited_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-02T00:00:00Z',
  };

  const inviteRow = {
    id: 'invite-1',
    institution_id: 'inst-1',
    invite_code: 'INVITE123',
    created_by: 'admin-1',
    max_uses: 10,
    used_count: 2,
    expires_at: '2026-12-31T00:00:00Z',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };

  // ── createAtomic ──

  describe('createAtomic', () => {
    it('should call RPC with correct params and return institution id', async () => {
      mockSupabase.setResponse('inst-new', null);

      const result = await repo.createAtomic({
        name: 'New University',
        adminId: 'admin-1',
        commissionRate: 0.15,
        contactInfo: { email: 'admin@uni.edu' },
      });

      expect(result).toBe('inst-new');
      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('create_institution', {
        p_name: 'New University',
        p_admin_id: 'admin-1',
        p_commission_rate: 0.15,
        p_contact_info: { email: 'admin@uni.edu' },
      });
    });

    it('should default commissionRate to 0.2 and contactInfo to {}', async () => {
      mockSupabase.setResponse('inst-new', null);

      await repo.createAtomic({ name: 'Uni', adminId: 'admin-1' });

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('create_institution', {
        p_name: 'Uni',
        p_admin_id: 'admin-1',
        p_commission_rate: 0.2,
        p_contact_info: {},
      });
    });

    it('should throw DatabaseError on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(
        repo.createAtomic({ name: 'Uni', adminId: 'admin-1' }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.createAtomic({ name: 'Uni', adminId: 'admin-1' }),
      ).rejects.toThrow('Failed to create institution');
    });
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a mapped institution entity', async () => {
      mockSupabase.setSingleResponse(institutionRow);

      const result = await repo.findById('inst-1');

      expect(result).toEqual({
        id: 'inst-1',
        name: 'Test University',
        adminId: 'admin-1',
        commissionRate: 0.2,
        contactInfo: { phone: '123' },
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('institutions');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'inst-1');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB error'));

      await expect(repo.findById('inst-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('inst-1')).rejects.toThrow('Failed to fetch institution');
    });
  });

  // ── findByAdminId ──

  describe('findByAdminId', () => {
    it('should return a mapped institution entity', async () => {
      mockSupabase.setSingleResponse(institutionRow);

      const result = await repo.findByAdminId('admin-1');

      expect(result).not.toBeNull();
      expect(result!.adminId).toBe('admin-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('institutions');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('admin_id', 'admin-1');
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findByAdminId('nobody');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB error'));

      await expect(repo.findByAdminId('admin-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findByAdminId('admin-1')).rejects.toThrow(
        'Failed to fetch institution by admin',
      );
    });
  });

  // ── listAll ──

  describe('listAll', () => {
    it('should return all institutions', async () => {
      mockSupabase.setQueryResponse([institutionRow]);

      const result = await repo.listAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inst-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('institutions');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should filter by isActive when provided', async () => {
      mockSupabase.setQueryResponse([institutionRow]);

      await repo.listAll(true);

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should not filter by isActive when undefined', async () => {
      mockSupabase.setQueryResponse([]);

      await repo.listAll();

      // eq should not have been called for is_active
      const eqCalls = mockSupabase.client._chain.eq.mock.calls;
      const isActiveCalls = eqCalls.filter(
        (call: unknown[]) => call[0] === 'is_active',
      );
      expect(isActiveCalls).toHaveLength(0);
    });

    it('should return empty array when no institutions exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.listAll();

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.listAll()).rejects.toThrow(DatabaseError);
      await expect(repo.listAll()).rejects.toThrow('Failed to list institutions');
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update with mapped fields', async () => {
      mockSupabase.setResponse(null);

      await repo.update('inst-1', {
        name: 'Updated University',
        commissionRate: 0.25,
        isActive: false,
      });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('institutions');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        name: 'Updated University',
        commission_rate: 0.25,
        is_active: false,
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'inst-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.update('inst-1', { name: 'New' })).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('inst-1', { name: 'New' })).rejects.toThrow(DatabaseError);
      await expect(repo.update('inst-1', { name: 'New' })).rejects.toThrow(
        'Failed to update institution',
      );
    });
  });

  // ── listMembers ──

  describe('listMembers', () => {
    it('should return mapped member entities', async () => {
      mockSupabase.setQueryResponse([memberRow]);

      const result = await repo.listMembers('inst-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'member-1',
        institutionId: 'inst-1',
        userId: 'user-1',
        status: 'active',
        invitedAt: new Date('2026-01-01T00:00:00Z'),
        joinedAt: new Date('2026-01-02T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('institution_members');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('institution_id', 'inst-1');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('invited_at', {
        ascending: false,
      });
    });

    it('should return empty array when no members exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.listMembers('inst-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.listMembers('inst-1')).rejects.toThrow(DatabaseError);
      await expect(repo.listMembers('inst-1')).rejects.toThrow('Failed to list members');
    });
  });

  // ── findInviteByCode ──

  describe('findInviteByCode', () => {
    it('should return a mapped invite entity', async () => {
      mockSupabase.setSingleResponse(inviteRow);

      const result = await repo.findInviteByCode('INVITE123');

      expect(result).toEqual({
        id: 'invite-1',
        institutionId: 'inst-1',
        inviteCode: 'INVITE123',
        createdBy: 'admin-1',
        maxUses: 10,
        usedCount: 2,
        expiresAt: new Date('2026-12-31T00:00:00Z'),
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('institution_invites');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('invite_code', 'INVITE123');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findInviteByCode('MISSING');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findInviteByCode('MISSING');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findInviteByCode('X')).rejects.toThrow(DatabaseError);
      await expect(repo.findInviteByCode('X')).rejects.toThrow('Failed to fetch invite');
    });
  });

  // ── toggleInvite ──

  describe('toggleInvite', () => {
    it('should update is_active with correct id', async () => {
      mockSupabase.setResponse(null);

      await repo.toggleInvite('invite-1', false);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('institution_invites');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'invite-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.toggleInvite('invite-1', true)).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.toggleInvite('invite-1', true)).rejects.toThrow(DatabaseError);
      await expect(repo.toggleInvite('invite-1', true)).rejects.toThrow(
        'Failed to toggle invite',
      );
    });
  });
});
