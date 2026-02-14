'use client';

import { IconCheck, IconX } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { Box, Card, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { MockExamResponse } from '@/types/exam';

const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

interface Props {
  feedback: MockExamResponse;
  explanation: string;
  correctAnswer?: string;
}

export function FeedbackCard({ feedback, explanation, correctAnswer }: Props) {
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
        <Group gap={8}>
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
        </Group>

        {/* Answer comparison when incorrect */}
        {!feedback.isCorrect && correctAnswer && (
          <Group grow gap="sm">
            <Paper withBorder radius="md" p="sm" bg="red.0">
              <Text size="xs" fw={600} c="red.7" mb={4}>
                Your Answer
              </Text>
              <Text size="sm" c="red.8">
                {feedback.userAnswer || '(no answer)'}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="sm" bg="green.0">
              <Text size="xs" fw={600} c="green.7" mb={4}>
                Correct Answer
              </Text>
              <Text size="sm" c="green.8">
                {correctAnswer}
              </Text>
            </Paper>
          </Group>
        )}

        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            AI Feedback:
          </Text>
          <Text size="sm">{feedback.aiFeedback}</Text>
        </div>

        <Paper withBorder radius="md" p="sm" bg="white">
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            Detailed Explanation:
          </Text>
          <MarkdownRenderer content={explanation} />
        </Paper>
      </Stack>
    </Card>
  );
}
