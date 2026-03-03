import { getChatSession } from '@/app/actions/chat';
import LectureClient from './LectureClient';

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getChatSession(id);
  const session = result.success ? result.data : null;

  return <LectureClient key={id} id={id} initialSession={session} />;
}
