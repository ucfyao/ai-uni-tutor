import { getProfileRepository } from '@/lib/repositories';

async function checkSupabase(): Promise<boolean> {
  try {
    // Use repository layer for DB health check
    const profile = await getProfileRepository().findById('00000000-0000-0000-0000-000000000000');
    // findById returns null for non-existent IDs — that's fine, it means DB is reachable
    void profile;
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks = await Promise.allSettled([checkSupabase()]);

  const supabaseOk = checks[0].status === 'fulfilled' && checks[0].value;

  const status = supabaseOk ? 'healthy' : 'degraded';

  return Response.json(
    { status },
    {
      status: supabaseOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
  );
}
