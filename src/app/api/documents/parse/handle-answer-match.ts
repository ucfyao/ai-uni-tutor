import type { AssignmentMetadata, AssignmentStats, ExamStats } from '@/lib/rag/parsers/types';
import { sendGeminiError, type PipelineContext } from './types';

/**
 * Normalize a question title for matching.
 * Strips common prefixes, lowercases, collapses whitespace, removes trailing punctuation.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/^(question|q|problem|prob|题|问题|第)\s*/i, '')
    .replace(/[.,:;。：，；)\s]+$/, '')
    .replace(/\s+/g, ' ');
}

/** Unified item shape for matching logic */
interface MatchableItem {
  id: string;
  orderNum: number;
  title: string;
  hasAnswer: boolean;
}

async function loadAssignmentItems(documentId: string): Promise<MatchableItem[]> {
  const { getAssignmentService } = await import('@/lib/services/AssignmentService');
  const items = await getAssignmentService().getItems(documentId);
  return items.map((item) => ({
    id: item.id,
    orderNum: item.orderNum,
    title: (item.metadata?.title as string) || item.content.substring(0, 50),
    hasAnswer: !!item.referenceAnswer?.trim(),
  }));
}

async function loadExamQuestions(documentId: string): Promise<MatchableItem[]> {
  const { getExamPaperService } = await import('@/lib/services/ExamPaperService');
  const questions = await getExamPaperService().getQuestionsByPaperId(documentId);
  return questions.map((q) => ({
    id: q.id,
    orderNum: q.orderNum,
    title: ((q.metadata as Record<string, unknown>)?.title as string) || q.content.substring(0, 50),
    hasAnswer: !!q.answer?.trim(),
  }));
}

async function saveAssignmentAnswers(
  _documentId: string,
  matches: Array<{ itemId: string; answer: string; explanation: string }>,
): Promise<void> {
  const { getAssignmentService } = await import('@/lib/services/AssignmentService');
  await getAssignmentService().batchUpdateAnswersWithExplanation(
    matches.map((m) => ({
      itemId: m.itemId,
      referenceAnswer: m.answer,
      explanation: m.explanation,
    })),
  );
}

async function saveExamAnswers(
  _documentId: string,
  matches: Array<{ itemId: string; answer: string; explanation: string }>,
): Promise<void> {
  const { getExamPaperService } = await import('@/lib/services/ExamPaperService');
  await getExamPaperService().batchUpdateAnswersWithExplanation(
    matches.map((m) => ({
      questionId: m.itemId,
      answer: m.answer,
      explanation: m.explanation,
    })),
  );
}

async function updateAssignmentStats(
  documentId: string,
  send: PipelineContext['send'],
): Promise<void> {
  const { getAssignmentService } = await import('@/lib/services/AssignmentService');
  const assignmentService = getAssignmentService();
  const allItems = await assignmentService.getItems(documentId);
  const stats: AssignmentStats = {
    itemCount: allItems.length,
    mainCount: 0,
    subCount: 0,
    withAnswer: 0,
    warningCount: 0,
  };
  for (const item of allItems) {
    if (item.parentItemId === null) stats.mainCount++;
    else stats.subCount++;
    if (item.referenceAnswer?.trim()) stats.withAnswer++;
    if (item.warnings && item.warnings.length > 0) stats.warningCount++;
  }
  const current = await assignmentService.findById(documentId);
  const updatedMetadata: AssignmentMetadata = {
    ...((current?.metadata as AssignmentMetadata) || {}),
    stats,
  };
  await assignmentService.updateMetadata(documentId, updatedMetadata);
  send('log', {
    message: `Stats: ${stats.withAnswer}/${stats.itemCount} have answers`,
    level: 'info',
  });
}

