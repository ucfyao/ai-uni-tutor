import { getExamPaperService } from '@/lib/services/ExamPaperService';
import { sendGeminiError, type PipelineContext } from './types';

export async function handleExamPipeline(ctx: PipelineContext): Promise<void> {
  const { send, signal, documentId, pages, hasAnswers } = ctx;
  const examService = getExamPaperService();

  // ── Question extraction via LLM ──
  send('status', { stage: 'extracting', message: 'AI extracting content...' });

  let items: Array<{
    type: 'question';
    data: import('@/lib/rag/parsers/types').ParsedQuestion;
  }>;

  try {
    const onBatchProgress = (current: number, total: number) => {
      send('progress', { current, total });
    };
    const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
    const questions = await parseQuestions(pages, hasAnswers, onBatchProgress);
    items = questions.map((q) => ({ type: 'question' as const, data: q }));
  } catch (e) {
    sendGeminiError(send, e, 'extraction');
    return;
  }

  if (items.length === 0) {
    send('progress', { current: 0, total: 0 });
    send('status', { stage: 'complete', message: 'No content extracted' });
    return;
  }

  // ── Content-based dedup + save ──
  send('status', { stage: 'embedding', message: 'Saving questions...' });

  const existingQuestions = await examService.getQuestionsByPaperId(documentId);
  const existingContents = new Set(existingQuestions.map((q) => q.content.trim().toLowerCase()));
  const maxOrderNum =
    existingQuestions.length > 0 ? Math.max(...existingQuestions.map((q) => q.orderNum)) : 0;

  const newItems = items.filter((item) => {
    const q = item.data;
    return !existingContents.has(q.content.trim().toLowerCase());
  });

  if (newItems.length === 0) {
    send('status', {
      stage: 'complete',
      message: 'No new questions to add (all duplicates).',
    });
    return;
  }

  for (let i = 0; i < newItems.length; i++) {
    send('item', { index: i, type: newItems[i].type, data: newItems[i].data });
    send('progress', { current: i + 1, total: newItems.length });
  }

  const questions = newItems.map((item, idx) => {
    const q = item.data;
    return {
      paperId: documentId,
      orderNum: maxOrderNum + idx + 1,
      type: '',
      content: q.content,
      options: q.options
        ? Object.fromEntries(q.options.map((opt, j) => [String.fromCharCode(65 + j), opt]))
        : null,
      answer: q.referenceAnswer || '',
      explanation: '',
      points: q.score || 0,
      metadata: { sourcePage: q.sourcePage },
    };
  });

  await examService.insertQuestions(questions);
  send('batch_saved', { chunkIds: questions.map((_, i) => `q-${i}`), batchIndex: 0 });

  if (signal.aborted) return;

  const questionTypes = [...new Set(questions.map((q) => q.type).filter(Boolean))];
  if (questionTypes.length > 0) {
    await examService.updatePaperMeta(documentId, { questionTypes });
  }

  send('status', { stage: 'complete', message: 'Done!' });
}
