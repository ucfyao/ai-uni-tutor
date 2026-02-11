'use client';

import { Button, Center, Stack, Text, Title } from '@mantine/core';

export default function StudyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Center h="100%">
      <Stack align="center" gap="md" ta="center" p="xl">
        <Title order={3}>Failed to load study page</Title>
        <Text c="dimmed" maw={400}>
          {error.message || 'Something went wrong.'}
        </Text>
        <Button onClick={reset} variant="filled" color="indigo">
          Try again
        </Button>
      </Stack>
    </Center>
  );
}
