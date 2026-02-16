import { AlertCircle } from 'lucide-react';
import { Alert, Container } from '@mantine/core';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getCurrentUser } from '@/lib/supabase/server';
import { KnowledgeClient } from './KnowledgeClient';

const DEFAULT_DOC_TYPE = 'lecture';

export default async function KnowledgePage() {
  // AdminLayout already enforces auth + admin role
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to view the knowledge base.
        </Alert>
      </Container>
    );
  }

  const service = getDocumentService();
  const entities = await service.getDocumentsByType(user.id, DEFAULT_DOC_TYPE);

  const initialDocuments = entities.map((doc) => ({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    status_message: doc.statusMessage,
    created_at: doc.createdAt.toISOString(),
    doc_type: doc.docType ?? DEFAULT_DOC_TYPE,
    metadata:
      doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as { school?: string; course?: string; [key: string]: unknown } | null)
        : null,
  }));

  return <KnowledgeClient initialDocuments={initialDocuments} initialDocType={DEFAULT_DOC_TYPE} />;
}
