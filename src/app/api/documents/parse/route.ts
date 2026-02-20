import { z } from 'zod';
import type { CreateLectureChunkDTO } from '@/lib/domain/models/Document';
import { getEnv } from '@/lib/env';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import type { ParsedQuestion } from '@/lib/rag/parsers/types';
import { getAssignmentRepository } from '@/lib/repositories/AssignmentRepository';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { getLectureDocumentService } from '@/lib/services/DocumentService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { requireAnyAdmin, requireCourseAdmin } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// [C2] Ensure this route runs on Node.js runtime and is never statically cached
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// [C1] Server-side file size limit (bytes) — lazy to avoid running getEnv() during next build
let _maxFileSize: number | undefined;
function getMaxFileSize(): number {
  if (_maxFileSize === undefined) {
    _maxFileSize = getEnv().NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024;
  }
  return _maxFileSize;
}

const uploadSchema = z.object({
  documentId: z.string().uuid(),
  doc_type: z.enum(['lecture', 'exam', 'assignment']),
  has_answers: z.preprocess(
    (value) => value === 'true' || value === true,
    z.boolean().optional().default(false),
  ),
  reparse: z.preprocess(
    (value) => value === 'true' || value === true,
    z.boolean().optional().default(false),
  ),
  append: z.preprocess(
    (value) => value === 'true' || value === true,
    z.boolean().optional().default(false),
  ),
});

