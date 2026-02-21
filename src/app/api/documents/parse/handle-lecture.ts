import type { CreateLectureChunkDTO } from '@/lib/domain/models/Document';
import { getLectureDocumentService } from '@/lib/services/DocumentService';
import type { Json } from '@/types/database';
import type { PipelineContext } from './types';

export async function handleLecturePipeline(ctx: PipelineContext): Promise<void> {
  const { send, signal, documentId, pages, fileHash, documentName } = ctx;
  const lectureService = getLectureDocumentService();

  send('status', { stage: 'extracting', message: 'AI extracting content...' });

  try {
    const { parseLectureMultiPass } = await import('@/lib/rag/parsers/lecture-parser');
    const parseResult = await parseLectureMultiPass(pages, {
      documentId,
      onProgress: (progress) => {
        send('pipeline_progress', progress);
        if (progress.detail) send('log', { message: progress.detail, level: 'info' });
      },
      signal,
    });

    const { sections, knowledgePoints, warnings = [] } = parseResult;
    const documentOutline = parseResult.outline;

    for (const w of warnings) {
      send('log', { message: w, level: 'warning' });
    }

    if (sections.length === 0) {
      send('log', { message: 'No structured content extracted', level: 'warning' });
      send('progress', { current: 0, total: 0 });
      send('status', { stage: 'complete', message: 'No content extracted' });
      return;
    }

    send('log', {
      message: `Extracted ${sections.length} sections, ${knowledgePoints.length} knowledge points`,
      level: 'success',
    });

    for (let i = 0; i < knowledgePoints.length; i++) {
      send('item', { index: i, type: 'knowledge_point', data: knowledgePoints[i] });
    }

    // ── Saving stage ──
    send('status', { stage: 'embedding', message: 'Saving...' });

    // Save document outline
    if (documentOutline) {
      send('log', { message: 'Saving document outline...', level: 'info' });
      try {
        const { getLectureDocumentRepository } =
          await import('@/lib/repositories/DocumentRepository');
        await getLectureDocumentRepository().saveOutline(
          documentId,
          documentOutline as unknown as Json,
        );
        send('log', { message: 'Document outline saved', level: 'success' });
      } catch (outlineError) {
        console.warn('Failed to save document outline (non-fatal):', outlineError);
        send('log', { message: 'Outline save failed (non-fatal)', level: 'warning' });
      }
    }

    // ── Dedup against existing chunks ──
    send('log', { message: 'Checking for duplicate sections...', level: 'info' });

    const { buildSectionChunkContent } = await import('@/lib/rag/build-chunk-content');

    const existingChunksForDedup = await lectureService.getChunksWithEmbeddings(documentId);
    const existingTitles = new Set(
      existingChunksForDedup.map((c) => {
        const meta = c.metadata as Record<string, unknown>;
        return ((meta.title as string) || '').trim().toLowerCase();
      }),
    );

    // Pass 1: title-based dedup
    const candidateSections = sections.filter(
      (s) => !existingTitles.has(s.title.trim().toLowerCase()),
    );
    const titleSkipped = sections.length - candidateSections.length;

    if (candidateSections.length === 0) {
      send('log', { message: 'All sections are duplicates (title match)', level: 'info' });
      send('status', {
        stage: 'complete',
        message: 'No new sections to add (all duplicates).',
      });
      return;
    }

    const candidateContents = candidateSections.map((s) => buildSectionChunkContent(s, pages));

    send('progress', { current: 0, total: candidateSections.length });

    // Generate embeddings
    if (signal.aborted) return;
    send('log', {
      message: `Generating embeddings for ${candidateSections.length} sections...`,
      level: 'info',
    });
    const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
    const candidateEmbeddings = await generateEmbeddingBatch(candidateContents);

    send('log', { message: 'Embeddings generated', level: 'success' });

    // Pass 2: embedding similarity dedup
    const SIMILARITY_THRESHOLD = 0.92;
    const existingEmbeddings = existingChunksForDedup
      .map((c) => {
        if (Array.isArray(c.embedding)) return c.embedding as number[];
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

    send('log', {
      message: `Dedup: ${existingEmbeddings.length} existing embeddings found for comparison`,
      level: 'info',
    });

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
        if (maxSim < SIMILARITY_THRESHOLD) {
          keepIndices.push(i);
        }
      }
      embeddingSkipped = candidateSections.length - keepIndices.length;
      if (embeddingSkipped > 0) {
        send('log', {
          message: `${embeddingSkipped} sections skipped (embedding similarity > ${SIMILARITY_THRESHOLD})`,
          level: 'info',
        });
      }
    } else {
      for (let i = 0; i < candidateSections.length; i++) keepIndices.push(i);
    }

    const totalSkipped = titleSkipped + embeddingSkipped;
    if (keepIndices.length === 0) {
      send('log', { message: 'All sections are duplicates', level: 'info' });
      send('status', {
        stage: 'complete',
        message: 'No new sections to add (all duplicates).',
      });
      return;
    }

    const newSections = keepIndices.map((i) => candidateSections[i]);
    const allContents = keepIndices.map((i) => candidateContents[i]);
    const allEmbeddings = keepIndices.map((i) => candidateEmbeddings[i]);

    send('log', {
      message:
        totalSkipped > 0
          ? `${newSections.length} new sections (${totalSkipped} duplicates skipped)`
          : `${newSections.length} sections to save`,
      level: 'success',
    });

    // Assemble DTOs
    const allChunks: CreateLectureChunkDTO[] = newSections.map((section, i) => ({
      lectureDocumentId: documentId,
      content: allContents[i],
      embedding: allEmbeddings[i],
      metadata: {
        type: 'section',
        title: section.title,
        summary: section.summary,
        sourcePages: section.sourcePages,
        knowledgePoints: section.knowledgePoints.map((kp) => ({
          title: kp.title,
          content: kp.content,
          sourcePages: kp.sourcePages,
        })),
        ...(documentName && { documentName }),
      },
    }));

    // Batch save (groups of 20)
    const SAVE_BATCH = 20;
    for (let i = 0; i < allChunks.length; i += SAVE_BATCH) {
      if (signal.aborted) break;
      const batchIdx = Math.floor(i / SAVE_BATCH);
      const batch = allChunks.slice(i, i + SAVE_BATCH);
      const batchEnd = Math.min(i + SAVE_BATCH, allChunks.length);

      send('log', {
        message: `Saving chunks ${i + 1}-${batchEnd} of ${allChunks.length}...`,
        level: 'info',
      });

      const saved = await lectureService.saveChunksAndReturn(batch);
      send('batch_saved', { chunkIds: saved.map((c) => c.id), batchIndex: batchIdx });
      send('progress', { current: batchEnd, total: allChunks.length });
    }

    send('log', { message: `Saved ${allChunks.length} chunks`, level: 'success' });
    send('status', { stage: 'complete', message: 'Done!' });

    // Store file hash for future course-level dedup
    try {
      const currentDoc = await lectureService.findById(documentId);
      const existingMeta = (currentDoc?.metadata as Record<string, unknown>) ?? {};
      await lectureService.updateDocumentMetadata(documentId, {
        metadata: { ...existingMeta, file_hash: fileHash } as Json,
      });
    } catch (hashErr) {
      console.warn('Failed to store file hash (non-fatal):', hashErr);
    }
  } catch (e) {
    console.error('LLM extraction error:', e);

    const isQuotaError =
      (e instanceof Error && /quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(e.message)) ||
      (typeof e === 'object' &&
        e !== null &&
        'status' in e &&
        (e as { status: number }).status === 429);

    if (isQuotaError) {
      send('log', { message: 'AI service quota exceeded', level: 'error' });
      send('error', {
        message: 'AI service quota exceeded. Please contact your administrator.',
        code: 'LLM_QUOTA_EXCEEDED',
      });
    } else {
      send('log', { message: 'Failed to extract content from PDF', level: 'error' });
      send('error', {
        message: 'Failed to extract content from PDF',
        code: 'EXTRACTION_ERROR',
      });
    }
  }
}
