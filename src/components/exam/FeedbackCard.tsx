'use client';

import { IconCheck, IconX } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { Box, Card, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
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
  const { t } = useLanguage();

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
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
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
            {feedback.isCorrect ? t.exam.correct : t.exam.incorrect} ({feedback.score}{' '}
            {t.exam.points})
          </Text>
        </Group>

        {/* Answer comparison when incorrect */}
        {!feedback.isCorrect && correctAnswer && (
          <Group grow gap="sm">
            <Paper withBorder radius="md" p="sm" bg="red.0">
              <Text size="xs" fw={600} c="red.7" mb={4}>
                {t.exam.yourAnswer}
              </Text>
              <Text size="sm" c="red.8">
                {feedback.userAnswer || t.exam.noAnswer}
              </Text>
            </Paper>
            <Paper withBorder radius="md" p="sm" bg="green.0">
              <Text size="xs" fw={600} c="green.7" mb={4}>
                {t.exam.correctAnswer}
              </Text>
              <Text size="sm" c="green.8">
                {correctAnswer}
              </Text>
            </Paper>
          </Group>
        )}

        <div>
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            {t.exam.feedback}
          </Text>
          <Text size="sm">{feedback.aiFeedback}</Text>
        </div>

        <Paper withBorder radius="md" p="sm">
          <Text size="xs" fw={600} c="dimmed" mb={4}>
            {t.exam.detailedExplanation}
          </Text>
          <MarkdownRenderer content={explanation} />
        </Paper>
      </Stack>
    </Card>
  );
}
