'use server';

import { revalidatePath } from 'next/cache';
import { getMockExamService } from '@/lib/services/MockExamService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { MockExam, MockExamResponse } from '@/types/exam';

export async function generateMockExam(
  paperId: string,
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const { mockId } = await service.generateMock(paperId);

    revalidatePath('/exam');
    revalidatePath('/exam/history');
    return { success: true, mockId };
  } catch (error) {
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
    const feedback = await service.submitAnswer(mockId, questionIndex, userAnswer);

    return { success: true, feedback };
  } catch (error) {
    console.error('Submit answer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit answer',
    };
  }
}

export async function getMockExamDetail(mockId: string): Promise<MockExam | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const service = getMockExamService();
  return service.getMock(mockId);
}

export async function getMockExamList(): Promise<MockExam[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const service = getMockExamService();
  return service.getHistory();
}
