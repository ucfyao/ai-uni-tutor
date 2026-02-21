import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import { getLectureDocumentService } from '@/lib/services/DocumentService';
import { getExamPaperService } from '@/lib/services/ExamPaperService';
import { GEMINI_MODELS } from '@/lib/gemini';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { requireAnyAdmin, requireCourseAdmin } from '@/lib/supabase/server';
import { handleAssignmentPipeline } from './handle-assignment';
import { handleExamPipeline } from './handle-exam';
import { handleLecturePipeline } from './handle-lecture';
import type { PipelineContext } from './types';

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
        courseId = await getExamPaperService().findCourseId(documentId);
      } else {
        const { getAssignmentService } = await import('@/lib/services/AssignmentService');
        courseId = await getAssignmentService().findCourseId(documentId);
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
        await getQuotaService().enforce(user.id, GEMINI_MODELS.parse);
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          send('error', { message: error.message, code: 'QUOTA_EXCEEDED' });
        } else {
          send('error', { message: 'Quota check failed', code: 'QUOTA_ERROR' });
        }
        return;
      }

      // ── Check existing items (skip expensive LLM call if already parsed) ──
      // Each doc_type checks its own table; exam/assignment have internal dedup so
      // this gate is mainly for lectures to avoid redundant LLM calls.
      let existingCount = 0;
      if (doc_type === 'assignment') {
        const { getAssignmentService } = await import('@/lib/services/AssignmentService');
        const items = await getAssignmentService().getItems(documentId);
        existingCount = items.length;
      } else if (doc_type === 'exam') {
        const questions = await getExamPaperService().getQuestionsByPaperId(documentId);
        existingCount = questions.length;
      } else {
        const chunks = await lectureService.getChunks(documentId);
        existingCount = chunks.length;
      }

      if (existingCount > 0 && !reparse && !append) {
        send('log', {
          message: `Document already has ${existingCount} items. Use reparse or append to continue.`,
          level: 'info',
        });
        send('status', { stage: 'complete', message: 'Document already parsed.' });
        return;
      }
      if (existingCount > 0 && reparse) {
        send('log', {
          message: `Deleting ${existingCount} existing items for re-parse...`,
          level: 'info',
        });
        if (doc_type === 'assignment') {
          const { getAssignmentService } = await import('@/lib/services/AssignmentService');
          await getAssignmentService().deleteItemsByAssignmentId(documentId);
        } else if (doc_type === 'lecture') {
          await lectureService.deleteChunksByLectureDocumentId(documentId);
        }
        // exam: no bulk-delete method — exam/assignment branches do content-based dedup internally
        send('log', { message: 'Existing items deleted', level: 'success' });
      }

      // ── Parse PDF ──
      console.log('[parse/route] ========== START document parse ==========');
      console.log(
        '[parse/route] documentId:',
        documentId,
        '| doc_type:',
        doc_type,
        '| file:',
        documentName,
      );
      send('log', {
        message: `Start parsing: ${documentName || documentId} (${doc_type})`,
        level: 'info',
      });
      send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });
      send('log', { message: 'Reading PDF file...', level: 'info' });

      const arrayBuffer = await file.arrayBuffer();

      // Compute SHA-256 file hash for course-level dedup
      const hashArray = new Uint8Array(await crypto.subtle.digest('SHA-256', arrayBuffer));
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

      // ── Dispatch to doc-type-specific pipeline ──
      const ctx: PipelineContext = {
        send,
        signal,
        documentId,
        pages: pdfData.pages,
        fileHash,
        courseId,
        userId: user.id,
        hasAnswers: has_answers,
        documentName,
      };

      if (doc_type === 'lecture') {
        await handleLecturePipeline(ctx);
      } else if (doc_type === 'exam') {
        await handleExamPipeline(ctx);
      } else {
        await handleAssignmentPipeline(ctx);
      }

      // Fire-and-forget: regenerate course outline after lecture upload
      if (doc_type === 'lecture' && courseId) {
        import('@/lib/services/CourseService').then(({ getCourseService }) =>
          getCourseService()
            .regenerateCourseOutline(courseId!)
            .catch((e) => console.warn('Course outline regeneration failed (non-fatal):', e)),
        );
      }
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
