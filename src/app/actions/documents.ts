'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { QuotaExceededError } from '@/lib/errors';
import { parsePDF } from '@/lib/pdf';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { FormActionState } from '@/types/actions';
import type { Json } from '@/types/database';

export type UploadState = FormActionState;

export interface DocumentListItem {
  id: string;
  name: string;
  status: string;
  status_message: string | null;
  created_at: string;
  doc_type: string;
  metadata: { school?: string; course?: string; [key: string]: unknown } | null;
}

const docTypeSchema = z.enum(['lecture', 'exam', 'assignment']);

export async function fetchDocuments(docType: string): Promise<DocumentListItem[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) throw new Error('Invalid document type');

  const service = getDocumentService();
  const entities = await service.getDocumentsByType(user.id, parsed.data);

  return entities.map((doc) => ({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    status_message: doc.statusMessage,
    created_at: doc.createdAt.toISOString(),
    doc_type: doc.docType ?? 'lecture',
    metadata:
      doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as DocumentListItem['metadata'])
        : null,
  }));
}

const uploadSchema = z.object({
  file: z.instanceof(File),
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

export async function uploadDocument(
  prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  let docId: string | undefined;
  try {
    const parsed = uploadSchema.safeParse({
      file: formData.get('file'),
      doc_type: formData.get('doc_type') || undefined,
      school: formData.get('school'),
      course: formData.get('course'),
      has_answers: formData.get('has_answers'),
    });
    if (!parsed.success) {
      return { status: 'error', message: 'Invalid upload data' };
    }

    const { file, doc_type, school, course, has_answers } = parsed.data;

    if (file.type !== 'application/pdf') {
      return { status: 'error', message: 'Only PDF files are supported currently' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { status: 'error', message: 'Unauthorized' };
    }

    const documentService = getDocumentService();

    // Enforce AI quota before processing (embedding generation uses Gemini)
    await getQuotaService().enforce(user.id);

    // Check for duplicates
    const isDuplicate = await documentService.checkDuplicate(user.id, file.name);
    if (isDuplicate) {
      return { status: 'error', message: `File "${file.name}" already exists.` };
    }

    // 1. Create Document Entry (Processing)
    const doc = await documentService.createDocument(
      user.id,
      file.name,
      {
        school: school || 'Unspecified',
        course: course || 'General',
      },
      doc_type,
    );
    docId = doc.id;

    revalidatePath('/knowledge');

    // 2. Parse PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pdfData;
    try {
      pdfData = await parsePDF(buffer);
    } catch (e) {
      console.error('Error parsing PDF:', e);
      await documentService.updateStatus(doc.id, 'error', 'Failed to parse PDF');
      revalidatePath('/knowledge');
      return { status: 'error', message: 'Failed to parse PDF content' };
    }

    // Check for empty PDF
    const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
    if (totalText.length === 0) {
      await documentService.updateStatus(doc.id, 'error', 'PDF contains no extractable text');
      revalidatePath('/knowledge');
      return { status: 'error', message: 'PDF contains no extractable text' };
    }

    await documentService.updateStatus(doc.id, 'processing', 'Parsing PDF...');
    revalidatePath('/knowledge');

    // 3. Parse content based on doc_type
    const chunksData: CreateDocumentChunkDTO[] = [];

    await documentService.updateStatus(doc.id, 'processing', 'Extracting content...');
    revalidatePath('/knowledge');

    try {
      if (doc_type === 'lecture') {
        // Lecture: Extract structured knowledge points via LLM
        const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
        const knowledgePoints = await parseLecture(pdfData.pages);

        for (const kp of knowledgePoints) {
          const content = [
            kp.title,
            kp.definition,
            kp.keyFormulas?.length ? `Formulas: ${kp.keyFormulas.join('; ')}` : '',
            kp.keyConcepts?.length ? `Concepts: ${kp.keyConcepts.join(', ')}` : '',
            kp.examples?.length ? `Examples: ${kp.examples.join('; ')}` : '',
          ]
            .filter(Boolean)
            .join('\n');
          const embedding = await generateEmbeddingWithRetry(content);
          chunksData.push({
            documentId: doc.id,
            content,
            embedding,
            metadata: { type: 'knowledge_point', ...kp },
          });
        }
      } else {
        // Exam / Assignment: Extract structured questions via LLM
        const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
        const questions = await parseQuestions(pdfData.pages, has_answers);

        for (const q of questions) {
          const content = [
            `Q${q.questionNumber}: ${q.content}`,
            q.options?.length ? `Options: ${q.options.join(' | ')}` : '',
            q.referenceAnswer ? `Answer: ${q.referenceAnswer}` : '',
          ]
            .filter(Boolean)
            .join('\n');
          const embedding = await generateEmbeddingWithRetry(content);
          chunksData.push({
            documentId: doc.id,
            content,
            embedding,
            metadata: { type: 'question', ...q },
          });
        }
      }
    } catch (e) {
      console.error('Error during content extraction:', e);
      // Clean up any partially created chunks
      try {
        await documentService.deleteChunksByDocumentId(doc.id);
      } catch {
        /* ignore cleanup errors */
      }
      await documentService.updateStatus(doc.id, 'error', 'Failed to extract content from PDF');
      revalidatePath('/knowledge');
      return { status: 'error', message: 'Failed to extract content from PDF' };
    }

    // 4. Save chunks
    await documentService.updateStatus(doc.id, 'processing', 'Generating embeddings & saving...');
    revalidatePath('/knowledge');

    if (chunksData.length > 0) {
      try {
        await documentService.saveChunks(chunksData);
      } catch {
        await documentService.updateStatus(doc.id, 'error', 'Failed to save chunks');
        revalidatePath('/knowledge');
        return { status: 'error', message: 'Failed to save document chunks' };
      }
    }

    // 5. Update Document Status
    await documentService.updateStatus(doc.id, 'ready');

    revalidatePath('/knowledge');
    return { status: 'success', message: 'Document processed successfully' };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { status: 'error', message: error.message };
    }
    console.error('Upload error:', error);
    if (docId) {
      try {
        const documentService = getDocumentService();
        await documentService.deleteChunksByDocumentId(docId);
        await documentService.updateStatus(docId, 'error', 'Upload failed unexpectedly');
        revalidatePath('/knowledge');
      } catch {
        /* ignore cleanup errors */
      }
    }
    return { status: 'error', message: 'Internal server error during upload' };
  }
}

export async function deleteDocument(documentId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const documentService = getDocumentService();
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/knowledge');
}

export async function updateDocumentChunks(
  documentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  for (const id of deletedIds) {
    await documentService.deleteChunk(id);
  }
  for (const update of updates) {
    await documentService.updateChunk(update.id, update.content, update.metadata as Json);
  }

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Changes saved' };
}

export async function regenerateEmbeddings(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  await documentService.updateStatus(doc.id, 'processing', 'Regenerating embeddings...');
  revalidatePath(`/knowledge/${documentId}`);

  try {
    const chunks = await documentService.getChunks(documentId);
    for (const chunk of chunks) {
      const embedding = await generateEmbeddingWithRetry(chunk.content);
      await documentService.updateChunkEmbedding(chunk.id, embedding);
    }
    await documentService.updateStatus(doc.id, 'ready');
  } catch (e) {
    console.error('Error regenerating embeddings:', e);
    await documentService.updateStatus(doc.id, 'error', 'Failed to regenerate embeddings');
  }

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Embeddings regenerated' };
}

export async function retryDocument(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  await documentService.deleteChunksByDocumentId(documentId);
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/knowledge');
  return { status: 'success', message: 'Document removed. Please re-upload.' };
}

export async function updateDocumentMeta(
  documentId: string,
  updates: { name?: string; school?: string; course?: string },
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  const metadataUpdates: { name?: string; metadata?: Json; docType?: string } = {};
  if (updates.name) metadataUpdates.name = updates.name;
  if (updates.school || updates.course) {
    const existingMeta = (doc.metadata as Record<string, unknown>) ?? {};
    metadataUpdates.metadata = {
      ...existingMeta,
      ...(updates.school && { school: updates.school }),
      ...(updates.course && { course: updates.course }),
    } as Json;
  }

  await documentService.updateDocumentMetadata(documentId, metadataUpdates);

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Document updated' };
}
