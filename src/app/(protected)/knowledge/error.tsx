'use client';

import { useRouter } from 'next/navigation';
import { Button, Center, Group, Stack, Text, Title } from '@mantine/core';

export default function KnowledgeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <Center h="100%">
      <Stack align="center" gap="md" ta="center" p="xl">
        <Title order={3}>Failed to load knowledge base</Title>
        <Text c="dimmed" maw={400}>
          {error.message || 'Something went wrong loading your documents.'}
        </Text>
        <Group>
          <Button onClick={reset} variant="filled" color="indigo">
            Try again
          </Button>
          <Button onClick={() => router.push('/study')} variant="subtle" color="gray">
            Back to study
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
