/**
 * ProfileRepository Tests
 *
 * Tests all profile-related database operations including
 * entity mapping (dto -> snake_case), subscription info logic,
 * and error handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freeUser, freeUserRow, proUser, proUserRow } from '@/__tests__/fixtures/users';
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
const { ProfileRepository } = await import('./ProfileRepository');

describe('ProfileRepository', () => {
  let repo: InstanceType<typeof ProfileRepository>;

  beforeEach(() => {
    repo = new ProfileRepository();
    mockSupabase.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── findById ──

  describe('findById', () => {
    it('should return a profile entity when found', async () => {
      mockSupabase.setSingleResponse(freeUserRow);

      const result = await repo.findById('user-free-001');

      expect(result).toEqual(freeUser);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'user-free-001');
      expect(mockSupabase.client._chain.single).toHaveBeenCalled();
    });

    it('should return null when profile not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.findById('user-free-001');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Connection error'));

      await expect(repo.findById('user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.findById('user-free-001')).rejects.toThrow('Failed to fetch profile');
    });

    it('should map pro user row with currentPeriodEnd date', async () => {
      mockSupabase.setSingleResponse(proUserRow);

      const result = await repo.findById('user-pro-001');

      expect(result).toEqual(proUser);
      expect(result!.currentPeriodEnd).toEqual(new Date('2026-12-31T23:59:59Z'));
      expect(result!.stripeCustomerId).toBe('cus_pro_001');
    });
  });

  // ── update ──

  describe('update', () => {
    it('should update fullName with snake_case mapping', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', { fullName: 'New Name' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'New Name',
          updated_at: expect.any(String),
        }),
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'user-free-001');
    });

    it('should map stripeCustomerId to stripe_customer_id', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', { stripeCustomerId: 'cus_123' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_customer_id: 'cus_123',
        }),
      );
    });

    it('should map stripeSubscriptionId to stripe_subscription_id', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', { stripeSubscriptionId: 'sub_123' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_subscription_id: 'sub_123',
        }),
      );
    });

    it('should map stripePriceId to stripe_price_id', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', { stripePriceId: 'price_123' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_price_id: 'price_123',
        }),
      );
    });

    it('should map subscriptionStatus to subscription_status', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', { subscriptionStatus: 'active' });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'active',
        }),
      );
    });

    it('should map currentPeriodEnd to current_period_end ISO string', async () => {
      mockSupabase.setResponse(null);
      const endDate = new Date('2026-12-31T23:59:59Z');

      await repo.update('user-free-001', { currentPeriodEnd: endDate });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          current_period_end: endDate.toISOString(),
        }),
      );
    });

    it('should always include updated_at', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', {});

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          updated_at: expect.any(String),
        }),
      );
    });

    it('should handle multiple fields at once', async () => {
      mockSupabase.setResponse(null);

      await repo.update('user-free-001', {
        fullName: 'Updated Name',
        stripeCustomerId: 'cus_new',
        subscriptionStatus: 'active',
      });

      expect(mockSupabase.client._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Updated Name',
          stripe_customer_id: 'cus_new',
          subscription_status: 'active',
          updated_at: expect.any(String),
        }),
      );
    });

    it('should throw DatabaseError on update failure', async () => {
      mockSupabase.setErrorResponse(dbError('Update failed'));

      await expect(repo.update('user-free-001', { fullName: 'Test' })).rejects.toThrow(
        DatabaseError,
      );
      await expect(repo.update('user-free-001', { fullName: 'Test' })).rejects.toThrow(
        'Failed to update profile',
      );
    });
  });

  // ── getSubscriptionInfo ──

  describe('getSubscriptionInfo', () => {
    it('should return isPro=true for active subscription', async () => {
      mockSupabase.setSingleResponse({
        subscription_status: 'active',
        current_period_end: '2026-12-31T23:59:59Z',
      });

      const result = await repo.getSubscriptionInfo('user-pro-001');

      expect(result).toEqual({
        status: 'active',
        isPro: true,
        currentPeriodEnd: new Date('2026-12-31T23:59:59Z'),
      });
    });

    it('should return isPro=true for trialing subscription', async () => {
      mockSupabase.setSingleResponse({
        subscription_status: 'trialing',
        current_period_end: '2026-12-31T23:59:59Z',
      });

      const result = await repo.getSubscriptionInfo('user-pro-001');

      expect(result).toEqual({
        status: 'trialing',
        isPro: true,
        currentPeriodEnd: new Date('2026-12-31T23:59:59Z'),
      });
    });

    it('should return isPro=false for inactive subscription', async () => {
      mockSupabase.setSingleResponse({
        subscription_status: 'inactive',
        current_period_end: null,
      });

      const result = await repo.getSubscriptionInfo('user-free-001');

      expect(result).toEqual({
        status: 'inactive',
        isPro: false,
        currentPeriodEnd: null,
      });
    });

    it('should return isPro=false for canceled subscription', async () => {
      mockSupabase.setSingleResponse({
        subscription_status: 'canceled',
        current_period_end: '2025-06-01T00:00:00Z',
      });

      const result = await repo.getSubscriptionInfo('user-free-001');

      expect(result).toEqual({
        status: 'canceled',
        isPro: false,
        currentPeriodEnd: new Date('2025-06-01T00:00:00Z'),
      });
    });

    it('should return default info when profile not found (PGRST116)', async () => {
      mockSupabase.setErrorResponse(PGRST116);

      const result = await repo.getSubscriptionInfo('nonexistent');

      expect(result).toEqual({
        status: null,
        isPro: false,
        currentPeriodEnd: null,
      });
    });

    it('should return default info when data is null', async () => {
      mockSupabase.setSingleResponse(null);

      const result = await repo.getSubscriptionInfo('user-free-001');

      expect(result).toEqual({
        status: null,
        isPro: false,
        currentPeriodEnd: null,
      });
    });

    it('should throw DatabaseError on other errors', async () => {
      mockSupabase.setErrorResponse(dbError('Server error'));

      await expect(repo.getSubscriptionInfo('user-free-001')).rejects.toThrow(DatabaseError);
      await expect(repo.getSubscriptionInfo('user-free-001')).rejects.toThrow(
        'Failed to fetch subscription info',
      );
    });

    it('should query only subscription fields', async () => {
      mockSupabase.setSingleResponse({
        subscription_status: 'active',
        current_period_end: null,
      });

      await repo.getSubscriptionInfo('user-pro-001');

      expect(mockSupabase.client.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase.client._chain.select).toHaveBeenCalledWith(
        'subscription_status, current_period_end',
      );
      expect(mockSupabase.client._chain.eq).toHaveBeenCalledWith('id', 'user-pro-001');
    });
  });

  // ── Entity mapping ──

  describe('entity mapping', () => {
    it('should convert snake_case row to camelCase entity', async () => {
      mockSupabase.setSingleResponse(freeUserRow);

      const result = await repo.findById('user-free-001');

      expect(result).not.toBeNull();
      expect(result!.fullName).toBe(freeUserRow.full_name);
      expect(result!.stripeCustomerId).toBe(freeUserRow.stripe_customer_id);
      expect(result!.stripeSubscriptionId).toBe(freeUserRow.stripe_subscription_id);
      expect(result!.stripePriceId).toBe(freeUserRow.stripe_price_id);
      expect(result!.subscriptionStatus).toBe(freeUserRow.subscription_status);
      expect(result!.currentPeriodEnd).toBeNull();
      expect(result!.createdAt).toEqual(new Date(freeUserRow.created_at));
      expect(result!.updatedAt).toEqual(new Date(freeUserRow.updated_at));
    });
  });
});
