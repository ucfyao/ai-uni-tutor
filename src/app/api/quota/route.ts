import { NextResponse } from 'next/server';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotaService = getQuotaService();

    const [status, limits] = await Promise.all([
      quotaService.checkStatus(user.id),
      Promise.resolve(quotaService.getSystemLimits()),
    ]);

    return NextResponse.json(
      { status, limits },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('Failed to fetch quota status', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
