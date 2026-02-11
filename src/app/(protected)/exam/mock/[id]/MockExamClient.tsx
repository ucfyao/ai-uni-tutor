'use client';

import { IconArrowRight, IconCheck, IconTrophy } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button, Card, Container, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { submitMockAnswer } from '@/app/actions/mock-exams';
import { FeedbackCard } from '@/components/exam/FeedbackCard';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { MockExam, MockExamResponse } from '@/types/exam';

interface Props {
  initialMock: MockExam;
}

export function MockExamClient({ initialMock }: Props) {
  const router = useRouter();
  const [mock, setMock] = useState(initialMock);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<MockExamResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentQuestion = mock.questions[mock.currentIndex];
  const isCompleted = mock.status === 'completed';
  const [reviewIndex, setReviewIndex] = useState(0);

  const earnedPoints = mock.responses.reduce((sum, r) => sum + r.score, 0);
  const progress = isCompleted ? 100 : (mock.currentIndex / mock.questions.length) * 100;

  const handleSubmit = useCallback(() => {
    if (!userAnswer.trim()) return;

    startTransition(async () => {
      const result = await submitMockAnswer(mock.id, mock.currentIndex, userAnswer);
      if (result.success) {
        setFeedback(result.feedback);
        setMock((prev) => ({
          ...prev,
          responses: [...prev.responses, result.feedback],
        }));
      }
    });
  }, [mock.id, mock.currentIndex, userAnswer]);

  const handleNext = useCallback(() => {
    const nextIndex = mock.currentIndex + 1;
    const isLast = nextIndex >= mock.questions.length;

    setFeedback(null);
    setUserAnswer('');

    if (isLast) {
      setMock((prev) => ({
        ...prev,
        status: 'completed',
        score: prev.responses.reduce((sum, r) => sum + r.score, 0),
      }));
    } else {
      setMock((prev) => ({
        ...prev,
        currentIndex: nextIndex,
      }));
    }
  }, [mock.currentIndex, mock.questions.length]);

  // Completed state — show results summary
  if (isCompleted && !feedback) {
    const reviewQ = mock.questions[reviewIndex];
    const reviewR = mock.responses[reviewIndex];

    return (
      <Container size="md" py={48}>
        <Stack gap="xl">
          <Card withBorder radius="lg" p="xl" ta="center">
            <IconTrophy size={48} color="gold" />
            <Title order={2} mt="md">
              Exam Completed!
            </Title>
            <Text size="xl" fw={700} mt="sm">
              {mock.score}/{mock.totalPoints}
            </Text>
            <Progress
              value={(mock.score! / mock.totalPoints) * 100}
              mt="md"
              size="lg"
              color={mock.score! / mock.totalPoints >= 0.6 ? 'green' : 'red'}
            />
          </Card>

          {/* Review section */}
          <Title order={4}>Review Questions</Title>
          {reviewQ && (
            <QuestionCard
              question={reviewQ}
              index={reviewIndex}
              total={mock.questions.length}
              value={reviewR?.userAnswer ?? ''}
              onChange={() => {}}
              disabled
            />
          )}
          {reviewR && reviewQ && (
            <FeedbackCard feedback={reviewR} explanation={reviewQ.explanation} />
          )}

          <Group justify="space-between">
            <Button
              variant="subtle"
              disabled={reviewIndex <= 0}
              onClick={() => setReviewIndex((i) => i - 1)}
            >
              Previous
            </Button>
            <Text size="sm" c="dimmed">
              {reviewIndex + 1} / {mock.questions.length}
            </Text>
            <Button
              variant="subtle"
              disabled={reviewIndex >= mock.questions.length - 1}
              onClick={() => setReviewIndex((i) => i + 1)}
            >
              Next
            </Button>
          </Group>

          <Button variant="subtle" onClick={() => router.push('/exam')}>
            Back to Exam Practice
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        {/* Progress header */}
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              {mock.title}
            </Text>
            <Text size="sm" c="dimmed">
              Question {mock.currentIndex + 1}/{mock.questions.length} · {earnedPoints} pts earned
            </Text>
          </Group>
          <Progress value={progress} size="sm" color="indigo" />
        </div>

        {/* Current question */}
        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            index={mock.currentIndex}
            total={mock.questions.length}
            value={userAnswer}
            onChange={setUserAnswer}
            disabled={!!feedback}
          />
        )}

        {/* Feedback */}
        {feedback && currentQuestion && (
          <FeedbackCard feedback={feedback} explanation={currentQuestion.explanation} />
        )}

        {/* Actions */}
        <Group justify="flex-end">
          {!feedback ? (
            <Button
              leftSection={<IconCheck size={16} />}
              loading={isPending}
              disabled={!userAnswer.trim()}
              onClick={handleSubmit}
            >
              Submit Answer
            </Button>
          ) : (
            <Button rightSection={<IconArrowRight size={16} />} onClick={handleNext}>
              {mock.currentIndex >= mock.questions.length - 1 ? 'Finish Exam' : 'Next Question'}
            </Button>
          )}
        </Group>
      </Stack>
    </Container>
  );
}
