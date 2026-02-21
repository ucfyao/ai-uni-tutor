import { sendGeminiError, type PipelineContext } from './types';

export async function handleAssignmentPipeline(ctx: PipelineContext): Promise<void> {
  const { send, signal, documentId, pages } = ctx;

  send('status', { stage: 'extracting', message: 'Extracting assignment questions...' });

  const { parseAssignment } = await import('@/lib/rag/parsers/assignment-parser');
  const { buildAssignmentItemContent } = await import('@/lib/rag/build-chunk-content');
  const { getAssignmentService } = await import('@/lib/services/AssignmentService');
  const assignmentService = getAssignmentService();

  // ── Stage 1: AI extraction ──
  let parsedItems: Awaited<ReturnType<typeof parseAssignment>>['items'];
  let warnings: string[];
  try {
    const parseResult = await parseAssignment(pages, {
      assignmentId: documentId,
      signal,
      onProgress: (p) => send('pipeline_progress', p),
    });
    parsedItems = parseResult.items;
    warnings = parseResult.warnings;
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

  let existingItemsForDedup: Awaited<ReturnType<typeof assignmentService.getItemsWithEmbeddings>>;
  try {
    existingItemsForDedup = await assignmentService.getItemsWithEmbeddings(documentId);
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

  const existingContents = new Set(
    existingItemsForDedup.map((item) => item.content.trim().toLowerCase()),
  );

  // Pass 1: Content match
  let candidateItems = parsedItems.filter(
    (item) => !existingContents.has(item.content.trim().toLowerCase()),
  );
  const contentSkipped = parsedItems.length - candidateItems.length;
  if (contentSkipped > 0) {
    send('log', {
      message: `Pass 1: ${contentSkipped} duplicates skipped (content match)`,
      level: 'info',
    });
  }

  if (candidateItems.length === 0) {
    send('status', {
      stage: 'complete',
      message: 'No new questions to add (all duplicates).',
    });
    return;
  }

  // Build enriched content for embedding
  const candidateContents = candidateItems.map((item) => buildAssignmentItemContent(item));

  send('log', {
    message: `Generating embeddings for ${candidateItems.length} questions...`,
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

  // Pass 2: Embedding similarity dedup
  const SIMILARITY_THRESHOLD = 0.92;
  const existingEmbeddings = existingItemsForDedup
    .map((c) => {
      if (Array.isArray(c.embedding)) return c.embedding;
      if (typeof c.embedding === 'string') {
        try {
          return JSON.parse(c.embedding) as number[];
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter((e): e is number[] => Array.isArray(e) && e.length > 0);

  let embeddingSkipped = 0;
  const keepIndices: number[] = [];
  if (existingEmbeddings.length > 0) {
    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const emb = candidateEmbeddings[i];
      let maxSim = 0;
      for (const existing of existingEmbeddings) {
        let dot = 0;
        for (let d = 0; d < emb.length; d++) dot += emb[d] * existing[d];
        if (dot > maxSim) maxSim = dot;
      }
      if (maxSim < SIMILARITY_THRESHOLD) keepIndices.push(i);
    }
    embeddingSkipped = candidateItems.length - keepIndices.length;
    if (embeddingSkipped > 0) {
      send('log', {
        message: `Pass 2: ${embeddingSkipped} duplicates skipped (embedding similarity > ${SIMILARITY_THRESHOLD})`,
        level: 'info',
      });
    }
  } else {
    for (let i = 0; i < candidateItems.length; i++) keepIndices.push(i);
  }

  if (keepIndices.length === 0) {
    send('status', {
      stage: 'complete',
      message: 'No new questions to add (all duplicates).',
    });
    return;
  }

  // Filter by keepIndices
  const newItems = keepIndices.map((i) => candidateItems[i]);
  const allContents = keepIndices.map((i) => candidateContents[i]);
  const allEmbeddings = keepIndices.map((i) => candidateEmbeddings[i]);

  const totalSkipped = contentSkipped + embeddingSkipped;
  send('log', {
    message:
      totalSkipped > 0
        ? `${newItems.length} new questions (${totalSkipped} duplicates skipped)`
        : `${newItems.length} questions to save`,
    level: 'success',
  });

  // ── Stage 4: Save to database ──
  let existingItems: Awaited<ReturnType<typeof assignmentService.getItems>>;
  try {
    existingItems = await assignmentService.getItems(documentId);
  } catch (e) {
    console.error('Failed to fetch existing items for ordering:', e);
    send('log', {
      message: `Failed to load existing items: ${e instanceof Error ? e.message : 'Unknown error'}`,
      level: 'error',
    });
    send('error', {
      message: 'Failed to prepare save. Please try again.',
      code: 'SAVE_PREP_ERROR',
    });
    return;
  }
  const maxOrderNum =
    existingItems.length > 0 ? Math.max(...existingItems.map((item) => item.orderNum)) : 0;

  // Assemble DTOs
  const allItemDTOs = newItems.map((item, i) => ({
    assignmentId: documentId,
    orderNum: maxOrderNum + i + 1,
    type: item.type,
    content: allContents[i],
    referenceAnswer: item.referenceAnswer,
    explanation: item.explanation,
    points: item.points,
    difficulty: item.difficulty,
    metadata: {
      section: item.section,
      type: item.type,
      sourcePages: item.sourcePages,
      difficulty: item.difficulty,
    },
    embedding: allEmbeddings[i],
    warnings: item.warnings ?? [],
  }));

  // Batch save (groups of 20)
  send('status', { stage: 'embedding', message: 'Saving questions...' });
  const SAVE_BATCH = 20;
  for (let i = 0; i < allItemDTOs.length; i += SAVE_BATCH) {
    if (signal.aborted) break;
    const batchIdx = Math.floor(i / SAVE_BATCH);
    const batch = allItemDTOs.slice(i, i + SAVE_BATCH);
    const batchEnd = Math.min(i + SAVE_BATCH, allItemDTOs.length);
    send('log', {
      message: `Saving questions ${i + 1}-${batchEnd} of ${allItemDTOs.length}...`,
      level: 'info',
    });
    try {
      const saved = await assignmentService.saveItemsAndReturn(batch);
      send('batch_saved', { chunkIds: saved.map((c) => c.id), batchIndex: batchIdx });
      send('progress', { current: batchEnd, total: allItemDTOs.length });
    } catch (e) {
      console.error(`Batch save error (batch ${batchIdx}):`, e);
      send('log', {
        message: `Failed to save questions ${i + 1}-${batchEnd}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        level: 'error',
      });
      send('error', {
        message: `Failed to save questions (batch ${batchIdx + 1}). ${i > 0 ? `${i} questions were saved successfully.` : 'No questions were saved.'}`,
        code: 'SAVE_ERROR',
      });
      return;
    }
  }

  send('log', { message: `Saved ${allItemDTOs.length} questions`, level: 'success' });
  send('status', { stage: 'complete', message: 'Done!' });
}
