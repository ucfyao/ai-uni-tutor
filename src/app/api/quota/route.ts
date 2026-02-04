import { NextResponse } from 'next/server';
import { getQuotaService } from '@/lib/services/QuotaService';

export async function GET() {
  try {
    const quotaService = getQuotaService();

    const [status, limits] = await Promise.all([
      quotaService.checkStatus(),
      Promise.resolve(quotaService.getSystemLimits()),
    ]);

    return NextResponse.json({ status, limits });
  } catch (error) {
    console.error('Failed to fetch quota status', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
