import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfileRepository } from '@/lib/repositories';
import { getAdminDashboardService } from '@/lib/services/AdminDashboardService';
import { getCurrentUser } from '@/lib/supabase/server';

const VALID_SERVICES = ['stripe', 'upstash', 'gemini', 'gemini-pool', 'llm-logs-preview'] as const;
type ServiceName = (typeof VALID_SERVICES)[number];

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' as const, status: 401 };

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') return { error: 'Forbidden' as const, status: 403 };

  return { user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service') as ServiceName | null;
    const svc = getAdminDashboardService();

    // Single service fetch
    if (service) {
      if (!VALID_SERVICES.includes(service)) {
        return NextResponse.json({ error: 'Invalid service' }, { status: 400 });
      }

      const fetchers: Record<ServiceName, () => Promise<unknown>> = {
        stripe: () => svc.fetchStripeData(),
        upstash: () => svc.fetchUpstashData(),
        gemini: () => svc.fetchGeminiData(),
        'gemini-pool': () => svc.fetchPoolStatus(),
        'llm-logs-preview': async () => {
          const { getLlmLogService } = await import('@/lib/services/LlmLogService');
          const llmSvc = getLlmLogService();
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const [logs, stats] = await Promise.all([
            llmSvc.getRecentLogs(20),
            llmSvc.getStats(today.toISOString()),
          ]);
          return { logs, stats };
        },
      };

      const data = await fetchers[service]();
      return NextResponse.json(data);
    }

    // All services (legacy / fallback)
    const data = await svc.fetchAll();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[AdminDashboard] Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const postSchema = z.object({ action: z.literal('reset-pool') });

export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = postSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const svc = getAdminDashboardService();
    const result = await svc.resetPoolCooldowns();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AdminDashboard] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
