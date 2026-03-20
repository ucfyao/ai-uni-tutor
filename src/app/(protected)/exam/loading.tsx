import { Box, Container, Group, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Page title */}
        <Group justify="space-between">
          <Skeleton height={32} width={180} radius="sm" />
          <Skeleton height={36} width={160} radius="sm" />
        </Group>

        {/* Section: In Progress */}
        <Stack gap="md">
          <Skeleton height={24} width={120} radius="sm" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Box
              key={i}
              p="md"
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-md)',
              }}
            >
              <Group justify="space-between">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Skeleton height={18} width="50%" radius="sm" />
                  <Skeleton height={14} width="70%" radius="sm" />
                </Stack>
                <Skeleton height={32} width={80} radius="sm" />
              </Group>
            </Box>
          ))}
        </Stack>

        {/* Section: Completed */}
        <Stack gap="md">
          <Skeleton height={24} width={120} radius="sm" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Box
              key={i}
              p="md"
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-md)',
              }}
            >
              <Group justify="space-between">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Skeleton height={18} width="50%" radius="sm" />
                  <Skeleton height={14} width="70%" radius="sm" />
                </Stack>
                <Skeleton height={32} width={80} radius="sm" />
              </Group>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
