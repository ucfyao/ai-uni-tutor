'use client';

import { useRouter } from 'next/navigation';
import { Button, Center, Group, Stack, Text, Title } from '@mantine/core';

export default function MockExamError({
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
        <Title order={3}>Failed to load mock exam</Title>
        <Text c="dimmed" maw={400}>
          {error.message || 'Something went wrong loading this mock exam.'}
        </Text>
        <Group>
          <Button onClick={reset} variant="filled" color="indigo">
            Try again
          </Button>
          <Button onClick={() => router.push('/exam')} variant="subtle" color="gray">
            Back to exams
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
