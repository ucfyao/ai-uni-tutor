'use client';

import { useRouter } from 'next/navigation';
import { Button, Center, Group, Stack, Text, Title } from '@mantine/core';

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" ta="center" p="xl" bg="white" style={{ borderRadius: 16 }}>
        <Title order={2}>Oops! Something went wrong</Title>
        <Text c="dimmed" maw={400}>
          {error.message || 'We encountered an error while loading your session.'}
        </Text>
        <Group>
          <Button onClick={reset} variant="filled" color="indigo">
            Try again
          </Button>
          <Button onClick={() => router.push('/study')} variant="subtle" color="gray">
            Go home
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
