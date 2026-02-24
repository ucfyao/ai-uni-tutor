/**
 * Admin Feedback API Route
 *
 * GET /api/admin/feedback
 * Returns aggregated feedback data for the admin dashboard.
 * Requires super_admin role.
 */

import { NextResponse } from 'next/server';
import { getProfileRepository } from '@/lib/repositories';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' as const, status: 401 };

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') return { error: 'Forbidden' as const, status: 403 };

  return { user };
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    // Fetch all feedback with message + session + user info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('message_feedback')
      .select(
        `
        id,
        message_id,
        user_id,
        feedback_type,
        created_at
      `,
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[AdminFeedback] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    // Collect unique message IDs and user IDs for enrichment
    const messageIds = [
      ...new Set((data || []).map((f: { message_id: string }) => f.message_id)),
    ] as string[];
    const userIds = [
      ...new Set((data || []).map((f: { user_id: string }) => f.user_id)),
    ] as string[];

    // Fetch messages (content + session_id)
    let messagesMap: Record<string, { content: string; role: string; session_id: string }> = {};
    if (messageIds.length > 0) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('id, content, role, session_id')
        .in('id', messageIds);
      if (messages) {
        messagesMap = Object.fromEntries(
          messages.map((m: { id: string; content: string; role: string; session_id: string }) => [
            m.id,
            { content: m.content, role: m.role, session_id: m.session_id },
          ]),
        );
      }
    }

    // Fetch user emails
    let usersMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      if (profiles) {
        usersMap = Object.fromEntries(
          profiles.map((p: { id: string; email: string | null }) => [p.id, p.email || p.id]),
        );
      }
    }

    // Enrich feedback items
    interface FeedbackRow {
      id: string;
      message_id: string;
      user_id: string;
      feedback_type: string;
      created_at: string;
    }

    const enriched = (data || []).map((f: FeedbackRow) => {
      const msg = messagesMap[f.message_id];
      return {
        id: f.id,
        feedbackType: f.feedback_type,
        createdAt: f.created_at,
        userEmail: usersMap[f.user_id] || f.user_id,
        messagePreview: msg ? msg.content.slice(0, 150) : '(deleted)',
        messageRole: msg?.role || 'unknown',
      };
    });

    // Summary stats
    const totalUp = (data || []).filter((f: FeedbackRow) => f.feedback_type === 'up').length;
    const totalDown = (data || []).filter((f: FeedbackRow) => f.feedback_type === 'down').length;

    return NextResponse.json({
      items: enriched,
      stats: {
        total: (data || []).length,
        thumbsUp: totalUp,
        thumbsDown: totalDown,
        satisfactionRate:
          totalUp + totalDown > 0 ? Math.round((totalUp / (totalUp + totalDown)) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('[AdminFeedback] Route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
