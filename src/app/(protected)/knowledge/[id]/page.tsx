import { AlertCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Alert, Container } from '@mantine/core';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getCurrentUser } from '@/lib/supabase/server';
import { DocumentDetailClient } from './DocumentDetailClient';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to view this document.
        </Alert>
      </Container>
    );
  }

  const documentService = getDocumentService();
  const doc = await documentService.findById(id);

  if (!doc || doc.userId !== user.id) {
    notFound();
  }

  const chunks = await documentService.getChunks(id);

  // Serialize for client: convert Date to string
  const serializedDoc = {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
  };

  return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
}
