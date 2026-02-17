import { AlertCircle } from 'lucide-react';
import { Alert, Container } from '@mantine/core';
import { fetchDocuments } from '@/app/actions/documents';
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

  // fetchDocuments already handles admin role filtering (super_admin sees all, admin sees assigned courses)
  const initialDocuments = await fetchDocuments(DEFAULT_DOC_TYPE);

  return <KnowledgeClient initialDocuments={initialDocuments} initialDocType={DEFAULT_DOC_TYPE} />;
}
