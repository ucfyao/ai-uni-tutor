/**
 * Chat Feedback API Route
 *
 * POST /api/chat/feedback
 * Persists or removes 👍/👎 feedback on AI messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMessageFeedbackRepository } from '@/lib/repositories/MessageFeedbackRepository';
import { getCurrentUser } from '@/lib/supabase/server';

const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  feedbackType: z.enum(['up', 'down']).nullable(),
});

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse & validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { messageId, feedbackType } = parsed.data;
  const repo = getMessageFeedbackRepository();

  try {
    if (feedbackType === null) {
      // Toggle off — remove feedback
      await repo.delete(messageId, user.id);
    } else {
      // Upsert feedback
      await repo.upsert(messageId, user.id, feedbackType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}