async function updateExamStats(documentId: string, send: PipelineContext['send']): Promise<void> {
  const { getExamPaperService } = await import('@/lib/services/ExamPaperService');
  const examService = getExamPaperService();
  const allItems = await examService.getQuestionsByPaperId(documentId);
  const stats: ExamStats = {
    itemCount: allItems.length,
    mainCount: 0,
    subCount: 0,
    withAnswer: 0,
    warningCount: 0,
  };
  for (const item of allItems) {
    if (item.parentQuestionId === null) stats.mainCount++;
    else stats.subCount++;
    if (item.answer?.trim()) stats.withAnswer++;
    const itemMeta = item.metadata as Record<string, unknown>;
    if (Array.isArray(itemMeta?.warnings) && itemMeta.warnings.length > 0) stats.warningCount++;
  }
  const currentPaper = await examService.findById(documentId);
  const currentMeta = (currentPaper?.metadata as Record<string, unknown>) || {};
  await examService.updatePaperMeta(documentId, {
    metadata: { ...currentMeta, stats },
  });
  send('log', {
    message: `Stats: ${stats.withAnswer}/${stats.itemCount} have answers`,
    level: 'info',
  });
}

export async function handleAnswerMatchPipeline(
  ctx: PipelineContext,
  docType: 'assignment' | 'exam' = 'assignment',
): Promise<void> {
  const { send, signal, documentId, fileBuffer } = ctx;

  send('status', { stage: 'extracting', message: 'Extracting answers from PDF...' });

  const { extractAnswersFromPDF } = await import('@/lib/rag/parsers/answer-extractor');

  // ── Stage 1: Extract answers from PDF ──
  let answers: Awaited<ReturnType<typeof extractAnswersFromPDF>>['answers'];
  let warnings: string[];
  try {
    const result = await extractAnswersFromPDF(fileBuffer, signal, (detail) => {
      send('pipeline_progress', {
        phase: 'extraction',
        phaseProgress: 0,
        totalProgress: 0,
        detail,
      });
      send('log', { message: detail, level: 'info' });
    });
    answers = result.answers;
    warnings = result.warnings;
  } catch (e) {
    sendGeminiError(send, e, 'extraction');
    return;
  }

  for (const w of warnings) send('log', { message: w, level: 'warning' });

  if (answers.length === 0) {
    send('log', { message: 'No answers found in document', level: 'warning' });
    send('status', { stage: 'complete', message: 'No answers found in document.' });
    return;
  }

  send('log', { message: `Extracted ${answers.length} answers`, level: 'success' });

  // ── Stage 2: Fetch existing items ──
  const existingItems =
    docType === 'exam'
      ? await loadExamQuestions(documentId)
      : await loadAssignmentItems(documentId);

  if (existingItems.length === 0) {
    send('log', { message: 'No existing questions to match against', level: 'error' });
    send('error', { message: 'No existing questions found.', code: 'NO_ITEMS' });
    return;
  }

  send('log', {
    message: `Matching against ${existingItems.length} existing questions...`,
    level: 'info',
  });

  // ── Stage 3: Match answers to items by title ──
  const titleToItems = new Map<string, MatchableItem[]>();
  for (const item of existingItems) {
    const norm = normalizeTitle(item.title);
    if (!norm) continue;
    const arr = titleToItems.get(norm) ?? [];
    arr.push(item);
    titleToItems.set(norm, arr);
  }

  type MatchResult = {
    itemId: string;
    answer: string;
    explanation: string;
    matchMethod: 'exact' | 'prefix' | 'order';
    answerTitle: string;
    itemTitle: string;
  };

  const matches: MatchResult[] = [];
  const matchedItemIds = new Set<string>();
  const unmatchedAnswers: typeof answers = [];

  // Pass 1: Exact normalized title match
  for (const answer of answers) {
    const normAnswer = normalizeTitle(answer.title);
    const candidates = titleToItems.get(normAnswer);
    if (candidates) {
      const candidate = candidates.find((c) => !matchedItemIds.has(c.id));
      if (candidate) {
        matches.push({
          itemId: candidate.id,
          answer: answer.referenceAnswer,
          explanation: answer.explanation,
          matchMethod: 'exact',
          answerTitle: answer.title,
          itemTitle: candidate.title,
        });
        matchedItemIds.add(candidate.id);
        continue;
      }
    }
    unmatchedAnswers.push(answer);
  }

  // Pass 2: Prefix match for remaining
  const stillUnmatched: typeof answers = [];
  for (const answer of unmatchedAnswers) {
    const normAnswer = normalizeTitle(answer.title);
    let found = false;
    for (const [normTitle, candidates] of titleToItems.entries()) {
      if (normTitle.startsWith(normAnswer) || normAnswer.startsWith(normTitle)) {
        const candidate = candidates.find((c) => !matchedItemIds.has(c.id));
        if (candidate) {
          matches.push({
            itemId: candidate.id,
            answer: answer.referenceAnswer,
            explanation: answer.explanation,
            matchMethod: 'prefix',
            answerTitle: answer.title,
            itemTitle: candidate.title,
          });
          matchedItemIds.add(candidate.id);
          found = true;
          break;
        }
      }
    }
    if (!found) stillUnmatched.push(answer);
  }

  // Pass 3: Order-based fallback
  if (stillUnmatched.length > 0) {
    const unmatchedItems = existingItems
      .filter((item) => !matchedItemIds.has(item.id))
      .filter((item) => !item.hasAnswer)
      .sort((a, b) => a.orderNum - b.orderNum);

    const sortedUnmatched = [...stillUnmatched].sort(
      (a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0),
    );

    const pairCount = Math.min(unmatchedItems.length, sortedUnmatched.length);
    for (let i = 0; i < pairCount; i++) {
      matches.push({
        itemId: unmatchedItems[i].id,
        answer: sortedUnmatched[i].referenceAnswer,
        explanation: sortedUnmatched[i].explanation,
        matchMethod: 'order',
        answerTitle: sortedUnmatched[i].title,
        itemTitle: unmatchedItems[i].title,
      });
      matchedItemIds.add(unmatchedItems[i].id);
    }

    const remaining = sortedUnmatched.slice(pairCount);
    for (const a of remaining) {
      send('log', { message: `Unmatched answer: "${a.title}"`, level: 'warning' });
    }
  }

  // Log match summary
  const exactCount = matches.filter((m) => m.matchMethod === 'exact').length;
  const prefixCount = matches.filter((m) => m.matchMethod === 'prefix').length;
  const orderCount = matches.filter((m) => m.matchMethod === 'order').length;
  const totalUnmatched = answers.length - matches.length;

  send('log', {
    message: `Matched ${matches.length}/${answers.length}: ${exactCount} exact, ${prefixCount} prefix, ${orderCount} order-fallback${totalUnmatched > 0 ? `, ${totalUnmatched} unmatched` : ''}`,
    level: matches.length > 0 ? 'success' : 'warning',
  });

  if (matches.length === 0) {
    send('status', { stage: 'complete', message: 'No answers could be matched to questions.' });
    return;
  }

  // Log overwrites
  for (const m of matches) {
    const existingItem = existingItems.find((i) => i.id === m.itemId);
    if (existingItem?.hasAnswer) {
      send('log', {
        message: `Overwriting existing answer for "${m.itemTitle || m.answerTitle}"`,
        level: 'warning',
      });
    }
  }

  // ── Stage 4: Batch update ──
  send('status', { stage: 'embedding', message: 'Saving matched answers...' });

  if (signal.aborted) return;

  try {
    if (docType === 'exam') {
      await saveExamAnswers(documentId, matches);
    } else {
      await saveAssignmentAnswers(documentId, matches);
    }
  } catch (e) {
    console.error('Batch update answers error:', e);
    send('error', { message: 'Failed to save matched answers.', code: 'SAVE_ERROR' });
    return;
  }

  // ── Update stats ──
  try {
    if (docType === 'exam') {
      await updateExamStats(documentId, send);
    } else {
      await updateAssignmentStats(documentId, send);
    }
  } catch (e) {
    console.warn('Failed to update stats (non-fatal):', e);
    send('log', { message: 'Stats update failed (non-fatal)', level: 'warning' });
  }

  send('log', { message: `${matches.length} answers saved`, level: 'success' });
  send('status', { stage: 'complete', message: 'Done!' });
}
