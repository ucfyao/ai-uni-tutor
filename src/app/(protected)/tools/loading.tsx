import { Center, Loader, Stack, Text } from '@mantine/core';

export default function Loading() {
  return (
    <Center h="calc(100vh - 200px)">
      <Stack align="center" gap="sm">
        <Loader color="indigo" size="lg" type="dots" />
        <Text size="sm" c="dimmed" fw={500}>
          Loading tools...
        </Text>
      </Stack>
    </Center>
  );
}
