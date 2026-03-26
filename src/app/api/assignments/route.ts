import { NextResponse } from 'next/server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const statusParam = searchParams.get('status') || 'ready';
  const status = (statusParam === 'draft' || statusParam === 'ready' ? statusParam : 'ready') as
    | 'draft'
    | 'ready';

  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase
    .from('assignments')
    .select('id, title')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (status === 'ready') {
    query = query.eq('status', 'ready');
  } else {
    query = query.eq('status', 'draft');
  }

  const { data: assignments, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }

  return NextResponse.json({ assignments });
}
