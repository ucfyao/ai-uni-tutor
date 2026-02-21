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

    // ── Save document-level metadata ──
    const metadata = parseResult.metadata;
    if (metadata && Object.keys(metadata).length > 0) {
      try {
        await assignmentService.updateMetadata(documentId, metadata);
        send('log', { message: 'Document metadata saved', level: 'success' });
      } catch (e) {
        console.error('Failed to save assignment metadata:', e);
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

  // Track original parsedItems indices through dedup
  const afterContentDedup: number[] = []; // original indices that survive
  for (let i = 0; i < parsedItems.length; i++) {
    if (!existingContents.has(parsedItems[i].content.trim().toLowerCase())) {
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

  // Build enriched content for embedding (with parent context)
  const candidateContents = afterContentDedup.map((origIdx) => {
    const item = parsedItems[origIdx];
    const parentIdx = item.parentIndex;
    const parentContent =
      parentIdx != null && parsedItems[parentIdx] ? parsedItems[parentIdx].content : undefined;
    return buildAssignmentItemContent(item, parentContent);
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
  const keepCandidateIndices: number[] = []; // indices into afterContentDedup
  if (existingEmbeddings.length > 0) {
    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const emb = candidateEmbeddings[i];
      let maxSim = 0;
      for (const existing of existingEmbeddings) {
        let dot = 0;
        for (let d = 0; d < emb.length; d++) dot += emb[d] * existing[d];
        if (dot > maxSim) maxSim = dot;
      }
      if (maxSim < SIMILARITY_THRESHOLD) keepCandidateIndices.push(i);
    }
    embeddingSkipped = afterContentDedup.length - keepCandidateIndices.length;
    if (embeddingSkipped > 0) {
      send('log', {
        message: `Pass 2: ${embeddingSkipped} duplicates skipped (embedding similarity > ${SIMILARITY_THRESHOLD})`,
        level: 'info',
      });
    }
  } else {
    for (let i = 0; i < afterContentDedup.length; i++) keepCandidateIndices.push(i);
  }

  if (keepCandidateIndices.length === 0) {
    send('status', {
      stage: 'complete',
      message: 'No new questions to add (all duplicates).',
    });
    return;
  }

  // Final surviving items — track their original parsedItems index
  const survivingOrigIndices = keepCandidateIndices.map((ci) => afterContentDedup[ci]);
  const newContents = keepCandidateIndices.map((ci) => candidateContents[ci]);
  const newEmbeddings = keepCandidateIndices.map((ci) => candidateEmbeddings[ci]);
  const newItems = survivingOrigIndices.map((oi) => parsedItems[oi]);

  const totalSkipped = contentSkipped + embeddingSkipped;
  send('log', {
    message:
      totalSkipped > 0
        ? `${newItems.length} new questions (${totalSkipped} duplicates skipped)`
        : `${newItems.length} questions to save`,
    level: 'success',
  });

  // ── Stage 4: Save to database (two-pass for parent-child) ──
  let existingItems: Awaited<ReturnType<typeof assignmentService.getItems>>;
  try {
    existingItems = await assignmentService.getItems(documentId);
  } catch (e) {
    console.error('Failed to fetch existing items for ordering:', e);
    send('error', {
      message: 'Failed to prepare save. Please try again.',
      code: 'SAVE_PREP_ERROR',
    });
    return;
  }
  const maxOrderNum =
    existingItems.length > 0 ? Math.max(...existingItems.map((item) => item.orderNum)) : 0;

  send('status', { stage: 'embedding', message: 'Saving questions...' });

  // Build map: original parsedItems index → local newItems index
  const origToLocalIdx = new Map<number, number>();
  for (let i = 0; i < survivingOrigIndices.length; i++) {
    origToLocalIdx.set(survivingOrigIndices[i], i);
  }

  // Separate roots and children
  const rootLocalIndices: number[] = [];
  const childLocalIndices: number[] = [];
  for (let i = 0; i < newItems.length; i++) {
    const parentOrigIdx = newItems[i].parentIndex;
    if (parentOrigIdx == null || !origToLocalIdx.has(parentOrigIdx)) {
      // Root item or parent was deduped (treat as root)
      rootLocalIndices.push(i);
    } else {
      childLocalIndices.push(i);
    }
  }

  // Pass 1: Insert root items
  let nextOrder = maxOrderNum;
  const rootDTOs = rootLocalIndices.map((i) => {
    nextOrder++;
    return {
      assignmentId: documentId,
      orderNum: nextOrder,
      type: newItems[i].type,
      content: newItems[i].content,
      referenceAnswer: newItems[i].referenceAnswer,
      explanation: newItems[i].explanation,
      points: newItems[i].points,
      difficulty: newItems[i].difficulty,
      metadata: {
        title: newItems[i].title || '',
        type: newItems[i].type,
        sourcePages: newItems[i].sourcePages,
        difficulty: newItems[i].difficulty,
      },
      embedding: newEmbeddings[i],
      warnings: newItems[i].warnings ?? [],
      parentItemId: null as string | null,
    };
  });

  send('log', { message: `Saving ${rootDTOs.length} root questions...`, level: 'info' });

  let insertedRoots: { id: string }[];
  try {
    insertedRoots = await assignmentService.saveItemsAndReturn(rootDTOs);
  } catch (e) {
    console.error('Root items save error:', e);
    send('error', { message: 'Failed to save root questions.', code: 'SAVE_ERROR' });
    return;
  }

  // Map local newItems index → DB ID
  const localIdxToDbId = new Map<number, string>();
  for (let i = 0; i < rootLocalIndices.length; i++) {
    localIdxToDbId.set(rootLocalIndices[i], insertedRoots[i].id);
  }

  // Pass 2+: Insert children layer by layer (resolve parents)
  let remaining = [...childLocalIndices];
  let passNum = 0;
  while (remaining.length > 0 && passNum < 10) {
    passNum++;
    const resolvable: number[] = [];
    const unresolvable: number[] = [];

    for (const localIdx of remaining) {
      const parentOrigIdx = newItems[localIdx].parentIndex!;
      const parentLocalIdx = origToLocalIdx.get(parentOrigIdx);
      if (parentLocalIdx != null && localIdxToDbId.has(parentLocalIdx)) {
        resolvable.push(localIdx);
      } else {
        unresolvable.push(localIdx);
      }
    }

    if (resolvable.length === 0) {
      // Remaining are orphans — insert as roots
      const orphanDTOs = unresolvable.map((i) => {
        nextOrder++;
        return {
          assignmentId: documentId,
          orderNum: nextOrder,
          type: newItems[i].type,
          content: newItems[i].content,
          referenceAnswer: newItems[i].referenceAnswer,
          explanation: newItems[i].explanation,
          points: newItems[i].points,
          difficulty: newItems[i].difficulty,
          metadata: {
            title: newItems[i].title || '',
            type: newItems[i].type,
            sourcePages: newItems[i].sourcePages,
            difficulty: newItems[i].difficulty,
          },
          embedding: newEmbeddings[i],
          warnings: newItems[i].warnings ?? [],
          parentItemId: null as string | null,
        };
      });

      try {
        const inserted = await assignmentService.saveItemsAndReturn(orphanDTOs);
        for (let j = 0; j < unresolvable.length; j++) {
          localIdxToDbId.set(unresolvable[j], inserted[j].id);
        }
      } catch (e) {
        console.error(`Orphan items save error:`, e);
        send('error', { message: 'Failed to save orphan questions.', code: 'SAVE_ERROR' });
        return;
      }
      remaining = [];
      break;
    }

    const childDTOs = resolvable.map((i) => {
      nextOrder++;
      const parentOrigIdx = newItems[i].parentIndex!;
      const parentLocalIdx = origToLocalIdx.get(parentOrigIdx)!;
      return {
        assignmentId: documentId,
        orderNum: nextOrder,
        type: newItems[i].type,
        content: newItems[i].content,
        referenceAnswer: newItems[i].referenceAnswer,
        explanation: newItems[i].explanation,
        points: newItems[i].points,
        difficulty: newItems[i].difficulty,
        metadata: {
          title: newItems[i].title || '',
          type: newItems[i].type,
          sourcePages: newItems[i].sourcePages,
          difficulty: newItems[i].difficulty,
        },
        embedding: newEmbeddings[i],
        warnings: newItems[i].warnings ?? [],
        parentItemId: localIdxToDbId.get(parentLocalIdx) ?? null,
      };
    });

    try {
      const inserted = await assignmentService.saveItemsAndReturn(childDTOs);
      for (let j = 0; j < resolvable.length; j++) {
        localIdxToDbId.set(resolvable[j], inserted[j].id);
      }
    } catch (e) {
      console.error(`Child items save error (pass ${passNum}):`, e);
      send('error', {
        message: `Failed to save child questions (pass ${passNum}).`,
        code: 'SAVE_ERROR',
      });
      return;
    }

    remaining = unresolvable;
  }

  send('log', { message: `Saved ${newItems.length} questions`, level: 'success' });
  send('status', { stage: 'complete', message: 'Done!' });
}
