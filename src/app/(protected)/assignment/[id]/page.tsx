import { notFound } from 'next/navigation';
import { getChatSession } from '@/app/actions/chat';
import AssignmentClient from './AssignmentClient';

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getChatSession(id);

  if (!session) {
    notFound();
  }

  return <AssignmentClient id={id} initialSession={session} />;
}
