'use server';

import { z } from 'zod';
import { ForbiddenError } from '@/lib/errors';
import { requireAnyAdmin, requireCourseAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type { ExamQuestion } from '@/types/exam';

// ── Access control ──

async function requireExamAccess(
  paperId: string,
  _userId: string,
  role: string,
): Promise<void> {
  if (role === 'super_admin') return;
  const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
  const examRepo = getExamPaperRepository();
  const courseId = await examRepo.findCourseId(paperId);
  if (courseId) {
    await requireCourseAdmin(courseId);
  } else {
    throw new ForbiddenError('No access to this exam paper');
  }
}

// ── Schemas ──

const renameSchema = z.object({
  paperId: z.string().uuid(),
  title: z.string().min(1).max(255),
});

const fetchQuestionsSchema = z.object({
  paperId: z.string().uuid(),
});

const updateQuestionSchema = z.object({
  paperId: z.string().uuid(),
  questionId: z.string().uuid(),
  content: z.string().optional(),
  answer: z.string().optional(),
  explanation: z.string().optional(),
  points: z.number().min(0).optional(),
  type: z.string().optional(),
  options: z.record(z.string(), z.string()).nullable().optional(),
  orderNum: z.number().int().min(1).optional(),
});

const deleteQuestionSchema = z.object({
  paperId: z.string().uuid(),
  questionId: z.string().uuid(),
});

// ── Actions ──

export async function renameExamPaper(
  input: z.infer<typeof renameSchema>,
): Promise<ActionResult<void>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = renameSchema.parse(input);
    await requireExamAccess(parsed.paperId, user.id, role);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    await examRepo.updatePaper(parsed.paperId, { title: parsed.title });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('renameExamPaper error:', error);
    return { success: false, error: 'Failed to rename exam paper' };
  }
}

export async function fetchExamQuestions(
  input: z.infer<typeof fetchQuestionsSchema>,
): Promise<ActionResult<ExamQuestion[]>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = fetchQuestionsSchema.parse(input);
    await requireExamAccess(parsed.paperId, user.id, role);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const questions = await examRepo.findQuestionsByPaperId(parsed.paperId);

    return { success: true, data: questions };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    console.error('fetchExamQuestions error:', error);
    return { success: false, error: 'Failed to fetch questions' };
  }
}

export async function updateSingleExamQuestion(
  input: z.infer<typeof updateQuestionSchema>,
): Promise<ActionResult<void>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = updateQuestionSchema.parse(input);
    await requireExamAccess(parsed.paperId, user.id, role);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();

    // IDOR check: verify questionId belongs to paperId
    const questions = await examRepo.findQuestionsByPaperId(parsed.paperId);
    const belongsToPaper = questions.some((q) => q.id === parsed.questionId);
    if (!belongsToPaper) {
      return { success: false, error: 'Question does not belong to this paper' };
    }

    const { paperId: _, questionId: __, ...fields } = parsed;
    await examRepo.updateQuestion(parsed.questionId, fields);

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('updateSingleExamQuestion error:', error);
    return { success: false, error: 'Failed to update question' };
  }
}

export async function deleteExamQuestion(
  input: z.infer<typeof deleteQuestionSchema>,
): Promise<ActionResult<void>> {
  try {
    const { user, role } = await requireAnyAdmin();
    const parsed = deleteQuestionSchema.parse(input);
    await requireExamAccess(parsed.paperId, user.id, role);

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();

    // IDOR check: verify questionId belongs to paperId
    const questions = await examRepo.findQuestionsByPaperId(parsed.paperId);
    const belongsToPaper = questions.some((q) => q.id === parsed.questionId);
    if (!belongsToPaper) {
      return { success: false, error: 'Question does not belong to this paper' };
    }

    await examRepo.deleteQuestion(parsed.questionId);

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof ForbiddenError) return { success: false, error: 'No access' };
    if (error instanceof z.ZodError) return { success: false, error: 'Invalid input' };
    console.error('deleteExamQuestion error:', error);
    return { success: false, error: 'Failed to delete question' };
  }
}
