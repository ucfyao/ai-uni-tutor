export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getMockExamService } from '@/lib/services/MockExamService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { getCurrentUser } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { stream, send, close } = createSSEStream();

  const pipeline = (async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        send('error', { message: 'Unauthorized', code: 'AUTH' });
        close();
        return;
      }

      const body = await request.json();
      const { mockId, topic, numQuestions, difficulty, questionTypes, mode } = body;

      if (!mockId || !topic || !numQuestions) {
        send('error', { message: 'Missing required fields', code: 'VALIDATION' });
        close();
        return;
      }

      await getQuotaService().enforce(user.id);

      send('exam_progress', {
        current: 0,
        total: numQuestions,
        message: `Starting generation...`,
      });

      const service = getMockExamService();
      await service.generateQuestionsFromTopic(
        user.id,
        mockId,
        { topic, numQuestions, difficulty: difficulty ?? 'mixed', questionTypes: questionTypes ?? [], mode },
      );

      send('exam_progress', {
        current: numQuestions,
        total: numQuestions,
        message: 'Complete',
      });
      send('exam_complete', { mockId });
    } catch (err) {
      send('error', {
        message: err instanceof Error ? err.message : 'Generation failed',
        code: 'GENERATION_ERROR',
      });
    } finally {
      close();
    }
  })();

  void pipeline;

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
