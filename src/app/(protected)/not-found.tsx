import Link from 'next/link';
import { Button, Center, Stack, Text, Title } from '@mantine/core';

export default function NotFound() {
  return (
    <Center h="100vh">
      <Stack align="center" gap="md" ta="center">
        <Title order={1} size={80} c="gray.3" style={{ lineHeight: 1 }}>
          404
        </Title>
        <Title order={2}>Session Not Found</Title>
        <Text c="dimmed" maw={400}>
          The session you are looking for does not exist or you do not have permission to view it.
        </Text>
        <Button component={Link} href="/study" variant="light" color="indigo" mt="md">
          Back to Study
        </Button>
      </Stack>
    </Center>
  );
}
