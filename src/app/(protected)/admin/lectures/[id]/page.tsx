import { notFound } from 'next/navigation';
import { getLectureDocumentService } from '@/lib/services';
import { requireAnyAdmin } from '@/lib/supabase/server';
import { LectureDetailClient } from './LectureDetailClient';

export default async function LectureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAnyAdmin();
  const service = getLectureDocumentService();
  const doc = await service.findById(id);
  if (!doc) notFound();
  const chunks = await service.getChunks(id);

  return (
    <LectureDetailClient
      document={{ ...doc, createdAt: doc.createdAt.toISOString() }}
      chunks={chunks.map((c) => ({
        id: c.id,
        content: c.content,
        metadata: c.metadata,
        embedding: null,
      }))}
    />
  );
}
