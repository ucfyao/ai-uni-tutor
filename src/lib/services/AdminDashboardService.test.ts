import { beforeEach, describe, expect, it, vi } from 'vitest';
// ---------------------------------------------------------------------------
// Import service (after mocks)
// ---------------------------------------------------------------------------

import { AdminDashboardService, getAdminDashboardService } from './AdminDashboardService';

// ---------------------------------------------------------------------------
// Mocks — declared before import so vi.mock hoisting works
// ---------------------------------------------------------------------------

const mockStripe = {
  balance: { retrieve: vi.fn() },
  subscriptions: { search: vi.fn() },
  balanceTransactions: { list: vi.fn() },
};

vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockStripe,
}));

const mockGetModelStats = vi.fn();
const mockRedisKeys = vi.fn();

vi.mock('@/lib/redis', () => ({
  getModelStats: (...args: unknown[]) => mockGetModelStats(...args),
  getRedis: () => ({ keys: mockRedisKeys }),
}));

vi.mock('@/lib/gemini', () => ({
  GEMINI_MODELS: {
    chat: 'gemini-2.5-flash',
    parse: 'gemini-2.0-flash',
    embedding: 'gemini-embedding-001',
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminDashboardService();
  });

  // ==================== fetchStripeData ====================

  describe('fetchStripeData', () => {
    it('should return balance, subscriptions count, and monthly revenue', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 50000, currency: 'usd' }],
        pending: [{ amount: 12000, currency: 'usd' }],
      });
      mockStripe.subscriptions.search.mockResolvedValue({
        total_count: 42,
      });
      mockStripe.balanceTransactions.list.mockResolvedValue({
        data: [{ amount: 2000 }, { amount: 3000 }, { amount: 5000 }],
      });

      const result = await service.fetchStripeData();

      expect(result).toEqual({
        available: 50000,
        pending: 12000,
        currency: 'usd',
        activeSubscriptions: 42,
        monthlyRevenue: 10000,
      });
    });

    it('should handle empty balance arrays gracefully', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [],
        pending: [],
      });
      mockStripe.subscriptions.search.mockResolvedValue({
        total_count: 0,
      });
      mockStripe.balanceTransactions.list.mockResolvedValue({
        data: [],
      });

      const result = await service.fetchStripeData();

      expect(result).toEqual({
        available: 0,
        pending: 0,
        currency: 'usd',
        activeSubscriptions: 0,
        monthlyRevenue: 0,
      });
    });

    it('should return error object on Stripe failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockStripe.balance.retrieve.mockRejectedValue(new Error('Stripe down'));

      const result = await service.fetchStripeData();

      expect(result).toEqual({ error: 'Failed to fetch Stripe data' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdminDashboard] Stripe fetch failed:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // ==================== fetchUpstashData ====================

  describe('fetchUpstashData', () => {
    it('should return stats and limits when env vars are set and API responds', async () => {
      vi.stubEnv('UPSTASH_MGMT_EMAIL', 'admin@test.com');
      vi.stubEnv('UPSTASH_MGMT_API_KEY', 'mgmt-key-123');
      vi.stubEnv('UPSTASH_DATABASE_ID', 'db-id-456');

      const mockStatsResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          total_monthly_requests: 150000,
          daily_net_commands: 2000,
          total_monthly_bandwidth: 500000,
          current_storage: 1024,
          total_monthly_billing: 0,
        }),
      };
      const mockDbResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          db_request_limit: 500000,
          db_monthly_bandwidth_limit: 50,
          db_disk_threshold: 268435456,
          db_max_commands_per_second: 10000,
          type: 'free',
        }),
      };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation((url: string) =>
            Promise.resolve(url.includes('/stats/') ? mockStatsResponse : mockDbResponse),
          ),
      );

      const result = await service.fetchUpstashData();

      expect(result).toEqual({
        monthlyRequests: 150000,
        monthlyRequestsLimit: 500000,
        dailyCommands: 2000,
        monthlyBandwidth: 500000,
        monthlyBandwidthLimit: 50 * 1024 * 1024 * 1024,
        currentStorage: 1024,
        storageLimit: 268435456,
        monthlyBilling: 0,
        maxCommandsPerSecond: 10000,
        plan: 'free',
      });

      vi.unstubAllGlobals();
    });

    it('should return error when env vars are missing', async () => {
      // Ensure env vars are NOT set
      delete process.env.UPSTASH_MGMT_EMAIL;
      delete process.env.UPSTASH_MGMT_API_KEY;
      delete process.env.UPSTASH_DATABASE_ID;

      const result = await service.fetchUpstashData();

      expect(result).toEqual({ error: 'Missing Upstash management env vars' });
    });

    it('should return error when API returns non-200', async () => {
      vi.stubEnv('UPSTASH_MGMT_EMAIL', 'admin@test.com');
      vi.stubEnv('UPSTASH_MGMT_API_KEY', 'mgmt-key-123');
      vi.stubEnv('UPSTASH_DATABASE_ID', 'db-id-456');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

      const result = await service.fetchUpstashData();

      expect(result).toEqual({ error: 'Upstash stats API returned 403' });

      vi.unstubAllGlobals();
    });

    it('should return error on fetch failure', async () => {
      vi.stubEnv('UPSTASH_MGMT_EMAIL', 'admin@test.com');
      vi.stubEnv('UPSTASH_MGMT_API_KEY', 'mgmt-key-123');
      vi.stubEnv('UPSTASH_DATABASE_ID', 'db-id-456');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await service.fetchUpstashData();

      expect(result).toEqual({ error: 'Failed to fetch Upstash data' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdminDashboard] Upstash fetch failed:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  // ==================== fetchGeminiData ====================

  describe('fetchGeminiData', () => {
    it('should return per-model stats and active users', async () => {
      mockGetModelStats.mockImplementation(async (model: string) => {
        const stats: Record<string, { today: number; monthly: number }> = {
          'gemini-2.5-flash': { today: 100, monthly: 3000 },
          'gemini-2.0-flash': { today: 50, monthly: 1500 },
          'gemini-embedding-001': { today: 200, monthly: 6000 },
        };
        return stats[model] ?? { today: 0, monthly: 0 };
      });

      mockRedisKeys.mockResolvedValue([
        'usage:llm:user-1:2026-02-21',
        'usage:llm:user-2:2026-02-21',
        'usage:llm:user-3:2026-02-21',
      ]);

      const result = await service.fetchGeminiData();

      expect(result).not.toHaveProperty('error');

      // Type narrow after error check
      const data = result as Exclude<typeof result, { error: string }>;

      expect(data.models).toHaveLength(3);
      expect(data.models[0]).toEqual({
        name: 'gemini-2.5-flash',
        label: 'Chat',
        today: 100,
        monthly: 3000,
      });
      expect(data.models[1]).toEqual({
        name: 'gemini-2.0-flash',
        label: 'Parse',
        today: 50,
        monthly: 1500,
      });
      expect(data.models[2]).toEqual({
        name: 'gemini-embedding-001',
        label: 'Embedding',
        today: 200,
        monthly: 6000,
      });
      expect(data.totalToday).toBe(350);
      expect(data.totalMonthly).toBe(10500);
      expect(data.activeUsersToday).toBe(3);
    });

    it('should return error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetModelStats.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.fetchGeminiData();

      expect(result).toEqual({ error: 'Failed to fetch Gemini data' });
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdminDashboard] Gemini fetch failed:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // ==================== fetchAll ====================

  describe('fetchAll', () => {
    it('should return all three services in parallel', async () => {
      // Stripe
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ amount: 10000, currency: 'usd' }],
        pending: [{ amount: 5000, currency: 'usd' }],
      });
      mockStripe.subscriptions.search.mockResolvedValue({ total_count: 10 });
      mockStripe.balanceTransactions.list.mockResolvedValue({
        data: [{ amount: 1000 }],
      });

      // Upstash
      vi.stubEnv('UPSTASH_MGMT_EMAIL', 'admin@test.com');
      vi.stubEnv('UPSTASH_MGMT_API_KEY', 'mgmt-key-123');
      vi.stubEnv('UPSTASH_DATABASE_ID', 'db-id-456');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            total_monthly_requests: 1000,
            daily_net_commands: 100,
            total_monthly_bandwidth: 2000,
            current_storage: 512,
            total_monthly_billing: 500,
            db_request_limit: 500000,
            db_monthly_bandwidth_limit: 50,
            db_disk_threshold: 268435456,
            db_max_commands_per_second: 10000,
            type: 'free',
          }),
        }),
      );

      // Gemini
      mockGetModelStats.mockResolvedValue({ today: 10, monthly: 100 });
      mockRedisKeys.mockResolvedValue(['usage:llm:user-1:2026-02-21']);

      const result = await service.fetchAll();

      expect(result).toHaveProperty('stripe');
      expect(result).toHaveProperty('upstash');
      expect(result).toHaveProperty('gemini');
      expect(result).toHaveProperty('fetchedAt');

      // Verify stripe data
      expect(result.stripe).toEqual({
        available: 10000,
        pending: 5000,
        currency: 'usd',
        activeSubscriptions: 10,
        monthlyRevenue: 1000,
      });

      // Verify upstash data
      expect(result.upstash).toEqual({
        monthlyRequests: 1000,
        monthlyRequestsLimit: 500000,
        dailyCommands: 100,
        monthlyBandwidth: 2000,
        monthlyBandwidthLimit: 50 * 1024 * 1024 * 1024,
        currentStorage: 512,
        storageLimit: 268435456,
        monthlyBilling: 500,
        maxCommandsPerSecond: 10000,
        plan: 'free',
      });

      // Verify gemini data (3 models x 10 each)
      const gemini = result.gemini as Exclude<typeof result.gemini, { error: string }>;
      expect(gemini.models).toHaveLength(3);
      expect(gemini.totalToday).toBe(30);
      expect(gemini.totalMonthly).toBe(300);
      expect(gemini.activeUsersToday).toBe(1);

      // Verify ISO timestamp
      expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      vi.unstubAllGlobals();
    });

    it('should return error for failing service while others succeed', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Stripe fails
      mockStripe.balance.retrieve.mockRejectedValue(new Error('Stripe down'));

      // Upstash missing env vars
      delete process.env.UPSTASH_MGMT_EMAIL;
      delete process.env.UPSTASH_MGMT_API_KEY;
      delete process.env.UPSTASH_DATABASE_ID;

      // Gemini succeeds
      mockGetModelStats.mockResolvedValue({ today: 5, monthly: 50 });
      mockRedisKeys.mockResolvedValue([]);

      const result = await service.fetchAll();

      // Stripe failed
      expect(result.stripe).toEqual({ error: 'Failed to fetch Stripe data' });

      // Upstash failed (missing env)
      expect(result.upstash).toEqual({ error: 'Missing Upstash management env vars' });

      // Gemini succeeded
      const gemini = result.gemini as Exclude<typeof result.gemini, { error: string }>;
      expect(gemini.models).toHaveLength(3);
      expect(gemini.totalToday).toBe(15);
      expect(gemini.activeUsersToday).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  // ==================== Singleton ====================

  describe('getAdminDashboardService', () => {
    it('should return the same instance on subsequent calls', () => {
      const a = getAdminDashboardService();
      const b = getAdminDashboardService();
      expect(a).toBe(b);
    });

    it('should return an AdminDashboardService instance', () => {
      const svc = getAdminDashboardService();
      expect(svc).toBeInstanceOf(AdminDashboardService);
    });
  });
});
