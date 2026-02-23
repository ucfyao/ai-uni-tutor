import { Box, Container } from '@mantine/core';
import { getChatSession } from '@/app/actions/chat';
import { getDocColor } from '@/constants/doc-types';
import { ExamEntryClient } from '../ExamEntryClient';

export default async function ExamSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getChatSession(id);

  const courseCode = session?.course?.code ?? null;
  const courseName = session?.course?.name ?? null;
  const uniId = session?.course?.universityId ?? null;

  return (
    <Container size="md" py={48} style={{ position: 'relative' }}>
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
        <ExamEntryClient
          initialCourseCode={courseCode}
          initialCourseName={courseName}
          initialUniId={uniId}
        />
      </Box>
    </Container>
  );
}
