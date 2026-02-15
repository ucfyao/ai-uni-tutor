import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function SettingsLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={180} radius="lg" />
        <Skeleton h={280} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
