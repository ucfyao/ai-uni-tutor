import { notFound } from 'next/navigation';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
import { requireAnyAdmin } from '@/lib/supabase/server';
import { ExamDetailClient } from './ExamDetailClient';

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAnyAdmin();
  const examRepo = getExamPaperRepository();
  const paper = await examRepo.findById(id);
  if (!paper) notFound();
  const questions = await examRepo.findQuestionsByPaperId(id);
  return <ExamDetailClient paper={paper} questions={questions} />;
}
