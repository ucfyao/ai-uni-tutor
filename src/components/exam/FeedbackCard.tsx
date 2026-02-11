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
      withBorder
      radius="lg"
      p="lg"
      bg={feedback.isCorrect ? 'green.0' : 'red.0'}
      style={{
        borderColor: feedback.isCorrect
          ? 'var(--mantine-color-green-3)'
          : 'var(--mantine-color-red-3)',
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
