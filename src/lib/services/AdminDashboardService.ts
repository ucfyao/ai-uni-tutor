import {
  GEMINI_FREE_TIER_QUOTA,
  GEMINI_MODELS,
  GEMINI_QUOTA_DASHBOARD_URL,
  resetPoolEntry as geminiResetPoolEntry,
  getPoolStatusInfo,
} from '@/lib/gemini';
import type { ModelQuota, PoolStatusResponse } from '@/lib/gemini';
import {
  getModelStats,
  getRedis,
  resetPoolCooldowns as redisResetPoolCooldowns,
} from '@/lib/redis';
import { getStripe } from '@/lib/stripe';

interface StripeData {
  available: number;
  pending: number;
  currency: string;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

interface UpstashData {
  monthlyRequests: number;
  monthlyRequestsLimit: number;
  dailyCommands: number;
  monthlyBandwidth: number;
  monthlyBandwidthLimit: number;
  currentStorage: number;
  storageLimit: number;
  monthlyBilling: number;
  maxCommandsPerSecond: number;
  plan: string;
}

interface GeminiModelData {
  name: string;
  label: string;
  today: number;
  monthly: number;
}

interface GeminiData {
  models: GeminiModelData[];
  totalToday: number;
  totalMonthly: number;
  activeUsersToday: number;
}

export interface GeminiQuotaEntry {
  displayName: string;
  modelId: string;
  rpm: number;
  tpm: number;
  rpd: number;
  todayUsage: number;
  monthlyUsage: number;
  inUse: boolean;
}

export interface GeminiQuotaData {
  models: GeminiQuotaEntry[];
  totalToday: number;
  totalMonthly: number;
  activeUsersToday: number;
  dashboardUrl: string;
  lastUpdated: string;
}

type ServiceResult<T> = T | { error: string };

export class AdminDashboardService {
  async fetchStripeData(): Promise<ServiceResult<StripeData>> {
    try {
      const stripe = getStripe();

      const [balance, subscriptions, transactions] = await Promise.all([
        stripe.balance.retrieve(),
        stripe.subscriptions.search({
          query: "status:'active'",
          limit: 1,
        }),
        stripe.balanceTransactions.list({
          type: 'charge',
          created: { gte: this.getMonthStart() },
          limit: 100,
        }),
      ]);

      const available = balance.available[0]?.amount ?? 0;
      const pending = balance.pending[0]?.amount ?? 0;
      const currency = balance.available[0]?.currency ?? 'usd';
      const monthlyRevenue = transactions.data.reduce((sum, t) => sum + t.amount, 0);

      return {
        available,
        pending,
        currency,
        activeSubscriptions: subscriptions.total_count ?? 0,
        monthlyRevenue,
      };
    } catch (error) {
      console.error('[AdminDashboard] Stripe fetch failed:', error);
      return { error: 'Failed to fetch Stripe data' };
    }
  }

  async fetchUpstashData(): Promise<ServiceResult<UpstashData>> {
    try {
      const email = process.env.UPSTASH_MGMT_EMAIL;
      const apiKey = process.env.UPSTASH_MGMT_API_KEY;
      const dbId = process.env.UPSTASH_DATABASE_ID;

      if (!email || !apiKey || !dbId) {
        return { error: 'Missing Upstash management env vars' };
      }

      const headers = {
        Authorization: `Basic ${btoa(`${email}:${apiKey}`)}`,
      };

      const [statsRes, dbRes] = await Promise.all([
        fetch(`https://api.upstash.com/v2/redis/stats/${dbId}`, { headers }),
        fetch(`https://api.upstash.com/v2/redis/database/${dbId}`, { headers }),
      ]);

      if (!statsRes.ok) {
        return { error: `Upstash stats API returned ${statsRes.status}` };
      }
      if (!dbRes.ok) {
        return { error: `Upstash database API returned ${dbRes.status}` };
      }

      const [stats, db] = await Promise.all([statsRes.json(), dbRes.json()]);

      return {
        monthlyRequests: stats.total_monthly_requests ?? 0,
        monthlyRequestsLimit: db.db_request_limit ?? 0,
        dailyCommands: stats.daily_net_commands ?? 0,
        monthlyBandwidth: stats.total_monthly_bandwidth ?? 0,
        monthlyBandwidthLimit: (db.db_monthly_bandwidth_limit ?? 0) * 1024 * 1024 * 1024, // GB → bytes
        currentStorage: stats.current_storage ?? 0,
        storageLimit: db.db_disk_threshold ?? 0,
        monthlyBilling: stats.total_monthly_billing ?? 0,
        maxCommandsPerSecond: db.db_max_commands_per_second ?? 0,
        plan: db.type ?? 'unknown',
      };
    } catch (error) {
      console.error('[AdminDashboard] Upstash fetch failed:', error);
      return { error: 'Failed to fetch Upstash data' };
    }
  }

