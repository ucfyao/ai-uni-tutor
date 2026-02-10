'use client';

import { IconCheck, IconX } from '@tabler/icons-react';
import { Card, Stack, Text, ThemeIcon } from '@mantine/core';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import type { MockExamResponse } from '@/types/exam';

interface Props {
  feedback: MockExamResponse;
  explanation: string;
}

export function FeedbackCard({ feedback, explanation }: Props) {
  return (
    <Card
      p="lg"
      radius="md"
      style={{
        background: feedback.isCorrect ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
        border: `1px solid ${feedback.isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
      }}
    >
      <Stack gap="sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeIcon
            size="sm"
            radius="xl"
            color={feedback.isCorrect ? 'green' : 'red'}
            variant="filled"
          >
            {feedback.isCorrect ? <IconCheck size={12} /> : <IconX size={12} />}
          </ThemeIcon>
          <Text fw={600} c={feedback.isCorrect ? 'green' : 'red'}>
            {feedback.isCorrect ? 'Correct!' : 'Incorrect'} ({feedback.score} pts)
          </Text>
        </div>

        <Text size="sm">{feedback.aiFeedback}</Text>

        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Detailed Explanation:
          </Text>
          <MarkdownRenderer content={explanation} />
        </div>
      </Stack>
    </Card>
  );
}
