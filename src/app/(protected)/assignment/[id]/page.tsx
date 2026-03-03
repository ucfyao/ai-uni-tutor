import { getChatSession } from '@/app/actions/chat';
import AssignmentClient from './AssignmentClient';

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getChatSession(id);
  const session = result.success ? result.data : null;

  return <AssignmentClient key={id} id={id} initialSession={session} />;
}
