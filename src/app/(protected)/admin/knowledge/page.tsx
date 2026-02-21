import { AlertCircle } from 'lucide-react';
import { Alert, Container } from '@mantine/core';
import { fetchDocuments } from '@/app/actions/documents';
import { getCurrentUser } from '@/lib/supabase/server';
import { KnowledgeClient } from './KnowledgeClient';

const DEFAULT_DOC_TYPE = 'lecture';
const VALID_TABS = new Set(['lecture', 'assignment', 'exam']);

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  // Respect ?tab= param so back navigation lands on the correct tab
  const params = await searchParams;
  const tabParam = typeof params.tab === 'string' ? params.tab : undefined;
  const docType = tabParam && VALID_TABS.has(tabParam) ? tabParam : DEFAULT_DOC_TYPE;

  // fetchDocuments already handles admin role filtering (super_admin sees all, admin sees assigned courses)
  const initialDocuments = await fetchDocuments(docType);

  return <KnowledgeClient initialDocuments={initialDocuments} initialDocType={docType} />;
}
