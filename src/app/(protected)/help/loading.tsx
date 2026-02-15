import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function HelpLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
