'use client';

import { AlertTriangle, Check, Flag, Target, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { batchSubmitMockAnswers } from '@/app/actions/mock-exams';
import { FullScreenModal } from '@/components/FullScreenModal';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { BatchSubmitResult, MockExamQuestion } from '@/types/exam';

type SubmitPhase = 'confirm' | 'grading' | 'results' | 'error';

interface ExamSubmitModalProps {
  opened: boolean;
  onClose: () => void;
  mockId: string;
  answers: Record<number, string>;
  questions: MockExamQuestion[];
  markedQuestions: Set<number>;
  onSubmitSuccess: (result: BatchSubmitResult) => void;
  onNavigateToQuestion: (index: number) => void;
  autoSubmit?: boolean;
}

export function ExamSubmitModal({
  opened,
  onClose,
  mockId,
  answers,
  questions,
  markedQuestions,
  onSubmitSuccess,
  onNavigateToQuestion,
  autoSubmit = false,
}: ExamSubmitModalProps) {
  const { t } = useLanguage();
  const color = getDocColor('exam');
  const [phase, setPhase] = useState<SubmitPhase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchSubmitResult | null>(null);

  const totalQuestions = questions.length;
  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;
  const unansweredIndices = questions.map((_, i) => i).filter((i) => !answers[i]?.trim());
  const markedIndices = Array.from(markedQuestions).sort((a, b) => a - b);

  // Reset phase when modal opens
  useEffect(() => {
    if (opened) {
      setPhase('confirm');
      setError(null);
      setResult(null);
    }
  }, [opened]);

  // Auto-submit for timer expiry
  useEffect(() => {
    if (opened && autoSubmit) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, autoSubmit]);

  const handleSubmit = useCallback(async () => {
    // Submit all questions — unanswered ones get empty string (graded as incorrect)
    const answersToSubmit = questions.map((_, i) => ({
      questionIndex: i,
      userAnswer: answers[i]?.trim() || '',
    }));

    setPhase('grading');
    setError(null);

    try {
      const res = await batchSubmitMockAnswers(mockId, answersToSubmit);
      if (res.success) {
        setResult(res.result);
        onSubmitSuccess(res.result);
        setPhase('results');
      } else {
        setError(res.error);
        setPhase('error');
        showNotification({
          title: t.exam.submitFailed,
          message: res.error,
          color: 'red',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setPhase('error');
      showNotification({
        title: t.exam.submitFailed,
        message,
        color: 'red',
      });
    }
  }, [answers, questions, mockId, onSubmitSuccess, t.exam.submitFailed]);

  const handleNavigate = (index: number) => {
    onClose();
    onNavigateToQuestion(index);
  };

  const handleReview = () => {
    onClose();
  };

  // Phase 1: Confirm
  const renderConfirm = () => (
    <Stack gap="md">
      {/* Completion ring */}
      <Stack align="center" gap="xs">
        <RingProgress
          size={100}
          thickness={8}
          roundCaps
          sections={[{ value: (answeredCount / totalQuestions) * 100, color }]}
          label={
            <Text ta="center" fw={700} fz="md">
              {answeredCount}/{totalQuestions}
            </Text>
          }
        />
        <Text size="sm" c="dimmed">
          {t.exam.confirmSubmitAll.replace('{n}', String(totalQuestions))}
        </Text>
      </Stack>

      {/* Unanswered questions warning */}
      {unansweredIndices.length > 0 && (
        <Box>
          <Text size="sm" fw={500} c="red" mb="xs">
            {t.exam.unansweredQuestions} ({unansweredIndices.length})
          </Text>
          <Group gap={4} wrap="wrap">
            {unansweredIndices.map((i) => (
              <Badge
                key={i}
                size="sm"
                color="red"
                variant="light"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNavigate(i)}
              >
                Q{i + 1}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* Marked questions reminder */}
      {markedIndices.length > 0 && (
        <Box>
          <Group gap={4} mb="xs">
            <Flag size={14} color="var(--mantine-color-orange-5)" />
            <Text size="sm" fw={500} c="orange">
              {t.exam.markedQuestions} ({markedIndices.length})
            </Text>
          </Group>
          <Group gap={4} wrap="wrap">
            {markedIndices.map((i) => (
              <Badge
                key={i}
                size="sm"
                color="orange"
                variant="light"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNavigate(i)}
              >
                Q{i + 1}
              </Badge>
            ))}
          </Group>
        </Box>
      )}

      {/* Action buttons */}
      <Group justify="flex-end" gap="sm" mt="sm">
        <Button variant="default" onClick={onClose}>
          {t.exam.continueAnswering}
        </Button>
        <Button color={color} onClick={handleSubmit}>
          {t.exam.confirmSubmit}
        </Button>
      </Group>
    </Stack>
  );

  // Phase 2: Grading
  const renderGrading = () => (
    <Stack align="center" gap="md" py="xl">
      <Loader size="lg" color={color} />
      <Title order={3}>{t.exam.gradingInProgress}</Title>
      <Text size="sm" c="dimmed">
        {t.exam.questionsSubmitted.replace('{n}', String(answeredCount))}
      </Text>
    </Stack>
  );

  // Phase 3: Results
  const renderResults = () => {
    if (!result) return null;

    const scorePercent = Math.round((result.score / result.totalPoints) * 100);
    const ringColor = scorePercent >= 80 ? 'green' : scorePercent >= 50 ? 'yellow' : 'red';
    const unanswered = result.responses.filter((r) => !r.userAnswer.trim()).length;
    const correctCount = result.responses.filter((r) => r.isCorrect).length;
    const incorrectCount = result.responses.filter(
      (r) => !r.isCorrect && r.userAnswer.trim(),
    ).length;

    return (
      <Stack align="center" gap="md" py="md">
        <Trophy size={48} color="gold" />
        <Title order={2}>{t.exam.examCompleted}</Title>

        <RingProgress
          size={120}
          thickness={10}
          roundCaps
          sections={[{ value: scorePercent, color: ringColor }]}
          label={
            <Text ta="center" fw={700} fz="lg">
              {scorePercent}%
            </Text>
          }
        />

        <Text size="lg" fw={700}>
          {result.score}/{result.totalPoints}
        </Text>

        <SimpleGrid cols={unanswered > 0 ? 4 : 3} spacing="sm" w="100%">
          <Paper withBorder radius="md" p="sm" ta="center">
            <Group gap={4} justify="center" mb={4}>
              <Target size={14} color="var(--mantine-color-dimmed)" />
              <Text fz="xs" c="dimmed">
                {t.exam.totalQuestions}
              </Text>
            </Group>
            <Text fw={700}>{totalQuestions}</Text>
          </Paper>
          <Paper withBorder radius="md" p="sm" ta="center">
            <Group gap={4} justify="center" mb={4}>
              <Check size={14} color="var(--mantine-color-green-6)" />
              <Text fz="xs" c="dimmed">
                {t.exam.correct}
              </Text>
            </Group>
            <Text fw={700} c="green">
              {correctCount}
            </Text>
          </Paper>
          <Paper withBorder radius="md" p="sm" ta="center">
            <Group gap={4} justify="center" mb={4}>
              <X size={14} color="var(--mantine-color-red-6)" />
              <Text fz="xs" c="dimmed">
                {t.exam.incorrect}
              </Text>
            </Group>
            <Text fw={700} c="red">
              {incorrectCount}
            </Text>
          </Paper>
          {unanswered > 0 && (
            <Paper withBorder radius="md" p="sm" ta="center">
              <Group gap={4} justify="center" mb={4}>
                <Text fz="xs" c="dimmed">
                  {t.exam.unansweredCount}
                </Text>
              </Group>
              <Text fw={700} c="gray">
                {unanswered}
              </Text>
            </Paper>
          )}
        </SimpleGrid>

        <Button color={color} fullWidth mt="sm" onClick={handleReview}>
          {t.exam.reviewAnswers}
        </Button>
      </Stack>
    );
  };

  // Error state
  const renderError = () => (
    <Stack align="center" gap="md" py="xl">
      <AlertTriangle size={48} color="var(--mantine-color-red-6)" />
      <Title order={3} c="red">
        {t.exam.submitFailed}
      </Title>
      {error && (
        <Text size="sm" c="dimmed" ta="center">
          {error}
        </Text>
      )}
      <Group gap="sm" mt="sm">
        <Button variant="default" onClick={onClose}>
          {t.exam.cancel}
        </Button>
        <Button color={color} onClick={handleSubmit}>
          {t.exam.retry}
        </Button>
      </Group>
    </Stack>
  );

  const isGrading = phase === 'grading';

  return (
    <FullScreenModal
      opened={opened}
      onClose={isGrading ? () => {} : onClose}
      title={phase === 'confirm' ? t.exam.confirmSubmitTitle : undefined}
      centered
      closeOnClickOutside={!isGrading}
      closeOnEscape={!isGrading}
      withCloseButton={!isGrading}
      size={phase === 'results' ? 'md' : undefined}
    >
      {phase === 'confirm' && renderConfirm()}
      {phase === 'grading' && renderGrading()}
      {phase === 'results' && renderResults()}
      {phase === 'error' && renderError()}
    </FullScreenModal>
  );
}
