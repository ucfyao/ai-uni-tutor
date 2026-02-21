import { notFound } from 'next/navigation';
import { getAssignmentService } from '@/lib/services/AssignmentService';
import { requireAnyAdmin } from '@/lib/supabase/server';
import { AssignmentDetailClient } from './AssignmentDetailClient';

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyAdmin();
  const service = getAssignmentService();
  const assignment = await service.findById(id);
  if (!assignment) notFound();
  const items = await service.getItems(id);
  return <AssignmentDetailClient assignment={assignment} initialItems={items} />;
}
