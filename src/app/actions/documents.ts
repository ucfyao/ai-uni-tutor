'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ForbiddenError, QuotaExceededError } from '@/lib/errors';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import { getDocumentProcessingService } from '@/lib/services/DocumentProcessingService';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { requireAdmin } from '@/lib/supabase/server';
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
  const user = await requireAdmin();

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

    const user = await requireAdmin();

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

    revalidatePath('/admin/knowledge');

    // 2. Process document via DocumentProcessingService
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const processingService = getDocumentProcessingService();

    try {
      await processingService.processWithLLM({
        documentId: doc.id,
        buffer,
        docType: doc_type,
        hasAnswers: has_answers,
        callbacks: {
          onProgress: (stage, message) => {
            // Status updates are fire-and-forget for server actions
            documentService.updateStatus(doc.id, 'processing', message).catch(() => {});
          },
        },
      });
    } catch (e) {
      console.error('Error during document processing:', e);
      try {
        await documentService.deleteChunksByDocumentId(doc.id);
      } catch {
        /* ignore cleanup errors */
      }
      const msg = e instanceof Error ? e.message : 'Failed to process document';
      await documentService.updateStatus(doc.id, 'error', msg);
      revalidatePath('/admin/knowledge');
      return { status: 'error', message: msg };
    }

    // 3. Update Document Status
    await documentService.updateStatus(doc.id, 'ready');

    revalidatePath('/admin/knowledge');
    return { status: 'success', message: 'Document processed successfully' };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { status: 'error', message: 'Admin access required' };
    }
    if (error instanceof QuotaExceededError) {
      return { status: 'error', message: error.message };
    }
    console.error('Upload error:', error);
    if (docId) {
      try {
        const documentService = getDocumentService();
        await documentService.deleteChunksByDocumentId(docId);
        await documentService.updateStatus(docId, 'error', 'Upload failed unexpectedly');
        revalidatePath('/admin/knowledge');
      } catch {
        /* ignore cleanup errors */
      }
    }
    return { status: 'error', message: 'Internal server error during upload' };
  }
}

export async function deleteDocument(documentId: string) {
  const user = await requireAdmin();

  const documentService = getDocumentService();
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/admin/knowledge');
}

export async function updateDocumentChunks(
  documentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  // Verify all chunk IDs belong to this document (IDOR protection)
  const allChunkIds = [...deletedIds, ...updates.map((u) => u.id)];
  if (allChunkIds.length > 0) {
    const chunksValid = await documentService.verifyChunksBelongToDocument(allChunkIds, documentId);
    if (!chunksValid) {
      return { status: 'error', message: 'Invalid chunk IDs' };
    }
  }

  for (const id of deletedIds) {
    await documentService.deleteChunk(id);
  }
  for (const update of updates) {
    await documentService.updateChunk(update.id, update.content, update.metadata as Json);
  }

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}

export async function regenerateEmbeddings(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  await documentService.updateStatus(doc.id, 'processing', 'Regenerating embeddings...');
  revalidatePath(`/admin/knowledge/${documentId}`);

  try {
    const chunks = await documentService.getChunksWithEmbeddings(documentId);
    for (const chunk of chunks) {
      const embedding = await generateEmbeddingWithRetry(chunk.content);
      await documentService.updateChunkEmbedding(chunk.id, embedding, documentId);
    }
    await documentService.updateStatus(doc.id, 'ready');
  } catch (e) {
    console.error('Error regenerating embeddings:', e);
    await documentService.updateStatus(doc.id, 'error', 'Failed to regenerate embeddings');
  }

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Embeddings regenerated' };
}

export async function retryDocument(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  await documentService.deleteChunksByDocumentId(documentId);
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Document removed. Please re-upload.' };
}

const updateDocumentMetaSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  school: z.string().max(255).optional(),
  course: z.string().max(255).optional(),
});

export async function updateDocumentMeta(
  documentId: string,
  updates: { name?: string; school?: string; course?: string },
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const parsed = updateDocumentMetaSchema.safeParse(updates);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid input' };
  }
  const validatedUpdates = parsed.data;

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  const metadataUpdates: { name?: string; metadata?: Json; docType?: string } = {};
  if (validatedUpdates.name) metadataUpdates.name = validatedUpdates.name;
  if (validatedUpdates.school || validatedUpdates.course) {
    const existingMeta = (doc.metadata as Record<string, unknown>) ?? {};
    metadataUpdates.metadata = {
      ...existingMeta,
      ...(validatedUpdates.school && { school: validatedUpdates.school }),
      ...(validatedUpdates.course && { course: validatedUpdates.course }),
    } as Json;
  }

  await documentService.updateDocumentMetadata(documentId, metadataUpdates);

  revalidatePath(`/admin/knowledge/${documentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Document updated' };
}
