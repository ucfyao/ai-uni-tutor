import { z } from 'zod';
import type { CreateLectureChunkDTO } from '@/lib/domain/models/Document';
import { getEnv } from '@/lib/env';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import { buildChunkContent } from '@/lib/rag/build-chunk-content';

import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import { getAssignmentRepository } from '@/lib/repositories/AssignmentRepository';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { getLectureDocumentService } from '@/lib/services/DocumentService';
import { getKnowledgeCardService } from '@/lib/services/KnowledgeCardService';
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
});

export async function POST(request: Request) {
  const { stream, send, close } = createSSEStream();
  // [C3] Capture the request abort signal for client-disconnect awareness
  const signal = request.signal;

  // Start the async pipeline without awaiting (runs in background while streaming)
  const pipeline = (async () => {
    const documentService = getLectureDocumentService();

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
      });
      if (!parsed.success) {
        send('error', { message: 'Invalid upload data', code: 'VALIDATION_ERROR' });
        return;
      }
      const { documentId, doc_type, has_answers } = parsed.data;

      // ── Course-level permission check (look up course from existing record) ──
      let courseId: string | null = null;
      let documentName: string | null = null;
      if (doc_type === 'lecture') {
        const doc = await documentService.findById(documentId);
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

      // ── Parse PDF ──
      send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });

      const arrayBuffer = await file.arrayBuffer();
      let buffer: Buffer | null = Buffer.from(arrayBuffer);

      // [I4] Validate PDF magic bytes before passing to parser
      if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        send('error', { message: 'File is not a valid PDF', code: 'INVALID_FILE' });
        return;
      }

      let pdfData;
      try {
        pdfData = await parsePDF(buffer);
      } catch {
        send('error', { message: 'Failed to parse PDF content', code: 'PDF_PARSE_ERROR' });
        return;
      }
      // [I5] Release buffer reference to allow GC on large files
      buffer = null;

      const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
      if (totalText.length === 0) {
        send('error', { message: 'PDF contains no extractable text', code: 'EMPTY_PDF' });
        return;
      }

      // [C3] Check abort before expensive LLM call
      if (signal.aborted) {
        return;
      }

      // ── LLM Extraction ──
      send('status', { stage: 'extracting', message: 'AI extracting content...' });

      let items: Array<{
        type: 'knowledge_point' | 'question';
        data: KnowledgePoint | ParsedQuestion;
      }>;
      let documentOutline: import('@/lib/rag/parsers/types').DocumentOutline | undefined;

      try {
        if (doc_type === 'lecture') {
          const { parseLectureMultiPass } = await import('@/lib/rag/parsers/lecture-parser');
          const parseResult = await parseLectureMultiPass(pdfData.pages, {
            documentId,
            onProgress: (progress) => send('pipeline_progress', progress),
            signal,
          });
          const knowledgePoints = parseResult.knowledgePoints;
          items = knowledgePoints.map((kp) => ({ type: 'knowledge_point' as const, data: kp }));
          documentOutline = parseResult.outline;
        } else {
          const onBatchProgress = (current: number, total: number) => {
            send('progress', { current, total });
          };
          const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
          const questions = await parseQuestions(pdfData.pages, has_answers, onBatchProgress);
          items = questions.map((q) => ({ type: 'question' as const, data: q }));
        }
      } catch (e) {
        console.error('LLM extraction error:', e);

        // Detect quota / rate-limit errors from the LLM provider
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

      const totalItems = items.length;
      if (totalItems === 0) {
        send('progress', { current: 0, total: 0 });
        send('status', { stage: 'complete', message: 'No content extracted' });
        return;
      }

      if (doc_type === 'lecture') {
        // ── LECTURE: dedup, save knowledge cards, batch-embed, batch-save ──
        const existingChunks = await documentService.getChunks(documentId);
        const existingTitles = new Set(
          existingChunks.map((c) => {
            const meta = c.metadata as Record<string, unknown>;
            return ((meta.title as string) || '').trim().toLowerCase();
          }),
        );
        const newItems = items.filter((item) => {
          const kp = item.data as KnowledgePoint;
          return !existingTitles.has(kp.title.trim().toLowerCase());
        });

        if (newItems.length === 0) {
          send('status', { stage: 'complete', message: 'No new items to add (all duplicates).' });
          return;
        }

        // Save knowledge cards (non-fatal)
        const knowledgePoints = newItems.map((item) => item.data as KnowledgePoint);
        try {
          await getKnowledgeCardService().saveFromKnowledgePoints(knowledgePoints);
        } catch (cardError) {
          console.error('Knowledge card save error (non-fatal):', cardError);
        }

        // Save document outline if generated
        if (documentOutline) {
          try {
            const { getLectureDocumentRepository } =
              await import('@/lib/repositories/DocumentRepository');
            const { generateEmbedding } = await import('@/lib/rag/embedding');
            const outlineText = JSON.stringify(documentOutline);
            const embedding = await generateEmbedding(outlineText.slice(0, 2000));
            await getLectureDocumentRepository().saveOutline(
              documentId,
              documentOutline as unknown as Json,
              embedding,
            );
          } catch (outlineError) {
            console.warn('Failed to save document outline (non-fatal):', outlineError);
          }
        }

        // ── Batch embed + save ──
        send('status', { stage: 'embedding', message: 'Generating embeddings & saving...' });

        // 1. Collect all chunk contents
        const allContents = newItems.map(({ type, data }) => buildChunkContent(type, data));

        // Send item events for frontend display
        for (let i = 0; i < newItems.length; i++) {
          send('item', { index: i, type: newItems[i].type, data: newItems[i].data });
        }
        send('progress', { current: 0, total: newItems.length });

        // 2. Batch embed (10 concurrent via generateEmbeddingBatch)
        if (signal.aborted) return;
        const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
        const allEmbeddings = await generateEmbeddingBatch(allContents);

        // 3. Assemble DTOs
        const allChunks: CreateLectureChunkDTO[] = newItems.map(({ type, data }, i) => ({
          lectureDocumentId: documentId,
          content: allContents[i],
          embedding: allEmbeddings[i],
          metadata: { type, ...data, ...(documentName && { documentName }) },
        }));

        // 4. Batch save (groups of 20)
        const SAVE_BATCH = 20;
        for (let i = 0; i < allChunks.length; i += SAVE_BATCH) {
          if (signal.aborted) break;
          const batch = allChunks.slice(i, i + SAVE_BATCH);
          const saved = await documentService.saveChunksAndReturn(batch);
          send('batch_saved', { chunkIds: saved.map((c) => c.id), batchIndex: Math.floor(i / SAVE_BATCH) });
          send('progress', { current: Math.min(i + SAVE_BATCH, allChunks.length), total: allChunks.length });
        }
      } else if (doc_type === 'exam') {
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
          const q = item.data as ParsedQuestion;
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
          const q = item.data as ParsedQuestion;
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
        // ── ASSIGNMENT: Content-based dedup + embeddings (existing logic) ──
        send('status', { stage: 'embedding', message: 'Generating embeddings...' });
        const assignmentRepo = getAssignmentRepository();

        // Query existing items for content-based dedup
        const existingItems = await assignmentRepo.findItemsByAssignmentId(documentId);
        const existingContents = new Set(
          existingItems.map((item) => item.content.trim().toLowerCase()),
        );
        const maxOrderNum =
          existingItems.length > 0 ? Math.max(...existingItems.map((item) => item.orderNum)) : 0;

        for (let i = 0; i < items.length; i++) {
          send('item', { index: i, type: items[i].type, data: items[i].data });
          send('progress', { current: i + 1, total: totalItems });
        }

        // Filter out duplicates based on content
        const newItems = items.filter((item) => {
          const q = item.data as ParsedQuestion;
          return !existingContents.has(q.content.trim().toLowerCase());
        });

        if (newItems.length === 0) {
          send('status', { stage: 'complete', message: 'No new items to add (all duplicates).' });
          return;
        }

        const assignmentItems = newItems.map((item, idx) => {
          const q = item.data as ParsedQuestion;
          return {
            assignmentId: documentId,
            orderNum: maxOrderNum + idx + 1,
            type: '',
            content: q.content,
            referenceAnswer: q.referenceAnswer || '',
            explanation: '',
            points: q.score || 0,
            difficulty: '',
            metadata: { sourcePage: q.sourcePage },
          };
        });

        // Generate embeddings for assignment items
        const embeddingTexts = assignmentItems.map(
          (item) => `Question ${item.orderNum}: ${item.content}`,
        );

        let embeddings: number[][] = [];
        try {
          const { generateEmbeddingBatch } = await import('@/lib/rag/embedding');
          embeddings = await generateEmbeddingBatch(embeddingTexts);
          send('status', { stage: 'embedding', message: 'Embeddings generated' });
        } catch (e) {
          console.error('Assignment embedding generation failed:', e);
          // Continue without embeddings — items still save, just no RAG
        }

        const itemsWithEmbeddings = assignmentItems.map((item, idx) => ({
          ...item,
          embedding: embeddings[idx] ?? null,
        }));

        await assignmentRepo.insertItems(itemsWithEmbeddings);
        send('batch_saved', { chunkIds: assignmentItems.map((_, i) => `a-${i}`), batchIndex: 0 });
      }

      // Fire-and-forget: regenerate course outline after lecture upload
      if (doc_type === 'lecture' && courseId) {
        import('@/lib/services/CourseService').then(({ getCourseService }) =>
          getCourseService()
            .regenerateCourseOutline(courseId!)
            .catch((e) => console.warn('Course outline regeneration failed (non-fatal):', e)),
        );
      }

      send('status', { stage: 'complete', message: `Done! ${totalItems} items extracted.` });
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
