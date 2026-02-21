import { Box, Container } from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { ExamEntryClient } from './ExamEntryClient';

export default function ExamPage() {
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
        <ExamEntryClient />
      </Box>
    </Container>
  );
}
