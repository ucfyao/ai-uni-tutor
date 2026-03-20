import { Box, Container, Grid, Group, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Page title skeleton */}
        <Group justify="space-between">
          <Skeleton height={32} width={200} radius="sm" />
          <Skeleton height={36} width={140} radius="sm" />
        </Group>

        {/* Course cards grid skeleton */}
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4 }}>
              <Box
                p="md"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                <Stack gap="sm">
                  <Skeleton height={20} width="60%" radius="sm" />
                  <Skeleton height={14} width="80%" radius="sm" />
                  <Skeleton height={14} width="40%" radius="sm" />
                </Stack>
              </Box>
            </Grid.Col>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}
