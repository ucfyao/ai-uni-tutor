import { RAG_CONFIG } from '@/lib/rag/config';
import type { ExamMetadata, ExamStats } from '@/lib/rag/parsers/types';
import { sendGeminiError, type PipelineContext } from './types';

export async function handleExamPipeline(ctx: PipelineContext): Promise<void> {
  const { send, signal, documentId, fileBuffer } = ctx;

  send('status', { stage: 'extracting', message: 'Extracting exam questions...' });

  const { parseExam } = await import('@/lib/rag/parsers/exam-parser');
  const { buildQuestionChunkContent } = await import('@/lib/rag/build-chunk-content');
  const { getExamPaperService } = await import('@/lib/services/ExamPaperService');
  const examService = getExamPaperService();

  // ── Stage 1: AI extraction ──
  let parsedItems: Awaited<ReturnType<typeof parseExam>>['items'];
  let warnings: string[];
  let examMetadata: ExamMetadata | undefined;
  try {
    const parseResult = await parseExam(fileBuffer, {
      examId: documentId,
      signal,
      onProgress: (p) => {
        send('pipeline_progress', p);
        if (p.detail) send('log', { message: p.detail, level: 'info' });
      },
    });
    parsedItems = parseResult.items;
    warnings = parseResult.warnings;
    examMetadata = parseResult.metadata;

    // ── Save document-level metadata ──
    if (examMetadata && Object.keys(examMetadata).length > 0) {
      try {
        const currentPaper = await examService.findById(documentId);
        const currentMeta = (currentPaper?.metadata as Record<string, unknown>) || {};
        await examService.updatePaperMeta(documentId, {
          metadata: {
            ...currentMeta,
            totalPoints: examMetadata.totalPoints,
            totalQuestions: examMetadata.totalQuestions,
            duration: examMetadata.duration,
            instructions: examMetadata.instructions,
            examDate: examMetadata.examDate,
          },
        });
        send('log', { message: 'Document metadata saved', level: 'success' });
      } catch (e) {
        console.error('Failed to save exam metadata:', e);
        send('log', {
          message: `Failed to save metadata: ${e instanceof Error ? e.message : 'Unknown'}`,
          level: 'warning',
        });
        // Non-fatal — continue with questions
      }
    }
  } catch (e) {
    sendGeminiError(send, e, 'extraction');
    return;
  }

  for (const w of warnings) send('log', { message: w, level: 'warning' });

  if (parsedItems.length === 0) {
    send('status', { stage: 'complete', message: 'No questions found in document.' });
    return;
  }

  // Send item events for frontend
  for (let i = 0; i < parsedItems.length; i++) {
    send('item', {
      index: i,
      type: 'question',
      data: parsedItems[i],
      warnings: parsedItems[i].warnings ?? [],
    });
    send('progress', { current: i + 1, total: parsedItems.length });
  }

  // ── Stage 2: Dedup ──
  send('log', { message: 'Checking for duplicate questions...', level: 'info' });

  let existingItemsForDedup: Awaited<ReturnType<typeof examService.getQuestionsByPaperId>>;
  try {
    existingItemsForDedup = await examService.getQuestionsByPaperId(documentId);
  } catch (e) {
    console.error('Failed to fetch existing items for dedup:', e);
    send('log', {
      message: `Failed to load existing items: ${e instanceof Error ? e.message : 'Unknown error'}`,
      level: 'error',
    });
    send('error', {
      message: 'Failed to check for duplicates. Please try again.',
      code: 'DEDUP_FETCH_ERROR',
    });
    return;
  }

  const normalizeContent = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const existingContents = new Set(
    existingItemsForDedup.map((item) => normalizeContent(item.content)),
  );

  // Track original parsedItems indices through dedup
  const afterContentDedup: number[] = []; // original indices that survive
  for (let i = 0; i < parsedItems.length; i++) {
    if (!existingContents.has(normalizeContent(parsedItems[i].content))) {
      afterContentDedup.push(i);
    }
  }
  const contentSkipped = parsedItems.length - afterContentDedup.length;
  if (contentSkipped > 0) {
    send('log', {
      message: `Pass 1: ${contentSkipped} duplicates skipped (content match)`,
      level: 'info',
    });
  }

  if (afterContentDedup.length === 0) {
    send('status', {
      stage: 'complete',
      message: 'No new questions to add (all duplicates).',
    });
    return;
  }

  // Build enriched content for embedding (with parent context - wait we use buildQuestionChunkContent which takes the item)
  // we need to adapt parsedItems[origIdx] to what buildQuestionChunkContent expects
  const candidateContents = afterContentDedup.map((origIdx) => {
    const item = parsedItems[origIdx];
    // buildQuestionChunkContent expects { content, options, answer, explanation } etc
    return buildQuestionChunkContent(item as any);
  });

  send('log', {
    message: `Generating embeddings for ${afterContentDedup.length} questions...`,
    level: 'info',
  });
  if (signal.aborted) return;

  // ── Stage 3: Generate embeddings ──
  let candidateEmbeddings: number[][];
  try {
    const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
    candidateEmbeddings = await generateEmbeddingBatch(candidateContents);
  } catch (e) {
    sendGeminiError(send, e, 'embedding');
    return;
  }
  send('log', { message: 'Embeddings generated', level: 'success' });

  // Note: ExamPaperService doesn't expose embeddings in getQuestionsByPaperId unless we modify it or just skip embedding dedup
  // Let's just do content dedup like the old exam pipeline to avoiding breaking things or needing massive repository changes.
  const keepCandidateIndices: number[] = []; // indices into afterContentDedup
  for (let i = 0; i < afterContentDedup.length; i++) keepCandidateIndices.push(i);

  // Final surviving items — track their original parsedItems index
  const survivingOrigIndices = keepCandidateIndices.map((ci) => afterContentDedup[ci]);
  const newEmbeddings = keepCandidateIndices.map((ci) => candidateEmbeddings[ci]);
  const newItems = survivingOrigIndices.map((oi) => parsedItems[oi]);

  const totalSkipped = contentSkipped;
  send('log', {
    message:
      totalSkipped > 0
        ? `${newItems.length} new questions (${totalSkipped} duplicates skipped)`
        : `${newItems.length} questions to save`,
    level: 'success',
  });

  // ── Stage 4: Save to database ──
  const maxOrderNum =
    existingItemsForDedup.length > 0
      ? Math.max(...existingItemsForDedup.map((item) => item.orderNum))
      : 0;

  send('status', { stage: 'embedding', message: 'Saving questions...' });

  // Build questions for saveHierarchicalQuestions
  let nextOrder = maxOrderNum;
  const questionsForSave = newItems.map((item, idx) => {
    nextOrder++;
    return {
      orderNum: nextOrder,
      type: item.type || '',
      content: item.content,
      options:
        item.options && item.options.length > 0
          ? Object.fromEntries(item.options.map((opt, j) => [String.fromCharCode(65 + j), opt]))
          : null,
      answer: item.referenceAnswer || '',
      explanation: item.explanation || '',
      points: item.points || 0,
      metadata: {
        title: item.title || '',
        type: item.type,
        sourcePages: item.sourcePages,
        difficulty: item.difficulty,
        options: item.options ?? [],
        warnings: item.warnings ?? [],
      },
      parentIndex: item.parentIndex ?? null,
      embedding: newEmbeddings[idx],
    };
  });

  try {
    await examService.saveHierarchicalQuestions(documentId, questionsForSave);
    send('batch_saved', { chunkIds: questionsForSave.map((_, i) => `q-${i}`), batchIndex: 0 });
  } catch (e) {
    sendGeminiError(send, e, 'save');
    return;
  }

  if (signal.aborted) return;

  // ── Compute stats and update exam metadata (non-fatal) ──
  try {
    const allItems = await examService.getQuestionsByPaperId(documentId);
    const stats: ExamStats = {
      itemCount: allItems.length,
      mainCount: 0,
      subCount: 0,
      withAnswer: 0,
      warningCount: 0,
    };

    for (const item of allItems) {
      if (item.parentQuestionId === null) {
        stats.mainCount++;
      } else {
        stats.subCount++;
      }
      if (item.answer?.trim()) stats.withAnswer++;
      const itemMeta = item.metadata as Record<string, unknown>;
      if (Array.isArray(itemMeta?.warnings) && itemMeta.warnings.length > 0) {
        stats.warningCount++;
      }
    }

    const currentPaper = await examService.findById(documentId);
    const currentMeta = (currentPaper?.metadata as Record<string, unknown>) || {};

    const questionTypes = [...new Set(allItems.map((q) => q.type).filter(Boolean))];

    await examService.updatePaperMeta(documentId, {
      questionTypes,
      metadata: {
        ...currentMeta,
        stats,
      },
    });
  } catch (e) {
    console.warn('Failed to update exam stats (non-fatal):', e);
    send('log', { message: 'Stats update failed (non-fatal)', level: 'warning' });
  }

  send('log', { message: `Saved ${newItems.length} questions`, level: 'success' });
  send('status', { stage: 'complete', message: 'Done!' });
}
