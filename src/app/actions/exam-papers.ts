'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { QuotaExceededError } from '@/lib/errors';
import { getExamPaperService } from '@/lib/services/ExamPaperService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { FormActionState } from '@/types/actions';
import type { ExamPaper, PaperFilters } from '@/types/exam';

export type ExamPaperUploadState = FormActionState & { paperId?: string };

const uploadSchema = z.object({
  file: z.instanceof(File),
  school: z.string().trim().max(100).optional(),
  course: z.string().trim().max(100).optional(),
  year: z.string().trim().max(50).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

export async function uploadAndParseExamPaper(
  prevState: ExamPaperUploadState,
  formData: FormData,
): Promise<ExamPaperUploadState> {
  try {
    const parsed = uploadSchema.safeParse({
      file: formData.get('file'),
      school: formData.get('school') || undefined,
      course: formData.get('course') || undefined,
      year: formData.get('year') || undefined,
      visibility: formData.get('visibility') || undefined,
    });

    if (!parsed.success) {
      return { status: 'error', message: 'Invalid upload data' };
    }

    const { file, ...options } = parsed.data;

    if (file.type !== 'application/pdf') {
      return { status: 'error', message: 'Only PDF files are supported' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { status: 'error', message: 'Unauthorized' };
    }

    // Enforce AI quota before calling Gemini
    await getQuotaService().enforce(user.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const service = getExamPaperService();
    const { paperId } = await service.parsePaper(user.id, buffer, file.name, options);

    revalidatePath('/exam');
    return { status: 'success', message: 'Exam paper parsed successfully', paperId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { status: 'error', message: error.message };
    }
    console.error('Exam paper upload error:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to parse exam paper',
    };
  }
}

export async function getExamPaperList(filters?: PaperFilters): Promise<ExamPaper[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const service = getExamPaperService();
  const { data } = await service.getPapers(filters);
  return data;
}

export async function deleteExamPaper(paperId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const service = getExamPaperService();
  await service.deletePaper(user.id, paperId);
  revalidatePath('/exam');
}
