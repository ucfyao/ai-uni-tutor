import { NextResponse } from 'next/server';
import { getProfileRepository } from '@/lib/repositories';
import { getAdminDashboardService } from '@/lib/services/AdminDashboardService';
import { getCurrentUser } from '@/lib/supabase/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileRepository().findById(user.id);
    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await getAdminDashboardService().fetchAll();

    return NextResponse.json(data);
  } catch (error) {
    console.error('[AdminDashboard] Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
