import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { getLlmLogService } from '@/lib/services/LlmLogService';
import { getQuotaService, type QuotaResponse } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const quotaService = getQuotaService();
    const llmLogService = getLlmLogService();

    const [status, limits, breakdown] = await Promise.all([
      quotaService.checkStatus(user.id),
      Promise.resolve(quotaService.getSystemLimits()),
      llmLogService.getUserTodayBreakdown(user.id).catch(() => null),
    ]);

    // Reset time: next midnight UTC
    const now = new Date();
    const resetAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    ).toISOString();

    const body: QuotaResponse = { status, limits, breakdown, resetAt };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Failed to fetch quota status', error);
    return apiError('Internal server error', 500);
  }
}
