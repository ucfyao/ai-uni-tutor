import { GEMINI_MODELS } from '@/lib/gemini';
import { getModelStats, getRedis } from '@/lib/redis';
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
  monthlyBandwidth: number;
  currentStorage: number;
  monthlyBilling: number;
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

      const res = await fetch(`https://api.upstash.com/v2/redis/stats/${dbId}`, {
        headers: {
          Authorization: `Basic ${btoa(`${email}:${apiKey}`)}`,
        },
      });

      if (!res.ok) {
        return { error: `Upstash API returned ${res.status}` };
      }

      const data = await res.json();

      return {
        monthlyRequests: data.total_monthly_requests ?? 0,
        monthlyBandwidth: data.total_monthly_bandwidth ?? 0,
        currentStorage: data.current_storage ?? 0,
        monthlyBilling: data.total_monthly_billing ?? 0,
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
