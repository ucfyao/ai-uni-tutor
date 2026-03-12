/**
 * ReferralConfigRepository Tests
 *
 * Tests getConfig, getAllConfig, and updateConfig operations
 * for the referral_config table.
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

// Import after mocks
const { ReferralConfigRepository } = await import('./ReferralConfigRepository');

describe('ReferralConfigRepository', () => {
  let repo: InstanceType<typeof ReferralConfigRepository>;

  beforeEach(() => {
    repo = new ReferralConfigRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('should return parsed numeric value for a config key', async () => {
      mockSupabase.setSingleResponse({ value: '0.25' });

      const result = await repo.getConfig('agent_commission_rate');

      expect(result).toBe(0.25);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_config');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('value');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('key', 'agent_commission_rate');
    });

    it('should return numeric value directly when value is a number', async () => {
      mockSupabase.setSingleResponse({ value: 0.3 });

      const result = await repo.getConfig('agent_commission_rate');

      expect(result).toBe(0.3);
    });

    it('should return default value when row not found (PGRST116)', async () => {
      mockSupabase.setResponse(null, PGRST116);

      const result = await repo.getConfig('agent_commission_rate');

      expect(result).toBe(0.2);
    });

    it('should return default value when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.getConfig('min_withdrawal_amount');

      expect(result).toBe(50);
    });

    it('should throw DatabaseError on non-PGRST116 error', async () => {
      mockSupabase.setErrorResponse(dbError('Connection failed'));

      await expect(repo.getConfig('agent_commission_rate')).rejects.toThrow(DatabaseError);
      await expect(repo.getConfig('agent_commission_rate')).rejects.toThrow(
        'Failed to fetch referral config',
      );
    });
  });

  // ── getAllConfig ──

  describe('getAllConfig', () => {
    it('should return merged config with DB values overriding defaults', async () => {
      mockSupabase.setQueryResponse([
        { key: 'agent_commission_rate', value: '0.3' },
        { key: 'min_withdrawal_amount', value: '100' },
      ]);

      const result = await repo.getAllConfig();

      expect(result).toEqual({
        user_reward_days: 7,
        agent_commission_rate: 0.3,
        min_withdrawal_amount: 100,
        referee_discount_percent: 10,
      });
      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_config');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('key, value');
    });

    it('should return all defaults when data is null', async () => {
      mockSupabase.setResponse(null);

      const result = await repo.getAllConfig();

      expect(result).toEqual({
        user_reward_days: 7,
        agent_commission_rate: 0.2,
        min_withdrawal_amount: 50,
        referee_discount_percent: 10,
      });
    });

    it('should return all defaults when data is empty', async () => {
      mockSupabase.setQueryResponse([]);

      const result = await repo.getAllConfig();

      expect(result).toEqual({
        user_reward_days: 7,
        agent_commission_rate: 0.2,
        min_withdrawal_amount: 50,
        referee_discount_percent: 10,
      });
    });

    it('should handle numeric values directly', async () => {
      mockSupabase.setQueryResponse([{ key: 'user_reward_days', value: 14 }]);

      const result = await repo.getAllConfig();

      expect(result.user_reward_days).toBe(14);
    });

    it('should ignore unknown keys', async () => {
      mockSupabase.setQueryResponse([{ key: 'unknown_key', value: '999' }]);

      const result = await repo.getAllConfig();

      expect(result).toEqual({
        user_reward_days: 7,
        agent_commission_rate: 0.2,
        min_withdrawal_amount: 50,
        referee_discount_percent: 10,
      });
    });

    it('should throw DatabaseError on fetch failure', async () => {
      mockSupabase.setErrorResponse(dbError('Fetch failed'));

      await expect(repo.getAllConfig()).rejects.toThrow(DatabaseError);
      await expect(repo.getAllConfig()).rejects.toThrow('Failed to fetch referral config');
    });
  });

  // ── updateConfig ──

  describe('updateConfig', () => {
    it('should upsert a config value', async () => {
      mockSupabase.setResponse(null);

      await repo.updateConfig('agent_commission_rate', 0.35);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('referral_config');
      expect(mockSupabase.client._chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'agent_commission_rate',
          value: 0.35,
        }),
        { onConflict: 'key' },
      );
    });

    it('should throw DatabaseError on upsert failure', async () => {
      mockSupabase.setErrorResponse(dbError('Upsert failed'));

      await expect(repo.updateConfig('agent_commission_rate', 0.35)).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.updateConfig('agent_commission_rate', 0.35)).rejects.toThrow(
        'Failed to update referral config',
      );
    });
  });
});
