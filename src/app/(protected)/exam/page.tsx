import { getMockExamList } from '@/app/actions/mock-exams';
import type { MockExam } from '@/types/exam';
import { ExamHubClient } from './ExamHubClient';

export default async function ExamHubPage() {
  let inProgress: MockExam[] = [];
  let completed: MockExam[] = [];

  try {
    const result = await getMockExamList();
    if (result.success) {
      inProgress = result.inProgress;
      completed = result.completed;
    }
  } catch {
    // Silently handle build-time DYNAMIC_SERVER_USAGE errors
  }

  return <ExamHubClient initialInProgress={inProgress} initialCompleted={completed} />;
}
