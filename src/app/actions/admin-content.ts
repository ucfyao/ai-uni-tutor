'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDocumentProcessingService } from '@/lib/services/DocumentProcessingService';
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

    // Process document via DocumentProcessingService (mechanical chunking for admin)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const processingService = getDocumentProcessingService();

    try {
      await processingService.processWithChunking({
        documentId: doc.id,
        buffer,
      });
    } catch (e) {
      console.error('Error processing document:', e);
      const msg = e instanceof Error ? e.message : 'Failed to process document';
      await documentService.updateStatus(doc.id, 'error', msg);
      revalidatePath('/admin/content');
      return { status: 'error', message: msg };
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
