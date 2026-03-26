import { NextResponse } from 'next/server';

import { createClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .order('code');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }

  return NextResponse.json({ courses });
}
