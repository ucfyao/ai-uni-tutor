import { Box, Container } from '@mantine/core';
import { getExamPaperList } from '@/app/actions/exam-papers';
import { getMockExamList } from '@/app/actions/mock-exams';
import { ExamEntryClient } from './ExamEntryClient';

export default async function ExamPage() {
  const [papers, mockExams] = await Promise.all([getExamPaperList(), getMockExamList()]);

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
        <ExamEntryClient papers={papers} recentMocks={mockExams.slice(0, 5)} />
      </Box>
    </Container>
  );
}
