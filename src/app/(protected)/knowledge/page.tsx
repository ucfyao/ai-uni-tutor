import { AlertCircle } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Alert, Box, Container, Stack, Text, Title } from '@mantine/core';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { KnowledgeClient, type KnowledgeDoc } from './KnowledgeClient';

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

  // Fetch all ready documents
  const { data: rows } = await supabase
    .from('documents')
    .select('id, name, doc_type, course_id')
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  const documents: KnowledgeDoc[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    doc_type: (r as { doc_type?: string }).doc_type ?? 'lecture',
    course_id: (r as { course_id?: string | null }).course_id ?? null,
  }));

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        <Box>
          <Title order={1} fw={800} mb={4}>
            Knowledge Base
          </Title>
          <Text c="dimmed" size="lg">
            Course materials available for your studies.
          </Text>
        </Box>

        <KnowledgeClient documents={documents} />
      </Stack>
    </Container>
  );
}
