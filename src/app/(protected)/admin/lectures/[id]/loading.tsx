import { Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack gap="md" p="lg" maw={900} mx="auto">
      <Skeleton height={20} width={120} />
      <Skeleton height={32} width="60%" />
      <Skeleton height={200} />
      <Skeleton height={40} />
    </Stack>
  );
}
