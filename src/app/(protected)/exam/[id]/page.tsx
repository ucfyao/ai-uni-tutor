import { notFound } from 'next/navigation';
import { getChatSession } from '@/app/actions/chat';
import ExamClient from './ExamClient';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getChatSession(id);

  if (!session) {
    notFound();
  }

  return <ExamClient id={id} initialSession={session} />;
}
