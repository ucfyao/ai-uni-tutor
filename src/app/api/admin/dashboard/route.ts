import { NextResponse } from 'next/server';
import { getProfileRepository } from '@/lib/repositories';
import { getAdminDashboardService } from '@/lib/services/AdminDashboardService';
import { getCurrentUser } from '@/lib/supabase/server';

const VALID_SERVICES = ['stripe', 'upstash', 'gemini'] as const;
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
