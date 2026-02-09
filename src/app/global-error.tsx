'use client';

import { Button, Container, Stack, Text, Title } from '@mantine/core';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <Container size="sm" py={80}>
          <Stack align="center" gap="md" ta="center">
            <Title order={1}>Something went wrong!</Title>
            <Text c="dimmed">{error.message || 'An unexpected error occurred.'}</Text>
            <Button onClick={reset} variant="light" color="red">
              Try again
            </Button>
          </Stack>
        </Container>
      </body>
    </html>
  );
}
