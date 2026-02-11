import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import type { KnowledgePoint, ParsedQuestion } from '@/lib/rag/parsers/types';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { createSSEStream } from '@/lib/sse';
import { getCurrentUser } from '@/lib/supabase/server';

// [C2] Ensure this route runs on Node.js runtime and is never statically cached
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 3;
// [C1] Server-side file size limit (bytes)
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

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
  has_answers: z.preprocess(
    (value) => value === 'true' || value === true,
    z.boolean().optional().default(false),
  ),
});

function buildChunkContent(
  type: 'knowledge_point' | 'question',
  item: KnowledgePoint | ParsedQuestion,
): string {
  if (type === 'knowledge_point') {
    const kp = item as KnowledgePoint;
    return [
      kp.title,
      kp.definition,
      kp.keyFormulas?.length ? `Formulas: ${kp.keyFormulas.join('; ')}` : '',
      kp.keyConcepts?.length ? `Concepts: ${kp.keyConcepts.join(', ')}` : '',
      kp.examples?.length ? `Examples: ${kp.examples.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  const q = item as ParsedQuestion;
  return [
    `Q${q.questionNumber}: ${q.content}`,
    q.options?.length ? `Options: ${q.options.join(' | ')}` : '',
    q.referenceAnswer ? `Answer: ${q.referenceAnswer}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(request: Request) {
  const { stream, send, close } = createSSEStream();
  // [C3] Capture the request abort signal for client-disconnect awareness
  const signal = request.signal;

  // Start the async pipeline without awaiting (runs in background while streaming)
  const pipeline = (async () => {
    let docId: string | undefined;
    const documentService = getDocumentService();

    try {
      // ── Auth ──
      const user = await getCurrentUser();
      if (!user) {
        send('error', { message: 'Unauthorized', code: 'UNAUTHORIZED' });
        return;
      }

      // ── Quota ──
      try {
        await getQuotaService().enforce();
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
      if (file.size > MAX_FILE_SIZE) {
        send('error', { message: 'File too large', code: 'FILE_TOO_LARGE' });
        return;
      }

      const parsed = uploadSchema.safeParse({
        doc_type: formData.get('doc_type') || undefined,
        school: formData.get('school'),
        course: formData.get('course'),
        has_answers: formData.get('has_answers'),
      });
      if (!parsed.success) {
        send('error', { message: 'Invalid upload data', code: 'VALIDATION_ERROR' });
        return;
      }
      const { doc_type, school, course, has_answers } = parsed.data;

      // ── Duplicate check ──
      const isDuplicate = await documentService.checkDuplicate(user.id, file.name);
      if (isDuplicate) {
        send('error', { message: `File "${file.name}" already exists.`, code: 'DUPLICATE' });
        return;
      }

      // ── Create document record ──
      const doc = await documentService.createDocument(
        user.id,
        file.name,
        { school: school || 'Unspecified', course: course || 'General' },
        doc_type,
      );
      docId = doc.id;
      send('document_created', { documentId: doc.id });

      // ── Parse PDF ──
      send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });
      await documentService.updateStatus(doc.id, 'processing', 'Parsing PDF...');

      const arrayBuffer = await file.arrayBuffer();
      let buffer: Buffer | null = Buffer.from(arrayBuffer);

      // [I4] Validate PDF magic bytes before passing to parser
      if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        await documentService.updateStatus(doc.id, 'error', 'Invalid PDF file');
        send('error', { message: 'File is not a valid PDF', code: 'INVALID_FILE' });
        return;
      }

      let pdfData;
      try {
        pdfData = await parsePDF(buffer);
      } catch {
        await documentService.updateStatus(doc.id, 'error', 'Failed to parse PDF');
        send('error', { message: 'Failed to parse PDF content', code: 'PDF_PARSE_ERROR' });
        return;
      }
      // [I5] Release buffer reference to allow GC on large files
      buffer = null;

      const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
      if (totalText.length === 0) {
        await documentService.updateStatus(doc.id, 'error', 'PDF contains no extractable text');
        send('error', { message: 'PDF contains no extractable text', code: 'EMPTY_PDF' });
        return;
      }

      // [C3] Check abort before expensive LLM call
      if (signal.aborted) {
        await documentService.updateStatus(doc.id, 'error', 'Client disconnected');
        return;
      }

      // ── LLM Extraction ──
      send('status', { stage: 'extracting', message: 'AI extracting content...' });
      await documentService.updateStatus(doc.id, 'processing', 'Extracting content...');

      let items: Array<{
        type: 'knowledge_point' | 'question';
        data: KnowledgePoint | ParsedQuestion;
      }>;

      try {
        if (doc_type === 'lecture') {
          const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
          const knowledgePoints = await parseLecture(pdfData.pages);
          items = knowledgePoints.map((kp) => ({ type: 'knowledge_point' as const, data: kp }));
        } else {
          const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
          const questions = await parseQuestions(pdfData.pages, has_answers);
          items = questions.map((q) => ({ type: 'question' as const, data: q }));
        }
      } catch (e) {
        console.error('LLM extraction error:', e);
        await documentService.updateStatus(doc.id, 'error', 'Failed to extract content');
        send('error', { message: 'Failed to extract content from PDF', code: 'EXTRACTION_ERROR' });
        return;
      }

      const totalItems = items.length;
      if (totalItems === 0) {
        await documentService.updateStatus(doc.id, 'ready');
        send('progress', { current: 0, total: 0 });
        send('status', { stage: 'complete', message: 'No content extracted' });
        return;
      }

      // ── Stream items + batch save ──
      send('status', { stage: 'embedding', message: 'Generating embeddings & saving...' });
      await documentService.updateStatus(doc.id, 'processing', 'Generating embeddings & saving...');

      let batch: CreateDocumentChunkDTO[] = [];
      let batchIndex = 0;

      for (let i = 0; i < items.length; i++) {
        // [C3] Check abort at each iteration; save any pending batch before exiting
        if (signal.aborted) {
          if (batch.length > 0) {
            await documentService.saveChunksAndReturn(batch);
          }
          await documentService.updateStatus(doc.id, 'ready');
          return;
        }

        const { type, data } = items[i];

        // Send item to client
        send('item', { index: i, type, data });
        send('progress', { current: i + 1, total: totalItems });

        // Build chunk
        const content = buildChunkContent(type, data);
        const embedding = await generateEmbeddingWithRetry(content);
        batch.push({
          documentId: doc.id,
          content,
          embedding,
          metadata: { type, ...data },
        });

        // Save when batch is full or last item
        if (batch.length >= BATCH_SIZE || i === items.length - 1) {
          const savedChunks = await documentService.saveChunksAndReturn(batch);
          send('batch_saved', {
            chunkIds: savedChunks.map((c) => c.id),
            batchIndex,
          });
          batch = [];
          batchIndex++;
        }
      }

      // ── Complete ──
      await documentService.updateStatus(doc.id, 'ready');
      send('status', { stage: 'complete', message: `Done! ${totalItems} items extracted.` });
    } catch (error) {
      console.error('Parse pipeline error:', error);
      // [I3] Don't delete saved chunks on unexpected error — honor resilience guarantee
      if (docId) {
        try {
          await documentService.updateStatus(docId, 'error', 'Processing failed unexpectedly');
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
