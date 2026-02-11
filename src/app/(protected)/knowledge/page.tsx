import { AlertCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Alert, Box, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { UploadButton } from './KnowledgeClient';

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

  // Fetch only documents uploaded by this user
  // Try with doc_type first; fall back to without it if column doesn't exist yet
  let rows: Record<string, unknown>[] | null = null;
  const { data: rowsWithType, error } = await supabase
    .from('documents')
    .select('id, name, status, status_message, created_at, metadata, doc_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    // doc_type column may not exist yet — query without it
    const { data: rowsBasic } = await supabase
      .from('documents')
      .select('id, name, status, status_message, created_at, metadata')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    rows = rowsBasic as Record<string, unknown>[] | null;
  } else {
    rows = rowsWithType as Record<string, unknown>[] | null;
  }

  const documents: KnowledgeDocument[] = (rows ?? []).map((doc) => ({
    id: doc.id as string,
    name: doc.name as string,
    status: doc.status as string,
    status_message: (doc.status_message as string) ?? null,
    created_at: doc.created_at as string,
    doc_type: (doc.doc_type as string) ?? 'lecture',
    metadata:
      doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as KnowledgeDocument['metadata'])
        : null,
  }));

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1} fw={800} mb={4}>
              Knowledge Base
            </Title>
            <Text c="dimmed" size="lg">
              Course materials and documents for your studies.
            </Text>
          </Box>
          <UploadButton />
        </Group>

        {documents.length > 0 ? (
          <Card withBorder radius="lg" p={0}>
            <KnowledgeTable documents={documents} />
          </Card>
        ) : (
          <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
            No documents available yet. Upload your first document to get started.
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
