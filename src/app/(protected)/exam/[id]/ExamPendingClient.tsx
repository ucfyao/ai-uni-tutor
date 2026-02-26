'use client';

import { Loader, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Box, Button, Card, Stack, Text, Title } from '@mantine/core';
import { generateMockQuestions } from '@/app/actions/mock-exams';
import { getDocColor } from '@/constants/doc-types';
import type { MockExam } from '@/types/exam';

interface Props {
  mock: MockExam;
  topic: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: string[];
}

export function ExamPendingClient({ mock, topic, numQuestions, difficulty, questionTypes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateMockQuestions(
        mock.id,
        topic,
        numQuestions,
        difficulty,
        questionTypes,
      );
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Stack gap="lg">
      <Box className="animate-fade-in-up">
        <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
          {mock.title}
        </Title>
        <Text c="dimmed" size="md" fw={400} mt={2}>
          {mock.mode === 'practice' ? 'Practice' : 'Exam'} Mode · {numQuestions} questions
        </Text>
      </Box>

      <Card
        withBorder
        radius="lg"
        p="xl"
        ta="center"
        className="animate-fade-in-up animate-delay-100"
        style={{
          borderColor: 'var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          opacity: 0,
        }}
      >
        <Stack align="center" gap="lg" py="xl">
          {isPending ? (
            <>
              <Loader
                size={48}
                className="animate-spin"
                color={`var(--mantine-color-${getDocColor('exam')}-5)`}
              />
              <Title order={3}>Generating Questions...</Title>
              <Text c="dimmed" maw={400}>
                AI is creating {numQuestions} questions on &ldquo;{topic}&rdquo;. This may take a
                moment.
              </Text>
            </>
          ) : (
            <>
              <Sparkles size={48} color={`var(--mantine-color-${getDocColor('exam')}-5)`} />
              <Title order={3}>Ready to Generate</Title>
              <Text c="dimmed" maw={400}>
                {numQuestions} questions on &ldquo;{topic}&rdquo; ({difficulty} difficulty)
              </Text>

              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}

              <Button
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{
                  from: `${getDocColor('exam')}.7`,
                  to: `${getDocColor('exam')}.3`,
                }}
                leftSection={<Sparkles size={20} />}
                onClick={handleGenerate}
              >
                Generate Questions
              </Button>
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
