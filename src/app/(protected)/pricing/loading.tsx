import { Box, Container, SimpleGrid, Skeleton, Stack } from '@mantine/core';

export default function PricingLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={36} w={220} mx="auto" radius="xl" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <Skeleton h={380} radius="lg" />
          <Skeleton h={380} radius="lg" />
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
