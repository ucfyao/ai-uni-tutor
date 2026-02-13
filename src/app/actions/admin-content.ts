'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { parsePDF } from '@/lib/pdf';
import { generateEmbeddingWithRetry } from '@/lib/rag/embedding';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getExamPaperService } from '@/lib/services/ExamPaperService';
import { requireAdmin } from '@/lib/supabase/server';
import type { FormActionState } from '@/types/actions';
import type { Database } from '@/types/database';
import type { ExamPaper } from '@/types/exam';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AdminDocument = Database['public']['Tables']['documents']['Row'];

export type AdminUploadState = FormActionState;

/* ------------------------------------------------------------------ */
/*  Read helpers                                                       */
/* ------------------------------------------------------------------ */

/** Fetch ALL documents (admin – no user_id filter). */
export async function getAdminDocuments(): Promise<AdminDocument[]> {
  const user = await requireAdmin().catch(() => null);
  if (!user) return [];

  try {
    const documentService = getDocumentService();
    const docs = await documentService.getAdminDocuments();
    return docs as unknown as AdminDocument[];
  } catch (error) {
    console.error('Failed to fetch admin documents:', error);
    return [];
  }
}

/** Fetch ALL exam papers (admin). */
export async function getAdminExamPapers(): Promise<ExamPaper[]> {
  const user = await requireAdmin().catch(() => null);
  if (!user) return [];

  const service = getExamPaperService();
  return service.getPapers();
}

/* ------------------------------------------------------------------ */
/*  Upload                                                             */
/* ------------------------------------------------------------------ */

const uploadSchema = z.object({
  file: z.instanceof(File),
  docType: z.enum(['lecture', 'exam', 'assignment']),
  course: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  school: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  year: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(50).optional(),
  ),
});

export async function uploadAdminContent(
  prevState: AdminUploadState,
  formData: FormData,
): Promise<AdminUploadState> {
  try {
    const parsed = uploadSchema.safeParse({
      file: formData.get('file'),
      docType: formData.get('docType'),
      course: formData.get('course'),
      school: formData.get('school'),
      year: formData.get('year'),
    });

    if (!parsed.success) {
      return { status: 'error', message: 'Invalid upload data' };
    }

    const { file, docType, course, school, year } = parsed.data;

    if (file.type !== 'application/pdf') {
      return { status: 'error', message: 'Only PDF files are supported' };
    }

    const user = await requireAdmin().catch(() => null);
    if (!user) {
      return { status: 'error', message: 'Admin access required' };
    }

    /* ---- If it is an exam paper, delegate to the exam paper service ---- */
    if (docType === 'exam') {
      const buffer = Buffer.from(await file.arrayBuffer());
      const examService = getExamPaperService();
      await examService.parsePaper(user.id, buffer, file.name, {
        school,
        course,
        year,
        visibility: 'public',
      });

      revalidatePath('/admin/content');
      revalidatePath('/exam');
      return { status: 'success', message: 'Exam paper uploaded & parsing started' };
    }

    /* ---- Otherwise, create a document with doc_type & course_id ---- */
    const documentService = getDocumentService();

    let doc;
    try {
      doc = await documentService.createDocument(
        user.id,
        file.name,
        { school: school || 'Unspecified', course: course || 'General' },
        docType,
        course ?? undefined,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return { status: 'error', message: `Failed to create document: ${msg}` };
    }

    revalidatePath('/admin/content');
    revalidatePath('/knowledge');

    // Parse PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pdfData;
    try {
      pdfData = await parsePDF(buffer);
    } catch (e) {
      console.error('Error parsing PDF:', e);
      await documentService.updateStatus(doc.id, 'error', 'Failed to parse PDF');
      revalidatePath('/admin/content');
      return { status: 'error', message: 'Failed to parse PDF content' };
    }

    // Chunk Text
    const { chunkPages } = await import('@/lib/rag/chunking');
    const chunks = await chunkPages(pdfData.pages);

    // Generate Embeddings & Store Chunks
    const chunksData: CreateDocumentChunkDTO[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await generateEmbeddingWithRetry(chunk.content);
          chunksData.push({
            documentId: doc.id,
            content: chunk.content,
            embedding,
            metadata: chunk.metadata,
          });
        }),
      );
    }

    if (chunksData.length > 0) {
      try {
        await documentService.saveChunks(chunksData);
      } catch {
        await documentService.updateStatus(doc.id, 'error', 'Failed to save chunks');
        revalidatePath('/admin/content');
        return { status: 'error', message: 'Failed to save document chunks' };
      }
    }

    await documentService.updateStatus(doc.id, 'ready');
    revalidatePath('/admin/content');
    revalidatePath('/knowledge');
    return { status: 'success', message: 'Document processed successfully' };
  } catch (error) {
    console.error('Admin content upload error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to upload content',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

export async function deleteAdminContent(id: string, type: 'document' | 'exam') {
  await requireAdmin();

  if (type === 'exam') {
    const service = getExamPaperService();
    await service.deleteByAdmin(id);
  } else {
    const documentService = getDocumentService();
    await documentService.deleteByAdmin(id);
  }

  revalidatePath('/admin/content');
  revalidatePath('/knowledge');
  revalidatePath('/exam');
}