  async fetchGeminiData(): Promise<ServiceResult<GeminiData>> {
    try {
      const modelConfigs: { key: keyof typeof GEMINI_MODELS; label: string }[] = [
        { key: 'chat', label: 'Chat' },
        { key: 'parse', label: 'Parse' },
        { key: 'embedding', label: 'Embedding' },
      ];

      const modelStats = await Promise.all(
        modelConfigs.map(async ({ key, label }) => {
          const name = GEMINI_MODELS[key];
          const stats = await getModelStats(name);
          return { name, label, today: stats.today, monthly: stats.monthly };
        }),
      );

      // Count active users today by scanning usage keys
      const today = new Date().toISOString().split('T')[0];
      const r = getRedis();
      const userKeys = await r.keys(`usage:llm:*:${today}`);

      return {
        models: modelStats,
        totalToday: modelStats.reduce((sum, m) => sum + m.today, 0),
        totalMonthly: modelStats.reduce((sum, m) => sum + m.monthly, 0),
        activeUsersToday: userKeys.length,
      };
    } catch (error) {
      console.error('[AdminDashboard] Gemini fetch failed:', error);
      return { error: 'Failed to fetch Gemini data' };
    }
  }

  async fetchPoolStatus(): Promise<PoolStatusResponse | { error: string }> {
    try {
      return await getPoolStatusInfo();
    } catch (error) {
      console.error('[AdminDashboard] Pool status fetch failed:', error);
      return { error: 'Failed to fetch pool status' };
    }
  }

  async resetPoolCooldowns(): Promise<{ success: boolean } | { error: string }> {
    try {
      await redisResetPoolCooldowns();
      return { success: true };
    } catch (error) {
      console.error('[AdminDashboard] Pool reset failed:', error);
      return { error: 'Failed to reset pool cooldowns' };
    }
  }

  async resetPoolEntry(
    pool: 'default' | 'chat',
    entryId: number,
  ): Promise<{ success: boolean } | { error: string }> {
    try {
      await geminiResetPoolEntry(pool, entryId);
      return { success: true };
    } catch (error) {
      console.error('[AdminDashboard] Pool entry reset failed:', error);
      return { error: 'Failed to reset pool entry' };
    }
  }

  async fetchGeminiQuota(): Promise<ServiceResult<GeminiQuotaData>> {
    try {
      // Collect all model IDs actually configured in pools
      const configuredModels = new Set<string>(Object.values(GEMINI_MODELS));
      const chatVars = Object.entries(process.env).filter(([k]) => /^AI_CHAT_\d+$/.test(k));
      for (const [, value] of chatVars) {
        if (!value) continue;
        const firstColon = value.indexOf(':');
        const secondColon = value.indexOf(':', firstColon + 1);
        if (firstColon !== -1 && secondColon !== -1) {
          configuredModels.add(value.slice(firstColon + 1, secondColon).trim());
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const r = getRedis();

      const [models, userKeys] = await Promise.all([
        Promise.all(
          GEMINI_FREE_TIER_QUOTA.map(async (q: ModelQuota) => {
            const stats = await getModelStats(q.modelId);
            return {
              ...q,
              todayUsage: stats.today,
              monthlyUsage: stats.monthly,
              inUse: configuredModels.has(q.modelId),
            };
          }),
        ),
        r.keys(`usage:llm:*:${today}`),
      ]);

      return {
        models,
        totalToday: models.reduce((sum, m) => sum + m.todayUsage, 0),
        totalMonthly: models.reduce((sum, m) => sum + m.monthlyUsage, 0),
        activeUsersToday: userKeys.length,
        dashboardUrl: GEMINI_QUOTA_DASHBOARD_URL,
        lastUpdated: '2026-03-18',
      };
    } catch (error) {
      console.error('[AdminDashboard] Gemini quota fetch failed:', error);
      return { error: 'Failed to fetch Gemini quota data' };
    }
  }

  async fetchAll() {
    const [stripe, upstash, gemini] = await Promise.all([
      this.fetchStripeData(),
      this.fetchUpstashData(),
      this.fetchGeminiData(),
    ]);

    return {
      stripe,
      upstash,
      gemini,
      fetchedAt: new Date().toISOString(),
    };
  }

  private getMonthStart(): number {
    const now = new Date();
    return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  }
}

// Singleton instance
let _service: AdminDashboardService | null = null;

export function getAdminDashboardService(): AdminDashboardService {
  if (!_service) _service = new AdminDashboardService();
  return _service;
}
