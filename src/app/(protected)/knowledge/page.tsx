import { AlertCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Alert, Box, Container } from '@mantine/core';
import { getDocumentService } from '@/lib/services/DocumentService';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { KnowledgeClient } from './KnowledgeClient';

const DEFAULT_DOC_TYPE = 'lecture';

export default async function KnowledgePage() {
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

  const supabase = await createClient();

  // Admin redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') {
    redirect('/admin/content');
  }

  // Fetch initial documents for default tab via service layer
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

  return (
    <Container size="md" py={48} style={{ position: 'relative' }}>
      <Box
        style={{
          position: 'absolute',
          top: -40,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 200,
          background:
            'radial-gradient(ellipse at center, var(--mantine-color-indigo-0) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.7,
        }}
      />
      <Box style={{ position: 'relative', zIndex: 1 }}>
        <KnowledgeClient initialDocuments={initialDocuments} initialDocType={DEFAULT_DOC_TYPE} />
      </Box>
    </Container>
  );
}
