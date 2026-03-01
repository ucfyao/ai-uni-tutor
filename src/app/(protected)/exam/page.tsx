import { Suspense } from 'react';

import { getMockExamList } from '@/app/actions/mock-exams';
import { ExamHubClient } from './ExamHubClient';

export default async function ExamHubPage() {
  const result = await getMockExamList();

  const inProgress = result.success ? result.inProgress : [];
  const completed = result.success ? result.completed : [];

  return (
    <Suspense>
      <ExamHubClient initialInProgress={inProgress} initialCompleted={completed} />
    </Suspense>
  );
}
