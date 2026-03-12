import type { AssignmentMetadata, AssignmentStats } from '@/lib/rag/parsers/types';
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

export async function handleAnswerMatchPipeline(ctx: PipelineContext): Promise<void> {
  const { send, signal, documentId, fileBuffer } = ctx;

  send('status', { stage: 'extracting', message: 'Extracting answers from PDF...' });

  const { extractAnswersFromPDF } = await import('@/lib/rag/parsers/answer-extractor');
  const { getAssignmentService } = await import('@/lib/services/AssignmentService');
  const assignmentService = getAssignmentService();

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
  const existingItems = await assignmentService.getItems(documentId);
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
  // Build lookup: normalized title → item (prefer leaf items, handle duplicates)
  const titleToItems = new Map<string, typeof existingItems>();
  for (const item of existingItems) {
    const rawTitle = (item.metadata?.title as string) || item.content.substring(0, 50);
    const norm = normalizeTitle(rawTitle);
    if (!norm) continue;
    const arr = titleToItems.get(norm) ?? [];
    arr.push(item);
    titleToItems.set(norm, arr);
  }

  type MatchResult = {
    itemId: string;
    referenceAnswer: string;
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
      // Pick first unmatched candidate
      const candidate = candidates.find((c) => !matchedItemIds.has(c.id));
      if (candidate) {
        matches.push({
          itemId: candidate.id,
          referenceAnswer: answer.referenceAnswer,
          explanation: answer.explanation,
          matchMethod: 'exact',
          answerTitle: answer.title,
          itemTitle: (candidate.metadata?.title as string) || '',
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
            referenceAnswer: answer.referenceAnswer,
            explanation: answer.explanation,
            matchMethod: 'prefix',
            answerTitle: answer.title,
            itemTitle: (candidate.metadata?.title as string) || '',
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
      .filter((item) => !item.referenceAnswer?.trim()) // Only match to items without answers
      .sort((a, b) => a.orderNum - b.orderNum);

    const sortedUnmatched = [...stillUnmatched].sort(
      (a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0),
    );

    const pairCount = Math.min(unmatchedItems.length, sortedUnmatched.length);
    for (let i = 0; i < pairCount; i++) {
      matches.push({
        itemId: unmatchedItems[i].id,
        referenceAnswer: sortedUnmatched[i].referenceAnswer,
        explanation: sortedUnmatched[i].explanation,
        matchMethod: 'order',
        answerTitle: sortedUnmatched[i].title,
        itemTitle: (unmatchedItems[i].metadata?.title as string) || '',
      });
      matchedItemIds.add(unmatchedItems[i].id);
    }

    // Log remaining truly unmatched
    const remaining = sortedUnmatched.slice(pairCount);
    for (const a of remaining) {
      send('log', {
        message: `Unmatched answer: "${a.title}"`,
        level: 'warning',
      });
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
    if (existingItem?.referenceAnswer?.trim()) {
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
    await assignmentService.batchUpdateAnswersWithExplanation(
      matches.map((m) => ({
        itemId: m.itemId,
        referenceAnswer: m.referenceAnswer,
        explanation: m.explanation,
      })),
    );
  } catch (e) {
    console.error('Batch update answers error:', e);
    send('error', { message: 'Failed to save matched answers.', code: 'SAVE_ERROR' });
    return;
  }

  // ── Update stats ──
  try {
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

    const currentAssignment = await assignmentService.findById(documentId);
    const updatedMetadata: AssignmentMetadata = {
      ...((currentAssignment?.metadata as AssignmentMetadata) || {}),
      stats,
    };
    await assignmentService.updateMetadata(documentId, updatedMetadata);
  } catch (e) {
    console.warn('Failed to update assignment stats (non-fatal):', e);
    send('log', { message: 'Stats update failed (non-fatal)', level: 'warning' });
  }

  send('log', { message: `${matches.length} answers saved`, level: 'success' });
  send('status', { stage: 'complete', message: 'Done!' });
}
