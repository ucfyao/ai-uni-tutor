import { Box, Group, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header skeleton */}
      <Box
        px="md"
        h={52}
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
          <Skeleton height={16} width={80} radius="sm" />
          <Skeleton height={12} width={12} radius="xl" />
          <Skeleton height={20} width={20} radius="md" />
          <Skeleton height={14} width={100} radius="sm" />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Skeleton height={32} width={32} radius="xl" />
          <Skeleton height={32} width={32} radius="xl" />
          <Skeleton height={32} width={32} radius="xl" />
        </Group>
      </Box>

      {/* Chat area skeleton */}
      <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack gap="lg" p="md" pt="xl" style={{ flex: 1 }}>
          {/* User message */}
          <Group justify="flex-end">
            <Skeleton height={40} width="55%" radius="lg" />
          </Group>
          {/* AI message */}
          <Group justify="flex-start" align="flex-start" gap="sm">
            <Skeleton height={32} width={32} radius="xl" style={{ flexShrink: 0 }} />
            <Stack gap={6} style={{ flex: 1, maxWidth: '70%' }}>
              <Skeleton height={14} width="90%" radius="sm" />
              <Skeleton height={14} width="75%" radius="sm" />
              <Skeleton height={14} width="40%" radius="sm" />
            </Stack>
          </Group>
          {/* User message */}
          <Group justify="flex-end">
            <Skeleton height={36} width="40%" radius="lg" />
          </Group>
          {/* AI message */}
          <Group justify="flex-start" align="flex-start" gap="sm">
            <Skeleton height={32} width={32} radius="xl" style={{ flexShrink: 0 }} />
            <Stack gap={6} style={{ flex: 1, maxWidth: '70%' }}>
              <Skeleton height={14} width="85%" radius="sm" />
              <Skeleton height={14} width="60%" radius="sm" />
            </Stack>
          </Group>
        </Stack>

        {/* Input area skeleton */}
        <Box px="md" pb="md" pt="sm">
          <Skeleton height={48} radius="xl" />
        </Box>
      </Box>
    </Box>
  );
}
