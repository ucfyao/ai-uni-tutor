import { notFound } from 'next/navigation';
import { Box, Container } from '@mantine/core';
import { getMockExamDetail } from '@/app/actions/mock-exams';
import { getDocColor } from '@/constants/doc-types';
import { ExamPendingClient } from './ExamPendingClient';
import { MockExamClient } from './MockExamClient';

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ courseCode?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const mock = await getMockExamDetail(id);

  if (!mock) {
    notFound();
  }

  const hasQuestions = mock.questions.length > 0;

  return (
    <Container size={hasQuestions ? 'xl' : 'md'} py={48} style={{ position: 'relative' }}>
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
        {hasQuestions ? (
          <MockExamClient key={id} initialMock={mock} />
        ) : (
          <ExamPendingClient mock={mock} courseCode={sp.courseCode} />
        )}
      </Box>
    </Container>
  );
}
