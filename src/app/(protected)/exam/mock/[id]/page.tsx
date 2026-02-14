import { notFound } from 'next/navigation';
import { Box, Container } from '@mantine/core';
import { getMockExamDetail } from '@/app/actions/mock-exams';
import { MockExamClient } from './MockExamClient';

export default async function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mock = await getMockExamDetail(id);

  if (!mock) notFound();

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
          background:
            'radial-gradient(ellipse at center, var(--mantine-color-indigo-0) 0%, transparent 70%)',
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
