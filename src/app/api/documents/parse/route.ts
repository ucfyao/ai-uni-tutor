import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { getEnv } from '@/lib/env';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import { buildChunkContent } from '@/lib/rag/build-chunk-content';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import { getAssignmentRepository } from '@/lib/repositories/AssignmentRepository';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getKnowledgeCardService } from '@/lib/services/KnowledgeCardService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { requireAnyAdmin } from '@/lib/supabase/server';

// [C2] Ensure this route runs on Node.js runtime and is never statically cached
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 3;

// [C1] Server-side file size limit (bytes) — lazy to avoid running getEnv() during next build
let _maxFileSize: number | undefined;
function getMaxFileSize(): number {
  if (_maxFileSize === undefined) {
    _maxFileSize = getEnv().NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024;
  }
  return _maxFileSize;
}

const uploadSchema = z.object({
  doc_type: z.enum(['lecture', 'exam', 'assignment']).optional().default('lecture'),
  school: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
  course: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
  courseId: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? value : undefined),
    z.string().uuid().optional(),
  ),
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
    let docId: string | undefined;
    let recordId: string | undefined;
    let recordDocType: string | undefined;
    const documentService = getDocumentService();

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

      // ── Quota ──
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
        doc_type: formData.get('doc_type') || undefined,
        school: formData.get('school'),
        course: formData.get('course'),
        courseId: formData.get('courseId'),
        has_answers: formData.get('has_answers'),
      });
      if (!parsed.success) {
        send('error', { message: 'Invalid upload data', code: 'VALIDATION_ERROR' });
        return;
      }
      const { doc_type, school, course, courseId, has_answers } = parsed.data;

      // Admin (non-super_admin) must provide courseId for all doc types
      if (authRole === 'admin' && !courseId) {
        send('error', { message: 'Course selection is required', code: 'COURSE_REQUIRED' });
        return;
      }

      // ── Create record in the correct domain table ──
      let effectiveRecordId: string;
      recordDocType = doc_type;

      if (doc_type === 'lecture') {
        // Lecture → documents table (existing flow, unchanged)
        const isDuplicate = await documentService.checkDuplicate(user.id, file.name);
        if (isDuplicate) {
          send('error', { message: `File "${file.name}" already exists.`, code: 'DUPLICATE' });
          return;
        }
        const doc = await documentService.createDocument(
          user.id,
          file.name,
          { school: school || 'Unspecified', course: course || 'General' },
          doc_type,
        );
        effectiveRecordId = doc.id;
        docId = doc.id;
      } else if (doc_type === 'exam') {
        const examRepo = getExamPaperRepository();
        effectiveRecordId = await examRepo.create({
          userId: user.id,
          title: file.name,
          school: school || null,
          course: course || null,
          courseId: courseId || null,
          status: 'parsing',
        });
      } else {
        const assignmentRepo = getAssignmentRepository();
        effectiveRecordId = await assignmentRepo.create({
          userId: user.id,
          title: file.name,
          school: school || null,
          course: course || null,
          courseId: courseId || null,
          status: 'parsing',
        });
      }
      recordId = effectiveRecordId;
      send('document_created', { documentId: effectiveRecordId });

      // Helper — update status on correct table
      async function updateRecordStatus(status: string, msg: string) {
        if (doc_type === 'lecture') {
          await documentService.updateStatus(
            effectiveRecordId,
            status as 'processing' | 'ready' | 'error',
            msg,
          );
        } else if (doc_type === 'exam') {
          await getExamPaperRepository().updateStatus(
            effectiveRecordId,
            status as 'parsing' | 'ready' | 'error',
            msg,
          );
        } else {
          await getAssignmentRepository().updateStatus(effectiveRecordId, status as string, msg);
        }
      }

      // ── Parse PDF ──
      send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });
      if (doc_type === 'lecture') {
        await documentService.updateStatus(effectiveRecordId, 'processing', 'Parsing PDF...');
      }

      const arrayBuffer = await file.arrayBuffer();
      let buffer: Buffer | null = Buffer.from(arrayBuffer);

      // [I4] Validate PDF magic bytes before passing to parser
      if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        await updateRecordStatus('error', 'Invalid PDF file');
        send('error', { message: 'File is not a valid PDF', code: 'INVALID_FILE' });
        return;
      }

      let pdfData;
      try {
        pdfData = await parsePDF(buffer);
      } catch {
        await updateRecordStatus('error', 'Failed to parse PDF');
        send('error', { message: 'Failed to parse PDF content', code: 'PDF_PARSE_ERROR' });
        return;
      }
      // [I5] Release buffer reference to allow GC on large files
      buffer = null;

      const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
      if (totalText.length === 0) {
        await updateRecordStatus('error', 'PDF contains no extractable text');
        send('error', { message: 'PDF contains no extractable text', code: 'EMPTY_PDF' });
        return;
      }

      // [C3] Check abort before expensive LLM call
      if (signal.aborted) {
        await updateRecordStatus('error', 'Client disconnected');
        return;
      }

      // ── LLM Extraction ──
      send('status', { stage: 'extracting', message: 'AI extracting content...' });
      await updateRecordStatus('processing', 'Extracting content...');

      let items: Array<{
        type: 'knowledge_point' | 'question';
        data: KnowledgePoint | ParsedQuestion;
      }>;

      try {
        const onBatchProgress = (current: number, total: number) => {
          send('progress', { current, total });
        };

        if (doc_type === 'lecture') {
          const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
          const knowledgePoints = await parseLecture(pdfData.pages, onBatchProgress);
          items = knowledgePoints.map((kp) => ({ type: 'knowledge_point' as const, data: kp }));
        } else {
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
          await updateRecordStatus('error', 'AI quota exceeded');
          send('error', {
            message: 'AI service quota exceeded. Please contact your administrator.',
            code: 'LLM_QUOTA_EXCEEDED',
          });
        } else {
          await updateRecordStatus('error', 'Failed to extract content');
          send('error', {
            message: 'Failed to extract content from PDF',
            code: 'EXTRACTION_ERROR',
          });
        }
        return;
      }

      const totalItems = items.length;
      if (totalItems === 0) {
        await updateRecordStatus('ready', '');
        send('progress', { current: 0, total: 0 });
        send('status', { stage: 'complete', message: 'No content extracted' });
        return;
      }

      if (doc_type === 'lecture') {
        // ── LECTURE: Save knowledge cards, then embed + save chunks ──
        const knowledgePoints = items.map((item) => item.data as KnowledgePoint);
        try {
          await getKnowledgeCardService().saveFromKnowledgePoints(
            knowledgePoints,
            effectiveRecordId,
          );
        } catch (cardError) {
          console.error('Knowledge card save error (non-fatal):', cardError);
        }

        send('status', { stage: 'embedding', message: 'Generating embeddings & saving...' });
        await documentService.updateStatus(
          effectiveRecordId,
          'processing',
          'Generating embeddings & saving...',
        );

        let batch: CreateDocumentChunkDTO[] = [];
        let batchIndex = 0;

        for (let i = 0; i < items.length; i++) {
          if (signal.aborted) {
            if (batch.length > 0) await documentService.saveChunksAndReturn(batch);
            await documentService.updateStatus(effectiveRecordId, 'ready');
            return;
          }

          const { type, data } = items[i];
          send('item', { index: i, type, data });
          send('progress', { current: i + 1, total: totalItems });

          const content = buildChunkContent(type, data);
          const embedding = await generateEmbeddingWithRetry(content);
          batch.push({
            documentId: effectiveRecordId,
            content,
            embedding,
            metadata: { type, ...data },
          });

          if (batch.length >= BATCH_SIZE || i === items.length - 1) {
            const savedChunks = await documentService.saveChunksAndReturn(batch);
            send('batch_saved', { chunkIds: savedChunks.map((c) => c.id), batchIndex });
            batch = [];
            batchIndex++;
          }
        }

        await documentService.updateStatus(effectiveRecordId, 'ready');
      } else if (doc_type === 'exam') {
        // ── EXAM: Save to exam_questions (no embedding) ──
        send('status', { stage: 'embedding', message: 'Saving questions...' });
        const examRepo = getExamPaperRepository();

        for (let i = 0; i < items.length; i++) {
          send('item', { index: i, type: items[i].type, data: items[i].data });
          send('progress', { current: i + 1, total: totalItems });
        }

        const questions = items.map((item, idx) => {
          const q = item.data as ParsedQuestion;
          return {
            paperId: effectiveRecordId,
            orderNum: idx + 1,
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
          await examRepo.updatePaper(effectiveRecordId, { questionTypes });
        }

        await examRepo.updateStatus(effectiveRecordId, 'ready');
      } else {
        // ── ASSIGNMENT: Save to assignment_items (no embedding) ──
        send('status', { stage: 'embedding', message: 'Saving items...' });
        const assignmentRepo = getAssignmentRepository();

        for (let i = 0; i < items.length; i++) {
          send('item', { index: i, type: items[i].type, data: items[i].data });
          send('progress', { current: i + 1, total: totalItems });
        }

        const assignmentItems = items.map((item, idx) => {
          const q = item.data as ParsedQuestion;
          return {
            assignmentId: effectiveRecordId,
            orderNum: idx + 1,
            type: '',
            content: q.content,
            referenceAnswer: q.referenceAnswer || '',
            explanation: '',
            points: q.score || 0,
            difficulty: '',
            metadata: { sourcePage: q.sourcePage },
          };
        });

        await assignmentRepo.insertItems(assignmentItems);
        send('batch_saved', { chunkIds: assignmentItems.map((_, i) => `a-${i}`), batchIndex: 0 });

        await assignmentRepo.updateStatus(effectiveRecordId, 'ready');
      }

      send('status', { stage: 'complete', message: `Done! ${totalItems} items extracted.` });
    } catch (error) {
      console.error('Parse pipeline error:', error);
      if (recordId) {
        try {
          if (recordDocType === 'exam') {
            await getExamPaperRepository().updateStatus(
              recordId,
              'error',
              'Processing failed unexpectedly',
            );
          } else if (recordDocType === 'assignment') {
            await getAssignmentRepository().updateStatus(
              recordId,
              'error',
              'Processing failed unexpectedly',
            );
          } else if (docId) {
            await documentService.updateStatus(docId, 'error', 'Processing failed unexpectedly');
            try {
              await getKnowledgeCardService().deleteByDocumentId(docId);
            } catch {
              /* ignore card cleanup errors */
            }
          }
        } catch {
          /* ignore cleanup errors */
        }
      }
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
