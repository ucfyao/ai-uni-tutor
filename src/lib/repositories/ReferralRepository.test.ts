/**
 * ReferralRepository Tests
 *
 * Tests referral codes and referral relationship database operations.
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

const { ReferralRepository } = await import('./ReferralRepository');

describe('ReferralRepository', () => {
  let repo: InstanceType<typeof ReferralRepository>;

  beforeEach(() => {
    repo = new ReferralRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test data ──

  const codeRow = {
    id: 'code-1',
    user_id: 'user-1',
    code: 'TESTCODE',
    type: 'user',
    is_active: true,
    stripe_promotion_code_id: 'promo-1',
    institution_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const referralRow = {
    id: 'ref-1',
    referrer_id: 'user-1',
    referee_id: 'user-2',
    referral_code_id: 'code-1',
    status: 'pending',
    stripe_subscription_id: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  // ── findCodeByCode ──

  describe('findCodeByCode', () => {
    it('should return a mapped entity when code exists', async () => {
      mockSupabase.setSingleResponse(codeRow);

      const result = await repo.findCodeByCode('TESTCODE');

      expect(result).toEqual({
        id: 'code-1',
        userId: 'user-1',
        code: 'TESTCODE',
        type: 'user',
        isActive: true,
        stripePromotionCodeId: 'promo-1',
        institutionId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_codes');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('code', 'TESTCODE');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null on PGRST116 (not found)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findCodeByCode('MISSING');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findCodeByCode('MISSING');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Connection lost'));

      await expect(repo.findCodeByCode('X')).rejects.toThrow(DatabaseError);
      await expect(repo.findCodeByCode('X')).rejects.toThrow('Failed to fetch referral code');
    });
  });

  // ── createCode ──

  describe('createCode', () => {
    it('should insert and return a mapped entity', async () => {
      mockSupabase.setSingleResponse(codeRow);

      const result = await repo.createCode({
        userId: 'user-1',
        code: 'TESTCODE',
        type: 'user' as const,
        stripePromotionCodeId: 'promo-1',
      });

      expect(result.id).toBe('code-1');
      expect(result.userId).toBe('user-1');
      expect(result.code).toBe('TESTCODE');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_codes');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        code: 'TESTCODE',
        type: 'user',
        stripe_promotion_code_id: 'promo-1',
      });
      expect(mockSupabase.client._chain.select).toHaveBeenCalled();
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should default stripePromotionCodeId to null when not provided', async () => {
      mockSupabase.setSingleResponse(codeRow);

      await repo.createCode({
        userId: 'user-1',
        code: 'TESTCODE',
        type: 'user' as const,
      });

      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_promotion_code_id: null }),
      );
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Duplicate code'));

      await expect(
        repo.createCode({
          userId: 'user-1',
          code: 'DUPE',
          type: 'user' as const,
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.createCode({
          userId: 'user-1',
          code: 'DUPE',
          type: 'user' as const,
        }),
      ).rejects.toThrow('Failed to create referral code');
    });
  });

  // ── toggleCodeActive ──

  describe('toggleCodeActive', () => {
    it('should update is_active with correct id', async () => {
      mockSupabase.setResponse(null);

      await repo.toggleCodeActive('code-1', false);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_codes');
      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'code-1');
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(repo.toggleCodeActive('code-1', true)).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.toggleCodeActive('code-1', true)).rejects.toThrow(DatabaseError);
      await expect(repo.toggleCodeActive('code-1', true)).rejects.toThrow(
        'Failed to toggle referral code',
      );
    });
  });

  // ── findReferralByRefereeId ──

  describe('findReferralByRefereeId', () => {
    it('should return a mapped referral entity', async () => {
      mockSupabase.setSingleResponse(referralRow);

      const result = await repo.findReferralByRefereeId('user-2');

      expect(result).toEqual({
        id: 'ref-1',
        referrerId: 'user-1',
        refereeId: 'user-2',
        referralCodeId: 'code-1',
        status: 'pending',
        stripeSubscriptionId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referrals');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('referee_id', 'user-2');
    });

    it('should return null on PGRST116', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findReferralByRefereeId('nobody');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findReferralByRefereeId('nobody');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('DB down'));

      await expect(repo.findReferralByRefereeId('user-2')).rejects.toThrow(DatabaseError);
    });
  });

  // ── createReferral ──

  describe('createReferral', () => {
    it('should insert a referral with correct fields', async () => {
      mockSupabase.setResponse(null);

      await repo.createReferral({
        referrerId: 'user-1',
        refereeId: 'user-2',
        referralCodeId: 'code-1',
      });

      expect(mockSupabase.client.from).toHaveBeenCalledWith('referrals');
      expect(mockSupabase.client._chain.insert).toHaveBeenCalledWith({
        referrer_id: 'user-1',
        referee_id: 'user-2',
        referral_code_id: 'code-1',
      });
    });

    it('should not throw on success', async () => {
      mockSupabase.setResponse(null);

      await expect(
        repo.createReferral({
          referrerId: 'user-1',
          refereeId: 'user-2',
          referralCodeId: 'code-1',
        }),
      ).resolves.toBeUndefined();
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Insert failed'));

      await expect(
        repo.createReferral({
          referrerId: 'user-1',
          refereeId: 'user-2',
          referralCodeId: 'code-1',
        }),
      ).rejects.toThrow(DatabaseError);
      await expect(
        repo.createReferral({
          referrerId: 'user-1',
          refereeId: 'user-2',
          referralCodeId: 'code-1',
        }),
      ).rejects.toThrow('Failed to create referral');
    });
  });

  // ── countByReferrerIds ──

  describe('countByReferrerIds', () => {
    it('should return empty map for empty input', async () => {
      const result = await repo.countByReferrerIds([]);

      expect(result).toEqual(new Map());
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should aggregate total and paid counts per referrer', async () => {
      mockSupabase.setQueryResponse([
        { referrer_id: 'user-1', status: 'pending' },
        { referrer_id: 'user-1', status: 'paid' },
        { referrer_id: 'user-1', status: 'rewarded' },
        { referrer_id: 'user-2', status: 'pending' },
      ]);

      const result = await repo.countByReferrerIds(['user-1', 'user-2']);

      expect(result.get('user-1')).toEqual({ total: 3, paid: 2 });
      expect(result.get('user-2')).toEqual({ total: 1, paid: 0 });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referrals');
      expect(mockSupabase.client._chain.in).toHaveBeenCalledWith('referrer_id', [
        'user-1',
        'user-2',
      ]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Query failed'));

      await expect(repo.countByReferrerIds(['user-1'])).rejects.toThrow(DatabaseError);
      await expect(repo.countByReferrerIds(['user-1'])).rejects.toThrow(
        'Failed to count referrals batch',
      );
    });
  });

  // ── findCodesByUserId ──

  describe('findCodesByUserId', () => {
    it('should return mapped entities', async () => {
      mockSupabase.setQueryResponse([codeRow]);

      const result = await repo.findCodesByUserId('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('code-1');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_codes');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabase.client._chain.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should return empty array when no codes exist', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.findCodesByUserId('user-1');

      expect(result).toEqual([]);
    });

    it('should throw DatabaseError on error', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.findCodesByUserId('user-1')).rejects.toThrow(DatabaseError);
      await expect(repo.findCodesByUserId('user-1')).rejects.toThrow(
        'Failed to fetch referral codes',
      );
    });
  });
});
