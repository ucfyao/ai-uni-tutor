import { AlertCircle, BookOpen, Database } from 'lucide-react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { FileUploader } from '@/components/rag/FileUploader';
import { KnowledgeTable } from '@/components/rag/KnowledgeTable';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export default async function KnowledgePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to manage your knowledge base.
        </Alert>
      </Container>
    );
  }

  const supabase = await createClient();
  const { data: documents } = await supabase
    .from('documents')
    .select('id, name, status, status_message, created_at, metadata')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={1} fw={800} mb={4}>
              Knowledge Base
            </Title>
            <Text c="dimmed" size="lg">
              Upload documents to personalize your AI tutor.
            </Text>
          </Box>
          <Link href="/study" style={{ textDecoration: 'none' }}>
            <Button component="div" variant="subtle" leftSection={<BookOpen size={16} />}>
              Back to Chat
            </Button>
          </Link>
        </Group>

        <Card withBorder radius="lg" p="xl">
          <Stack gap="md">
            <Group>
              <ThemeIcon variant="light" size="lg" radius="md">
                <Database size={20} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                Upload Materials
              </Text>
            </Group>
            <FileUploader />
          </Stack>
        </Card>

        <Box>
          <Title order={3} fw={700} mb="md">
            My Documents
          </Title>
          {documents && documents.length > 0 ? (
            <Card withBorder radius="lg" p={0}>
              <KnowledgeTable documents={documents} />
            </Card>
          ) : (
            <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
              No documents uploaded yet.
            </Alert>
          )}
        </Box>
      </Stack>
    </Container>
  );
}
