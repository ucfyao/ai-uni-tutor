'use server';

import { revalidatePath } from 'next/cache';
import { QuotaExceededError } from '@/lib/errors';
import { getMockExamService } from '@/lib/services/MockExamService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { BatchSubmitResult, MockExam, MockExamResponse } from '@/types/exam';

/**
 * Start a mock exam session: find an exam paper for the course, generate a mock, link to session.
 */
export async function startMockExamSession(
  sessionId: string,
  courseCode: string,
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const result = await service.startFromCourse(user.id, sessionId, courseCode);

    revalidatePath('/exam');
    revalidatePath('/exam/history');
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
    revalidatePath('/exam/history');
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
  paperId: string,
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const { mockId } = await service.generateMock(user.id, paperId);

    revalidatePath('/exam');
    revalidatePath('/exam/history');
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
  return service.getMockIdBySessionId(sessionId);
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
