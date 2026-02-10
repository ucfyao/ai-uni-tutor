import { notFound } from 'next/navigation';
import { getMockExamDetail } from '@/app/actions/mock-exams';
import { MockExamClient } from './MockExamClient';

export default async function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mock = await getMockExamDetail(id);

  if (!mock) notFound();

  return <MockExamClient initialMock={mock} />;
}
