import { NextResponse } from 'next/server';
import { getAllConfiguredModels } from '@/lib/gemini';
import { getProfileRepository } from '@/lib/repositories';
import { getLlmLogService } from '@/lib/services/LlmLogService';
import { getCurrentUser } from '@/lib/supabase/server';

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
    const service = getLlmLogService();

    const mode = searchParams.get('mode');

    if (mode === 'preview') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [logs, stats] = await Promise.all([
        service.getRecentLogs(20),
        service.getStats(today.toISOString()),
      ]);
      return NextResponse.json({ logs, stats });
    }

    const callType = searchParams.get('callType') || undefined;
    const status = searchParams.get('status') || undefined;
    const model = searchParams.get('model') || undefined;
    const timeRange = searchParams.get('timeRange') || '24h';
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || 50;

    const now = new Date();
    const timeRangeMap: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const msAgo = timeRangeMap[timeRange] ?? timeRangeMap['24h'];
    const startTime = new Date(now.getTime() - msAgo).toISOString();

    const [result, stats] = await Promise.all([
      service.getLogs({ callType, status, model, startTime }, page, pageSize),
      service.getStats(startTime),
    ]);

    const models = getAllConfiguredModels();

    return NextResponse.json({
      logs: result.logs,
      total: result.total,
      stats,
      page,
      pageSize,
      models,
    });
  } catch (error) {
    console.error('[LlmLogs] Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
