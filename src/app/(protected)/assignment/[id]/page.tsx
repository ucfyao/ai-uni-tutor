import AssignmentClient from './AssignmentClient.tsx';

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentClient id={id} />;
}