export async function POST(request: Request) {
  const { stream, send, close } = createSSEStream();
  // [C3] Capture the request abort signal for client-disconnect awareness
  const signal = request.signal;

  // Start the async pipeline without awaiting (runs in background while streaming)
  const pipeline = (async () => {
    const lectureService = getLectureDocumentService();

    try {
      // ── Auth ──
      let user;
      let authRole: string;
      try {
        const result = await requireAnyAdmin();
        user = result.user;
        authRole = result.role;
      } catch {
        send('error', { message: 'Admin access required', code: 'FORBIDDEN' });
        return;
      }

      // ── Parse FormData ──
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File) || file.type !== 'application/pdf') {
        send('error', { message: 'Only PDF files are supported', code: 'INVALID_FILE' });
        return;
      }

      // [C1] Enforce server-side file size limit
      if (file.size > getMaxFileSize()) {
        send('error', { message: 'File too large', code: 'FILE_TOO_LARGE' });
        return;
      }

      const parsed = uploadSchema.safeParse({
        documentId: formData.get('documentId'),
        doc_type: formData.get('doc_type'),
        has_answers: formData.get('has_answers'),
        reparse: formData.get('reparse'),
        append: formData.get('append'),
      });
      if (!parsed.success) {
        send('error', { message: 'Invalid upload data', code: 'VALIDATION_ERROR' });
        return;
      }
      const { documentId, doc_type, has_answers, reparse, append } = parsed.data;

      // ── Course-level permission check (look up course from existing record) ──
      let courseId: string | null = null;
      let documentName: string | null = null;
      if (doc_type === 'lecture') {
        const doc = await lectureService.findById(documentId);
        if (!doc) {
          send('error', { message: 'Document not found', code: 'NOT_FOUND' });
          return;
        }
        courseId = doc.courseId;
        documentName = doc.name;
      } else if (doc_type === 'exam') {
        courseId = await getExamPaperRepository().findCourseId(documentId);
      } else {
        courseId = await getAssignmentRepository().findCourseId(documentId);
      }

      // Admin (non-super_admin) must have a course assigned
      if (authRole === 'admin' && !courseId) {
        send('error', {
          message: 'Admin must select a course for uploads',
          code: 'FORBIDDEN',
        });
        return;
      }
      if (courseId) {
        try {
          await requireCourseAdmin(courseId);
        } catch {
          send('error', { message: 'No access to this course', code: 'FORBIDDEN' });
          return;
        }
      }

      // ── Quota (after auth + course permission, so unauthorized requests don't consume quota) ──
      try {
        await getQuotaService().enforce(user.id);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          send('error', { message: error.message, code: 'QUOTA_EXCEEDED' });
        } else {
          send('error', { message: 'Quota check failed', code: 'QUOTA_ERROR' });
        }
        return;
      }

      // ── Check existing chunks (skip expensive LLM call if already parsed) ──
      const existingChunks = await lectureService.getChunks(documentId);
      if (existingChunks.length > 0 && !reparse && !append) {
        send('log', {
          message: `Document already has ${existingChunks.length} sections. Use reparse or append to continue.`,
          level: 'info',
        });
        send('status', { stage: 'complete', message: 'Document already parsed.' });
        return;
      }
      if (existingChunks.length > 0 && reparse) {
        send('log', { message: `Deleting ${existingChunks.length} existing chunks for re-parse...`, level: 'info' });
        await lectureService.deleteChunksByLectureDocumentId(documentId);
        send('log', { message: 'Existing chunks deleted', level: 'success' });
      }

      // ── Parse PDF ──
      console.log('[parse/route] ========== START document parse ==========');
      console.log('[parse/route] documentId:', documentId, '| doc_type:', doc_type, '| file:', documentName);
      send('log', { message: `Start parsing: ${documentName || documentId} (${doc_type})`, level: 'info' });
      send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });
      send('log', { message: 'Reading PDF file...', level: 'info' });

      const arrayBuffer = await file.arrayBuffer();

      // Compute SHA-256 file hash for course-level dedup
      const hashArray = new Uint8Array(
        await crypto.subtle.digest('SHA-256', arrayBuffer),
      );
      const fileHash = Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      let buffer: Buffer | null = Buffer.from(arrayBuffer);

      // [I4] Validate PDF magic bytes before passing to parser
      if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        send('log', { message: 'File is not a valid PDF', level: 'error' });
        send('error', { message: 'File is not a valid PDF', code: 'INVALID_FILE' });
        return;
      }

      let pdfData;
      try {
        pdfData = await parsePDF(buffer);
      } catch {
        send('log', { message: 'Failed to parse PDF content', level: 'error' });
        send('error', { message: 'Failed to parse PDF content', code: 'PDF_PARSE_ERROR' });
        return;
      }
      // [I5] Release buffer reference to allow GC on large files
      buffer = null;

      const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
      if (totalText.length === 0) {
        send('log', { message: 'PDF contains no extractable text', level: 'error' });
        send('error', { message: 'PDF contains no extractable text', code: 'EMPTY_PDF' });
        return;
      }

      send('log', {
        message: `PDF parsed: ${pdfData.pages.length} pages, ${(totalText.length / 1000).toFixed(1)}k chars`,
        level: 'success',
      });

      // [C3] Check abort before expensive LLM call
      if (signal.aborted) {
        return;
      }

      // ── LLM Extraction ──
      send('status', { stage: 'extracting', message: 'AI extracting content...' });

      let documentOutline: import('@/lib/rag/parsers/types').DocumentOutline | undefined;

      if (doc_type === 'lecture') {
        // ── LECTURE: section-level chunks ──
        try {
          const { parseLectureMultiPass } = await import('@/lib/rag/parsers/lecture-parser');
          const parseResult = await parseLectureMultiPass(pdfData.pages, {
            documentId,
            onProgress: (progress) => {
              send('pipeline_progress', progress);
              if (progress.detail) send('log', { message: progress.detail, level: 'info' });
            },
            signal,
          });

          const { sections, knowledgePoints, warnings = [] } = parseResult;
          documentOutline = parseResult.outline;

          // Surface extraction warnings to user
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

          // Send item events for frontend display
          for (let i = 0; i < knowledgePoints.length; i++) {
            send('item', { index: i, type: 'knowledge_point', data: knowledgePoints[i] });
          }

          // ── Enter saving stage ──
          send('status', { stage: 'embedding', message: 'Saving...' });

          // Save document outline (JSON only, no embedding)
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

          // Dedup against existing chunks by title + embedding similarity
          send('log', { message: 'Checking for duplicate sections...', level: 'info' });

          const { buildSectionChunkContent } = await import('@/lib/rag/build-chunk-content');

          const existingChunksForDedup = await lectureService.getChunksWithEmbeddings(documentId);
          const existingTitles = new Set(
            existingChunksForDedup.map((c) => {
              const meta = c.metadata as Record<string, unknown>;
              return ((meta.title as string) || '').trim().toLowerCase();
            }),
          );

          // Pass 1: title-based dedup (fast, no cost)
          let candidateSections = sections.filter(
            (s) => !existingTitles.has(s.title.trim().toLowerCase()),
          );
          const titleSkipped = sections.length - candidateSections.length;

          if (candidateSections.length === 0) {
            send('log', { message: 'All sections are duplicates (title match)', level: 'info' });
            send('status', { stage: 'complete', message: 'No new sections to add (all duplicates).' });
            return;
          }

          const candidateContents = candidateSections.map((s) => buildSectionChunkContent(s, pdfData.pages));

          send('progress', { current: 0, total: candidateSections.length });

          // Generate embeddings for candidate sections
          if (signal.aborted) return;
          send('log', { message: `Generating embeddings for ${candidateSections.length} sections...`, level: 'info' });
          const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
          const candidateEmbeddings = await generateEmbeddingBatch(candidateContents);

          send('log', { message: 'Embeddings generated', level: 'success' });

          // Pass 2: embedding similarity dedup (catches same content with different titles)
          const SIMILARITY_THRESHOLD = 0.92;
          // pgvector columns may come back as string "[0.1,0.2,...]" from Supabase
          const existingEmbeddings = existingChunksForDedup
            .map((c) => {
              if (Array.isArray(c.embedding)) return c.embedding as number[];
              if (typeof c.embedding === 'string') {
                try { return JSON.parse(c.embedding) as number[]; } catch { return null; }
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
            // No existing embeddings to compare — keep all candidates
            for (let i = 0; i < candidateSections.length; i++) keepIndices.push(i);
          }

          const totalSkipped = titleSkipped + embeddingSkipped;
          if (keepIndices.length === 0) {
            send('log', { message: 'All sections are duplicates', level: 'info' });
            send('status', { stage: 'complete', message: 'No new sections to add (all duplicates).' });
            return;
          }

          // Filter all arrays by keepIndices
          const newSections = keepIndices.map((i) => candidateSections[i]);
          const allContents = keepIndices.map((i) => candidateContents[i]);
          const allEmbeddings = keepIndices.map((i) => candidateEmbeddings[i]);

          send('log', {
            message: totalSkipped > 0
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

            send('log', { message: `Saving chunks ${i + 1}-${batchEnd} of ${allChunks.length}...`, level: 'info' });

            const saved = await lectureService.saveChunksAndReturn(batch);
            send('batch_saved', { chunkIds: saved.map((c) => c.id), batchIndex: batchIdx });
            send('progress', { current: batchEnd, total: allChunks.length });
          }

          send('log', { message: `Saved ${allChunks.length} chunks`, level: 'success' });

          // Store file hash in document metadata for future course-level dedup
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
          return;
        }
      } else {
        // ── EXAM / ASSIGNMENT: question extraction ──
        let items: Array<{
          type: 'question';
          data: ParsedQuestion;
        }>;

        try {
          const onBatchProgress = (current: number, total: number) => {
            send('progress', { current, total });
          };
          const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
          const questions = await parseQuestions(pdfData.pages, has_answers, onBatchProgress);
          items = questions.map((q) => ({ type: 'question' as const, data: q }));
        } catch (e) {
          console.error('LLM extraction error:', e);

          const isQuotaError =
            (e instanceof Error && /quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(e.message)) ||
            (typeof e === 'object' &&
              e !== null &&
              'status' in e &&
              (e as { status: number }).status === 429);

          if (isQuotaError) {
            send('error', {
              message: 'AI service quota exceeded. Please contact your administrator.',
              code: 'LLM_QUOTA_EXCEEDED',
            });
          } else {
            send('error', {
              message: 'Failed to extract content from PDF',
              code: 'EXTRACTION_ERROR',
            });
          }
          return;
        }

        if (items.length === 0) {
          send('progress', { current: 0, total: 0 });
          send('status', { stage: 'complete', message: 'No content extracted' });
          return;
        }

        if (doc_type === 'exam') {
          // ── EXAM: Content-based dedup, then save questions ──
          send('status', { stage: 'embedding', message: 'Saving questions...' });
          const examRepo = getExamPaperRepository();

          // Query existing questions for content-based dedup
          const existingQuestions = await examRepo.findQuestionsByPaperId(documentId);
          const existingContents = new Set(
            existingQuestions.map((q) => q.content.trim().toLowerCase()),
          );
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

          await examRepo.insertQuestions(questions);
          send('batch_saved', { chunkIds: questions.map((_, i) => `q-${i}`), batchIndex: 0 });

          const questionTypes = [...new Set(questions.map((q) => q.type).filter(Boolean))];
          if (questionTypes.length > 0) {
            await examRepo.updatePaper(documentId, { questionTypes });
          }
        } else {
          // ── ASSIGNMENT: Dedicated parser + two-pass dedup + batch saves ──
          send('status', { stage: 'extracting', message: 'Extracting assignment questions...' });

          const { parseAssignment } = await import('@/lib/rag/parsers/assignment-parser');
          const { buildAssignmentItemContent } = await import('@/lib/rag/build-chunk-content');
          const { getAssignmentService } = await import('@/lib/services/AssignmentService');
          const assignmentService = getAssignmentService();

          const parseResult = await parseAssignment(pdfData.pages, {
            assignmentId: documentId,
            signal,
            onProgress: (p) => send('pipeline_progress', p),
          });

          const { items: parsedItems, warnings } = parseResult;
          for (const w of warnings) send('log', { message: w, level: 'warning' });

          if (parsedItems.length === 0) {
            send('status', { stage: 'complete', message: 'No questions found in document.' });
            return;
          }

          // Send item events for frontend
          for (let i = 0; i < parsedItems.length; i++) {
            send('item', { index: i, type: 'question', data: parsedItems[i] });
            send('progress', { current: i + 1, total: parsedItems.length });
          }

          // ── Two-pass dedup ──
          send('log', { message: 'Checking for duplicate questions...', level: 'info' });

          const existingItemsForDedup = await assignmentService.getItemsWithEmbeddings(documentId);
          const existingContents = new Set(
            existingItemsForDedup.map((item) => item.content.trim().toLowerCase()),
          );

          // Pass 1: Content match (fast, zero cost)
          let candidateItems = parsedItems.filter(
            (item) => !existingContents.has(item.content.trim().toLowerCase()),
          );
          const contentSkipped = parsedItems.length - candidateItems.length;
          if (contentSkipped > 0) {
            send('log', { message: `Pass 1: ${contentSkipped} duplicates skipped (content match)`, level: 'info' });
          }

          if (candidateItems.length === 0) {
            send('status', { stage: 'complete', message: 'No new questions to add (all duplicates).' });
            return;
          }

          // Build enriched content for embedding
          const candidateContents = candidateItems.map((item) => buildAssignmentItemContent(item));

          send('log', { message: `Generating embeddings for ${candidateItems.length} questions...`, level: 'info' });
          if (signal.aborted) return;

          const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
          const candidateEmbeddings = await generateEmbeddingBatch(candidateContents);
          send('log', { message: 'Embeddings generated', level: 'success' });

          // Pass 2: Embedding similarity dedup
          const SIMILARITY_THRESHOLD = 0.92;
          const existingEmbeddings = existingItemsForDedup
            .map((c) => {
              if (Array.isArray(c.embedding)) return c.embedding;
              if (typeof c.embedding === 'string') {
                try { return JSON.parse(c.embedding) as number[]; } catch { return null; }
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
              send('log', { message: `Pass 2: ${embeddingSkipped} duplicates skipped (embedding similarity > ${SIMILARITY_THRESHOLD})`, level: 'info' });
            }
          } else {
            for (let i = 0; i < candidateItems.length; i++) keepIndices.push(i);
          }

          if (keepIndices.length === 0) {
            send('status', { stage: 'complete', message: 'No new questions to add (all duplicates).' });
            return;
          }

          // Filter by keepIndices
          const newItems = keepIndices.map((i) => candidateItems[i]);
          const allContents = keepIndices.map((i) => candidateContents[i]);
          const allEmbeddings = keepIndices.map((i) => candidateEmbeddings[i]);

          const totalSkipped = contentSkipped + embeddingSkipped;
          send('log', {
            message: totalSkipped > 0
              ? `${newItems.length} new questions (${totalSkipped} duplicates skipped)`
              : `${newItems.length} questions to save`,
            level: 'success',
          });

          // Get max order_num for appending
          const existingItems = await assignmentService.getItems(documentId);
          const maxOrderNum = existingItems.length > 0
            ? Math.max(...existingItems.map((item) => item.orderNum))
            : 0;

          // Assemble DTOs
          const allItemDTOs = newItems.map((item, i) => ({
            assignmentId: documentId,
            orderNum: maxOrderNum + i + 1,
            type: item.type,
            content: allContents[i],
            referenceAnswer: item.referenceAnswer,
            explanation: item.explanation,
            points: item.score,
            difficulty: item.difficulty,
            metadata: {
              section: item.section,
              type: item.type,
              sourcePages: item.sourcePages,
              difficulty: item.difficulty,
            },
            embedding: allEmbeddings[i],
          }));

          // Batch save (groups of 20)
          send('status', { stage: 'embedding', message: 'Saving questions...' });
          const SAVE_BATCH = 20;
          for (let i = 0; i < allItemDTOs.length; i += SAVE_BATCH) {
            if (signal.aborted) break;
            const batchIdx = Math.floor(i / SAVE_BATCH);
            const batch = allItemDTOs.slice(i, i + SAVE_BATCH);
            const batchEnd = Math.min(i + SAVE_BATCH, allItemDTOs.length);
            send('log', { message: `Saving questions ${i + 1}-${batchEnd} of ${allItemDTOs.length}...`, level: 'info' });
            const saved = await assignmentService.saveItemsAndReturn(batch);
            send('batch_saved', { chunkIds: saved.map((c) => c.id), batchIndex: batchIdx });
            send('progress', { current: batchEnd, total: allItemDTOs.length });
          }

          send('log', { message: `Saved ${allItemDTOs.length} questions`, level: 'success' });
        }
      }

      // Fire-and-forget: regenerate course outline after lecture upload
      if (doc_type === 'lecture' && courseId) {
        import('@/lib/services/CourseService').then(({ getCourseService }) =>
          getCourseService()
            .regenerateCourseOutline(courseId!)
            .catch((e) => console.warn('Course outline regeneration failed (non-fatal):', e)),
        );
      }

      send('status', { stage: 'complete', message: 'Done!' });
    } catch (error) {
      console.error('Parse pipeline error:', error);
      send('error', { message: 'Internal server error', code: 'INTERNAL_ERROR' });
    } finally {
      close();
    }
  })();

  // Prevent unhandled rejection warnings
  pipeline.catch(console.error);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
