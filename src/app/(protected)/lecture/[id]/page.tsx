import { notFound } from 'next/navigation';
import { getChatSession } from '@/app/actions/chat';
import LectureClient from './LectureClient';

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getChatSession(id);

  if (!session) {
    notFound();
  }

  return <LectureClient id={id} initialSession={session} />;
}
