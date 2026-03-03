'use server';

import { revalidatePath } from 'next/cache';
import { mapError } from '@/lib/errors';
import { getMockExamService } from '@/lib/services/MockExamService';
import { getQuotaService } from '@/lib/services/QuotaService';
import { getCurrentUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';
import type { BatchSubmitResult, ExamPaper, MockExam, MockExamResponse } from '@/types/exam';

export async function generateMockFromTopic(
  topic: string,
  numQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  questionTypes: string[],
  mode: 'practice' | 'exam' = 'practice',
): Promise<ActionResult<{ mockId: string }>> {
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

    const service = getMockExamService();
    const { mockId } = await service.createMockStub(user.id, {
      topic: topic.trim(),
      numQuestions,
      difficulty,
      questionTypes,
      mode,
    });

    revalidatePath('/exam');
    return { success: true, data: { mockId } };
  } catch (error) {
    return mapError(error);
  }
}

export async function populateMockFromPaper(
  mockId: string,
  paperId: string,
  mode: 'practice' | 'exam',
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!mockId.trim()) return { success: false, error: 'Mock ID is required' };
    if (!paperId.trim()) return { success: false, error: 'Paper ID is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    await service.populateFromPaper(user.id, mockId.trim(), paperId.trim(), mode);

    revalidatePath(`/exam/${mockId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function populateMockRandomMix(
  mockId: string,
  courseCode: string,
  numQuestions: number,
  mode: 'practice' | 'exam',
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!mockId.trim()) return { success: false, error: 'Mock ID is required' };
    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };
    if (![5, 10, 15, 20].includes(numQuestions)) {
      return { success: false, error: 'Number of questions must be 5, 10, 15, or 20' };
    }
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    await service.populateRandomMix(user.id, mockId.trim(), courseCode.trim(), numQuestions, mode);

    revalidatePath(`/exam/${mockId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function generateMockQuestions(
  mockId: string,
  topic: string,
  numQuestions: number,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
  questionTypes: string[],
  mode?: 'practice' | 'exam',
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    await service.generateQuestionsFromTopic(user.id, mockId, {
      topic,
      numQuestions,
      difficulty,
      questionTypes,
      mode,
    });

    revalidatePath(`/exam/${mockId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function submitMockAnswer(
  mockId: string,
  questionIndex: number,
  userAnswer: string,
): Promise<ActionResult<{ feedback: MockExamResponse }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const feedback = await service.submitAnswer(user.id, mockId, questionIndex, userAnswer);

    return { success: true, data: { feedback } };
  } catch (error) {
    return mapError(error);
  }
}

export async function batchSubmitMockAnswers(
  mockId: string,
  answers: Array<{ questionIndex: number; userAnswer: string }>,
): Promise<ActionResult<{ result: BatchSubmitResult }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const result = await service.batchSubmitAnswers(user.id, mockId, answers);

    return { success: true, data: { result } };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMockExamIdBySessionId(
  sessionId: string,
): Promise<ActionResult<string | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const mockId = await service.getMockIdBySessionId(sessionId, user.id);
    return { success: true, data: mockId };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMockExamDetail(
  mockId: string,
): Promise<ActionResult<MockExam | null>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const mock = await service.getMock(user.id, mockId);
    return { success: true, data: mock };
  } catch (error) {
    return mapError(error);
  }
}

export async function getExamPapersForCourse(
  courseCode: string,
): Promise<ActionResult<ExamPaper[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };

    const service = getMockExamService();
    const papers = await service.getPapersForCourse(courseCode.trim());

    return { success: true, data: papers };
  } catch (error) {
    return mapError(error);
  }
}

export async function createRealExamMock(
  paperId: string,
  mode: 'practice' | 'exam',
): Promise<ActionResult<{ mockId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!paperId.trim()) return { success: false, error: 'Paper ID is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    const { mockId } = await service.createFromPaper(user.id, paperId.trim(), mode);

    revalidatePath('/exam');
    return { success: true, data: { mockId } };
  } catch (error) {
    return mapError(error);
  }
}

export async function createRandomMixMock(
  courseCode: string,
  numQuestions: number,
  mode: 'practice' | 'exam',
): Promise<ActionResult<{ mockId: string }>> {
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
    return { success: true, data: { mockId } };
  } catch (error) {
    return mapError(error);
  }
}

export async function getMockExamList(filters?: {
  mode?: 'practice' | 'exam';
}): Promise<ActionResult<{ inProgress: MockExam[]; completed: MockExam[] }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const service = getMockExamService();
    const result = await service.getMockExamList(user.id, filters);

    return { success: true, data: result };
  } catch (error) {
    const isDynamicServerUsage =
      error instanceof Error && error.message.includes('Dynamic server usage');
    if (!isDynamicServerUsage) {
      console.error('Fetch mock exam list error:', error);
    }
    return mapError(error);
  }
}

export async function retakeMockExam(
  originalMockId: string,
): Promise<ActionResult<{ mockId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!originalMockId.trim()) return { success: false, error: 'Mock ID is required' };

    const service = getMockExamService();
    const { mockId } = await service.retakeMock(user.id, originalMockId.trim());

    revalidatePath('/exam');
    return { success: true, data: { mockId } };
  } catch (error) {
    return mapError(error);
  }
}

export async function createStandaloneMock(
  title: string,
  mode: 'practice' | 'exam',
  courseId: string,
  courseCode: string,
): Promise<ActionResult<{ mockId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseId.trim()) return { success: false, error: 'Course is required' };

    const service = getMockExamService();
    const { mockId } = await service.createMinimalStub(
      user.id,
      null,
      title || 'Mock Exam',
      courseId,
      courseCode || null,
      mode,
    );

    revalidatePath('/exam');
    return { success: true, data: { mockId } };
  } catch (error) {
    return mapError(error);
  }
}

export async function deleteMockExam(
  mockId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!mockId.trim()) return { success: false, error: 'Mock ID is required' };

    const service = getMockExamService();
    await service.deleteMock(user.id, mockId);

    revalidatePath('/exam');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
