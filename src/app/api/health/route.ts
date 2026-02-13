import { createClient } from '@/lib/supabase/server';

async function checkSupabase(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function GET() {
  const checks = await Promise.allSettled([checkSupabase()]);

  const supabaseOk = checks[0].status === 'fulfilled' && checks[0].value;

  const status = supabaseOk ? 'healthy' : 'degraded';

  return Response.json({ status }, { status: supabaseOk ? 200 : 503 });
}
