/**
 * CommissionRepository Tests
 *
 * Tests create, find, update, and sum operations
 * for the commissions table.
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
const { CommissionRepository } = await import('./CommissionRepository');

// ── Fixtures ──

const userId = 'user-001';

const commissionRow = {
  id: 'comm-001',
  referral_id: 'ref-001',
  beneficiary_id: 'user-001',
  type: 'cash',
  amount: 10.5,
  currency: 'usd',
  status: 'pending',
  stripe_invoice_id: 'inv_123',
  created_at: '2025-06-01T10:00:00Z',
};

const commissionEntity = {
  id: 'comm-001',
  referralId: 'ref-001',
  beneficiaryId: 'user-001',
  type: 'cash',
  amount: 10.5,
  currency: 'usd',
  status: 'pending',
  stripeInvoiceId: 'inv_123',
  createdAt: new Date('2025-06-01T10:00:00Z'),
};

describe('CommissionRepository', () => {
  let repo: InstanceType<typeof CommissionRepository>;

  beforeEach(() => {
    repo = new CommissionRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create ──

  describe('create', () => {
    it('should insert a commission and return entity', async () => {
      mockSupabase.setSingleResponse(commissionRow);

      const result = await repo.create({
        referralId: 'ref-001',
        beneficiaryId: 'user-001',
        type: 'cash',
        amount: 10.5,
        currency: 'usd',
        stripeInvoiceId: 'inv_123',
      });

      expect(result).toEqual(commissionEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('commissions');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        referral_id: 'ref-001',
        beneficiary_id: 'user-001',
        type: 'cash',
        amount: 10.5,
        currency: 'usd',
        stripe_invoice_id: 'inv_123',
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
    });

    it('should use default currency and null stripe_invoice_id', async () => {
      mockSupabase.setSingleResponse({
        ...commissionRow,
        currency: 'usd',
        stripe_invoice_id: null,
      });

      await repo.create({
        referralId: 'ref-001',
        beneficiaryId: 'user-001',
        type: 'cash',
        amount: 10.5,
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        referral_id: 'ref-001',
        beneficiary_id: 'user-001',
        type: 'cash',
        amount: 10.5,
        currency: 'usd',
        stripe_invoice_id: null,
      });
    });

    it('should throw DatabaseError on insert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.create({
          referralId: 'ref-001',
          beneficiaryId: 'user-001',
          type: 'cash' as const,
          amount: 10.5,
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.create({
          referralId: 'ref-001',
          beneficiaryId: 'user-001',
          type: 'cash' as const,
          amount: 10.5,
        }),
      ).rejects.toThrow('Failed to create commission');
    });
  });

  // ── findByBeneficiaryId ──

  describe('findByBeneficiaryId', () => {
    it('should return commission entities ordered by created_at desc', async () => {
      mockSupabase.setQueryResponse([commissionRow]);

      const result = await repo.findByBeneficiaryId(userId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(commissionEntity);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('commissions');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('beneficiary_id', userId);
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should return empty array when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.findByBeneficiaryId(userId);

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findByBeneficiaryId(userId)).rejects.toThrow(DatabaseError);
      await expect(repo.findByBeneficiaryId(userId)).rejects.toThrow('Failed to fetch commissions');
    });
  });

  // ── updateStatus ──

  describe('updateStatus', () => {
    it('should update the commission status', async () => {
      mockSupabase.setResponse(null);

      await repo.updateStatus('comm-001', 'credited');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('commissions');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith({ status: 'credited' });
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'comm-001');
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.updateStatus('comm-001', 'credited' as const)).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.updateStatus('comm-001', 'credited' as const)).rejects.toThrow(
        'Failed to update commission status',
      );
    });
  });

  // ── sumByBeneficiary ──

  describe('sumByBeneficiary', () => {
    it('should sum amounts for a beneficiary', async () => {
      mockSupabase.setQueryResponse([{ amount: 10.5 }, { amount: 20.0 }, { amount: 5.25 }]);

      const result = await repo.sumByBeneficiary(userId);

      expect(result).toBe(35.75);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('commissions');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('amount');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('beneficiary_id', userId);
      expect(mockSupabase.client._chain.neq).toHaveBeenCalledWith('status', 'clawed_back');
    });

    it('should filter by type when provided', async () => {
      mockSupabase.setQueryResponse([{ amount: 10.5 }]);

      await repo.sumByBeneficiary(userId, 'cash' as const);

      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('beneficiary_id', userId);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('type', 'cash');
    });

    it('should return 0 when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.sumByBeneficiary(userId);

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on sum failure', async () => {
      mockSupabase.setErrorResponse(dbError('Sum failed'));

      await expect(repo.sumByBeneficiary(userId)).rejects.toThrow(DatabaseError);
      await expect(repo.sumByBeneficiary(userId)).rejects.toThrow('Failed to sum commissions');
    });
  });

  // ── sumByBeneficiarySince ──

  describe('sumByBeneficiarySince', () => {
    it('should sum amounts since a given date', async () => {
      const since = new Date('2025-05-01T00:00:00Z');
      mockSupabase.setQueryResponse([{ amount: 15.0 }, { amount: 25.0 }]);

      const result = await repo.sumByBeneficiarySince(userId, since);

      expect(result).toBe(40.0);
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('beneficiary_id', userId);
      expect(mockSupabase.client._chain.neq).toHaveBeenCalledWith('status', 'clawed_back');
      expect(mockSupabase.client._chain.gte).toHaveBeenCalledWith(
        'created_at',
        since.toISOString(),
      );
    });

    it('should return 0 when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.sumByBeneficiarySince(userId, new Date());

      expect(result).toBe(0);
    });

    it('should throw DatabaseError on sum failure', async () => {
      mockSupabase.setErrorResponse(dbError('Sum failed'));

      await expect(repo.sumByBeneficiarySince(userId, new Date())).rejects.toThrow(DatabaseError);
      await expect(repo.sumByBeneficiarySince(userId, new Date())).rejects.toThrow(
        'Failed to sum commissions since date',
      );
    });
  });

  // ── entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setQueryResponse([commissionRow]);

      const result = await repo.findByBeneficiaryId(userId);

      expect(result[0].referralId).toBe(commissionRow.referral_id);
      expect(result[0].beneficiaryId).toBe(commissionRow.beneficiary_id);
      expect(result[0].stripeInvoiceId).toBe(commissionRow.stripe_invoice_id);
      expect(result[0].createdAt).toEqual(new Date(commissionRow.created_at));
    });
  });
});
