import AssignmentClient from './AssignmentClient';

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentClient key={id} id={id} />;
}
