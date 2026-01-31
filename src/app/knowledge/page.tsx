import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Container, Title, Text, Stack, Card, Group, ThemeIcon, Alert, Button, Box } from '@mantine/core';
import { FileUploader } from '@/components/rag/FileUploader';
import { KnowledgeTable } from '@/components/rag/KnowledgeTable';
import { Database, AlertCircle, BookOpen } from 'lucide-react';

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
        <Container size="md" py="xl">
            <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
                Please sign in to manage your knowledge base.
            </Alert>
        </Container>
    );
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Group justify="space-between">
            <Box>
                <Title order={1}>Knowledge Base</Title>
                <Text c="dimmed">Upload documents to personalize your AI tutor.</Text>
            </Box>
            <Link href="/" style={{ textDecoration: 'none' }}>
                <Button component="div" variant="subtle" leftSection={<BookOpen size={16} />}>
                    Back to Chat
                </Button>
            </Link>
        </Group>

        <Card withBorder radius="md" p="xl">
            <Stack>
                <Group>
                    <ThemeIcon variant="light" size="lg" radius="md">
                        <Database size={20} />
                    </ThemeIcon>
                    <Text fw={500} size="lg">Upload Materials</Text>
                </Group>
                <FileUploader />
            </Stack>
        </Card>

        <div>
            <Title order={3} mb="md">My Documents</Title>
            {documents && documents.length > 0 ? (
                <Card withBorder radius="md">
                    <KnowledgeTable documents={documents} />
                </Card>
            ) : (
                <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
                    No documents uploaded yet.
                </Alert>
            )}
        </div>
      </Stack>
    </Container>
  );
}
