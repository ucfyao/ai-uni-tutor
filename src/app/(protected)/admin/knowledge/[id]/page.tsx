import { redirect } from 'next/navigation';

export default async function LegacyDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  if (type === 'exam') redirect(`/admin/exams/${id}`);
  if (type === 'assignment') redirect(`/admin/assignments/${id}`);
  redirect(`/admin/lectures/${id}`);
}
