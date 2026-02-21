import { Anchor, Box, Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import { getMockExamDetail } from '@/app/actions/mock-exams';
import { getDocColor } from '@/constants/doc-types';
import { MockExamClient } from './MockExamClient';

export default async function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mock = await getMockExamDetail(id);

  if (!mock) {
    return (
      <Center h="100%">
        <Stack align="center" gap="md" ta="center">
          <Title order={1} size={80} c="gray.3" style={{ lineHeight: 1 }}>
            404
          </Title>
          <Title order={2}>Exam Not Found</Title>
          <Text c="dimmed" maw={400}>
            The mock exam you are looking for does not exist or you do not have permission to view
            it.
          </Text>
          <Anchor href="/exam" underline="never">
            <Button variant="light" color="indigo" mt="md">
              Back to Exams
            </Button>
          </Anchor>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="xl" py={48} style={{ position: 'relative' }}>
      <Box
        style={{
          position: 'absolute',
          top: -40,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 200,
          background: `radial-gradient(ellipse at center, var(--mantine-color-${getDocColor('exam')}-0) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.7,
        }}
      />
      <Box style={{ position: 'relative', zIndex: 1 }}>
        <MockExamClient initialMock={mock} />
      </Box>
    </Container>
  );
}
