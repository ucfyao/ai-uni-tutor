/**
 * AgentRepository Tests
 *
 * Tests campus agent applications, wallets, and withdrawal database operations.
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

const { AgentRepository } = await import('./AgentRepository');

describe('AgentRepository', () => {
  let repo: InstanceType<typeof AgentRepository>;

  beforeEach(() => {
    repo = new AgentRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test data ──

  const applicationRow = {
    id: 'app-1',
    user_id: 'user-1',
    full_name: 'John Doe',
    university: 'MIT',
    contact_info: { email: 'john@mit.edu' },
    motivation: 'Want to help',
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  const walletRow = {
    id: 'wallet-1',
    user_id: 'user-1',
    balance: 100.0,
    total_earned: 200.0,
    total_withdrawn: 100.0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  // ── createApplication ──

  describe('createApplication', () => {
    it('should insert and return a mapped entity', async () => {
      mockSupabase.setSingleResponse(applicationRow);

      const result = await repo.createApplication({
        userId: 'user-1',
        fullName: 'John Doe',
        university: 'MIT',
        contactInfo: { email: 'john@mit.edu' },
        motivation: 'Want to help',
      });

      expect(result).toEqual({
        id: 'app-1',
        userId: 'user-1',
        fullName: 'John Doe',
        university: 'MIT',
        contactInfo: { email: 'john@mit.edu' },
        motivation: 'Want to help',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('agent_applications');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        full_name: 'John Doe',
        university: 'MIT',
        contact_info: { email: 'john@mit.edu' },
        motivation: 'Want to help',
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.createApplication({
          userId: 'user-1',
          fullName: 'John',
          university: 'MIT',
          contactInfo: {},
          motivation: 'x',
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.createApplication({
          userId: 'user-1',
          fullName: 'John',
          university: 'MIT',
          contactInfo: {},
          motivation: 'x',
        }),
      ).rejects.toThrow('Failed to create agent application');
    });
  });

  // ── findApplicationByUserId ──

  describe('findApplicationByUserId', () => {
    it('should return a mapped entity for existing application', async () => {
      mockSupabase.setSingleResponse(applicationRow);

      const result = await repo.findApplicationByUserId('user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('app-1');
      expect(result!.userId).toBe('user-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('agent_applications');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabase.client._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findApplicationByUserId('nobody');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findApplicationByUserId('nobody');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB error'));

      await expect(repo.findApplicationByUserId('user-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findApplicationByUserId('user-1')).rejects.toThrow(
        'Failed to fetch agent application',
      );
    });
  });

  // ── updateApplication ──

  describe('updateApplication', () => {
    it('should update application status with review info', async () => {
      mockSupabase.setResponse(null);
      const reviewedAt = new Date('2026-01-02T00:00:00Z');

      await repo.updateApplication('app-1', {
        status: 'approved' as const,
        reviewedBy: 'admin-1',
        reviewedAt,
      });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('agent_applications');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({
        status: 'approved',
        reviewed_by: 'admin-1',
        reviewed_at: '2026-01-02T00:00:00.000Z',
      });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'app-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(
        repo.updateApplication('app-1', {
          status: 'rejected' as const,
          reviewedBy: 'admin-1',
          reviewedAt: new Date(),
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(
        repo.updateApplication('app-1', {
          status: 'approved' as const,
          reviewedBy: 'admin-1',
          reviewedAt: new Date(),
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.updateApplication('app-1', {
          status: 'approved' as const,
          reviewedBy: 'admin-1',
          reviewedAt: new Date(),
        }),
      ).rejects.toThrow('Failed to update agent application');
    });
  });

  // ── findWalletByUserId ──

  describe('findWalletByUserId', () => {
    it('should return a mapped wallet entity', async () => {
      mockSupabase.setSingleResponse(walletRow);

      const result = await repo.findWalletByUserId('user-1');

      expect(result).toEqual({
        id: 'wallet-1',
        userId: 'user-1',
        balance: 100.0,
        totalEarned: 200.0,
        totalWithdrawn: 100.0,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('agent_wallets');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findWalletByUserId('nobody');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findWalletByUserId('nobody');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB error'));

      await expect(repo.findWalletByUserId('user-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findWalletByUserId('user-1')).rejects.toThrow(
        'Failed to fetch agent wallet',
      );
    });
  });

  // ── createWallet ──

  describe('createWallet', () => {
    it('should insert and return a mapped wallet entity', async () => {
      mockSupabase.setSingleResponse(walletRow);

      const result = await repo.createWallet('user-1');

      expect(result.id).toBe('wallet-1');
      expect(result.userId).toBe('user-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('agent_wallets');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(repo.createWallet('user-1')).rejects.toThrow(DatabaseError);
      await expect(repo.createWallet('user-1')).rejects.toThrow('Failed to create agent wallet');
    });
  });

  // ── incrementWalletBalance ──

  describe('incrementWalletBalance', () => {
    it('should call RPC with correct params', async () => {
      mockSupabase.setResponse(null, null);

      await repo.incrementWalletBalance('user-1', 50.0);

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('increment_wallet_balance', {
        p_user_id: 'user-1',
        p_amount: 50.0,
      });
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null, null);

      await expect(repo.incrementWalletBalance('user-1', 25)).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on RPC error', async () => {
      mockSupabase.setErrorResponse(dbError('RPC failed'));

      await expect(repo.incrementWalletBalance('user-1', 50)).rejects.toThrow(DatabaseError);
      await expect(repo.incrementWalletBalance('user-1', 50)).rejects.toThrow(
        'Failed to increment wallet balance',
      );
    });
  });

  // ── completeWithdrawalAtomic ──

  describe('completeWithdrawalAtomic', () => {
    it('should call RPC with correct params', async () => {
      mockSupabase.setResponse(null, null);

      await repo.completeWithdrawalAtomic('withdrawal-1', 'admin-1');

      expect(mockSupabase.client.rpc).toHaveBeenCalledWith('complete_withdrawal_atomic', {
        p_withdrawal_id: 'withdrawal-1',
        p_admin_id: 'admin-1',
      });
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null, null);

      await expect(
        repo.completeWithdrawalAtomic('withdrawal-1', 'admin-1'),
      ).resolves.toBeUndefined();
    });

    it('should throw "Withdrawal not found" when error contains "not found"', async () => {
      mockSupabase.setErrorResponse(dbError('Withdrawal not found'));

      await expect(repo.completeWithdrawalAtomic('x', 'admin')).rejects.toThrow(
        'Withdrawal not found',
      );
    });

    it('should throw specific message when error contains "Only approved"', async () => {
      mockSupabase.setErrorResponse(dbError('Only approved withdrawals'));

      await expect(repo.completeWithdrawalAtomic('x', 'admin')).rejects.toThrow(
        'Only approved withdrawals can be completed',
      );
    });

    it('should throw DatabaseError on other RPC errors', async () => {
      mockSupabase.setErrorResponse(dbError('Unexpected'));

      await expect(repo.completeWithdrawalAtomic('x', 'admin')).rejects.toThrow(DatabaseError);
      await expect(repo.completeWithdrawalAtomic('x', 'admin')).rejects.toThrow(
        'Failed to complete withdrawal',
      );
    });
  });
});
