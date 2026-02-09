import { Center, Loader, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack h="100%" gap={0} style={{ flex: 1, minHeight: 0 }}>
      <Center flex={1}>
        <Loader color="indigo" size="lg" />
      </Center>
    </Stack>
  );
}
