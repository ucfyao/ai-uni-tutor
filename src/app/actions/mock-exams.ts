'use server';

import { revalidatePath } from 'next/cache';
import { QuotaExceededError } from '@/lib/errors';
import { getMockExamService } from '@/lib/services/MockExamService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { BatchSubmitResult, ExamPaper, MockExam, MockExamResponse } from '@/types/exam';

/**
 * Start a mock exam session: find an exam paper for the course, generate a mock, link to session.
 */
export async function startMockExamSession(
  sessionId: string,
  courseCode: string,
  mode: 'practice' | 'exam' = 'practice',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const result = await service.startFromCourse(user.id, sessionId, courseCode, mode);

    revalidatePath('/exam');
    return { success: true, mockId: result.mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Mock exam session start error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start mock exam',
    };
  }
}

export async function generateMockFromTopic(
  topic: string,
  numQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  questionTypes: string[],
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!topic.trim()) return { success: false, error: 'Topic is required' };
    if (![5, 10, 15, 20].includes(numQuestions)) {
      return { success: false, error: 'Number of questions must be 5, 10, 15, or 20' };
    }
    if (!['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) {
      return { success: false, error: 'Invalid difficulty level' };
    }

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const { mockId } = await service.generateFromTopic(user.id, {
      topic: topic.trim(),
      numQuestions,
      difficulty,
      questionTypes,
    });

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Topic-based mock exam generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate mock exam from topic',
    };
  }
}

export async function generateMockExam(
  courseCode: string,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const paperId = await service.findPaperByCourse(courseCode);
    if (!paperId) {
      return { success: false, error: 'No exam papers available for this course' };
    }
    const { mockId } = await service.generateMock(user.id, paperId, mode);

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Mock exam generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate mock exam',
    };
  }
}

export async function submitMockAnswer(
  mockId: string,
  questionIndex: number,
  userAnswer: string,
): Promise<{ success: true; feedback: MockExamResponse } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const feedback = await service.submitAnswer(user.id, mockId, questionIndex, userAnswer);

    return { success: true, feedback };
  } catch (error) {
    console.error('Submit answer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit answer',
    };
  }
}

export async function batchSubmitMockAnswers(
  mockId: string,
  answers: Array<{ questionIndex: number; userAnswer: string }>,
): Promise<{ success: true; result: BatchSubmitResult } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const result = await service.batchSubmitAnswers(user.id, mockId, answers);

    return { success: true, result };
  } catch (error) {
    console.error('Batch submit error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to batch submit answers',
    };
  }
}

export async function getMockExamIdBySessionId(sessionId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const service = getMockExamService();
  return service.getMockIdBySessionId(sessionId, user.id);
}

export async function getMockExamDetail(mockId: string): Promise<MockExam | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const service = getMockExamService();
  return service.getMock(user.id, mockId);
}

export async function getMockExamList(): Promise<MockExam[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const service = getMockExamService();
  return service.getHistory(user.id);
}

export async function getExamPapersForCourse(
  courseCode: string,
): Promise<{ success: true; papers: ExamPaper[] } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };

    const service = getMockExamService();
    const papers = await service.getPapersForCourse(courseCode.trim());

    return { success: true, papers };
  } catch (error) {
    console.error('Fetch papers for course error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch papers',
    };
  }
}

export async function createRealExamMock(
  paperId: string,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!paperId.trim()) return { success: false, error: 'Paper ID is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    const { mockId } = await service.createFromPaper(user.id, paperId.trim(), mode);

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Real exam mock creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create mock exam',
    };
  }
}

export async function createRandomMixMock(
  courseCode: string,
  numQuestions: number,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };
    if (![5, 10, 15, 20].includes(numQuestions)) {
      return { success: false, error: 'Number of questions must be 5, 10, 15, or 20' };
    }
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    const { mockId } = await service.createRandomMix(
      user.id,
      courseCode.trim(),
      numQuestions,
      mode,
    );

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Random mix mock creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create random mix exam',
    };
  }
}
