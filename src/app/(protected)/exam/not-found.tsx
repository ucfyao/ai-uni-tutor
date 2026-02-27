'use client';

import { Anchor, Button, Center, Stack, Text, Title } from '@mantine/core';

export default function ExamNotFound() {
  return (
    <Center h="100vh">
      <Stack align="center" gap="md" ta="center">
        <Title order={1} size={80} c="gray.3" style={{ lineHeight: 1 }}>
          404
        </Title>
        <Title order={2}>Exam Not Found</Title>
        <Text c="dimmed" maw={400}>
          The mock exam you are looking for does not exist or you do not have permission to view it.
        </Text>
        <Anchor href="/study" underline="never">
          <Button variant="light" color="indigo" mt="md">
            Back to Study
          </Button>
        </Anchor>
      </Stack>
    </Center>
  );
}
