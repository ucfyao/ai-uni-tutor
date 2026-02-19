import { notFound } from 'next/navigation';
import { getAssignmentRepository } from '@/lib/repositories/AssignmentRepository';
import { requireAnyAdmin } from '@/lib/supabase/server';
import { AssignmentDetailClient } from './AssignmentDetailClient';

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyAdmin();
  const assignmentRepo = getAssignmentRepository();
  const assignment = await assignmentRepo.findById(id);
  if (!assignment) notFound();
  const items = await assignmentRepo.findItemsByAssignmentId(id);
  return <AssignmentDetailClient assignment={assignment} items={items} />;
}
