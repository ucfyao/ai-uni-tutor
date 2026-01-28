import { createClient } from '@/lib/supabase/server';
import { Container, Title, Text, Stack, Card, Group, Badge, ThemeIcon, Center, Alert, Button } from '@mantine/core';
import { FileUploader } from '@/components/rag/FileUploader';
import { KnowledgeTable } from '@/components/rag/KnowledgeTable';
import { FileText, Database, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar'; // Needs sidebar wrapping? 
// Actually this page is disjoint from the main chat app logic in page.tsx if we just navigate here.
// But we probably want the Sidebar to be persisted.
// However, in Next.js App Router, layout.tsx handles persistence if structured correctly.
// Current structure: src/app/page.tsx contains the AppShell and Sidebar.
// src/app/layout.tsx contains the Providers.
// If I navigate to /knowledge, I lose the AppShell unless I duplicate it or move AppShell to layout.tsx.
// Moving AppShell to layout.tsx is a big refactor.
// For now, I will wrap /knowledge with a similar AppShell or just a simple page with a "Back to Chat" button.
// Given MVP, a "Back to Chat" button is acceptable.
// Or I can instruct user to refactor layout later.
// I'll make it a standalone page with a "Back to Dashboard" button.

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
        <Center h="100vh">
            <Text>Please sign in to manage your knowledge base.</Text>
        </Center>
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
        <div>
           {/* <Link href="/" passHref><Button variant="subtle" leftSection={<ArrowLeft size={16}/>}>Back to Chat</Button></Link> */}
           {/* Can't import Link easily inside server component if I don't use it, but Next.js standard Link is fine. */}
           <a href="/" style={{ textDecoration: 'none', color: 'inherit', marginBottom: '1rem', display: 'inline-block' }}>
              <Group gap="xs">
                 <ThemeIcon variant="light" color="gray" size="sm"><Clock size={12} /></ThemeIcon>
                 <Text size="sm" c="dimmed">Back to Chat</Text>
              </Group>
           </a>

           <Title order={1}>Knowledge Base</Title>
           <Text c="dimmed">Upload documents to personalize your AI tutor.</Text>
        </div>

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
