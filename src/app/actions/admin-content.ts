'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { CreateDocumentChunkDTO } from '@/lib/domain/models/Document';
import { parsePDF } from '@/lib/pdf';
import { generateEmbedding } from '@/lib/rag/embedding';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getExamPaperService } from '@/lib/services/ExamPaperService';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type { ExamPaper } from '@/types/exam';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AdminDocument = Database['public']['Tables']['documents']['Row'];

export type AdminUploadState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

/* ------------------------------------------------------------------ */
/*  Read helpers                                                       */
/* ------------------------------------------------------------------ */

/** Fetch ALL documents (admin – no user_id filter). */
export async function getAdminDocuments(): Promise<AdminDocument[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch admin documents:', error.message);
    return [];
  }
  return data ?? [];
}

/** Fetch ALL exam papers (admin). */
export async function getAdminExamPapers(): Promise<ExamPaper[]> {
  const user = await getCurrentUser();
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

    const user = await getCurrentUser();
    if (!user) {
      return { status: 'error', message: 'Unauthorized' };
    }

    /* ---- If it is an exam paper, delegate to the exam paper service ---- */
    if (docType === 'exam') {
      const buffer = Buffer.from(await file.arrayBuffer());
      const examService = getExamPaperService();
      await examService.parsePaper(buffer, file.name, {
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
    const supabase = await createClient();

    // Insert directly to include doc_type and course_id columns
    const { data: doc, error: insertErr } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        name: file.name,
        status: 'processing' as const,
        doc_type: docType,
        course_id: course ?? null,
        metadata: { school: school || 'Unspecified', course: course || 'General' },
      })
      .select()
      .single();

    if (insertErr || !doc) {
      return { status: 'error', message: `Failed to create document: ${insertErr?.message}` };
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
      const documentService = getDocumentService();
      await documentService.updateStatus(doc.id, 'error', 'Failed to parse PDF');
      revalidatePath('/admin/content');
      return { status: 'error', message: 'Failed to parse PDF content' };
    }

    // Chunk Text
    const { chunkPages } = await import('@/lib/rag/chunking');
    const chunks = await chunkPages(pdfData.pages);

    // Generate Embeddings & Store Chunks
    const documentService = getDocumentService();
    const chunksData: CreateDocumentChunkDTO[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (chunk) => {
          const embedding = await generateEmbedding(chunk.content);
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
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const supabase = await createClient();

  if (type === 'exam') {
    const service = getExamPaperService();
    await service.deletePaper(id);
  } else {
    // Admin delete – no user_id check
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete document: ${error.message}`);
  }

  revalidatePath('/admin/content');
  revalidatePath('/knowledge');
  revalidatePath('/exam');
}
