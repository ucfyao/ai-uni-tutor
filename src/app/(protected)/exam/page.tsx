import { getExamPaperList } from '@/app/actions/exam-papers';
import { getMockExamList } from '@/app/actions/mock-exams';
import { ExamEntryClient } from './ExamEntryClient';

export default async function ExamPage() {
  const [papers, mockExams] = await Promise.all([getExamPaperList(), getMockExamList()]);

  return <ExamEntryClient papers={papers} recentMocks={mockExams.slice(0, 5)} />;
}
