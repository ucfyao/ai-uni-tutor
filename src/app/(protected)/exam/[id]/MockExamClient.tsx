'use client';

import { ArrowLeft, ArrowRight, Check, Flag, Target, Trophy, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { ExamSubmitModal } from '@/components/exam/ExamSubmitModal';
import { FeedbackCard } from '@/components/exam/FeedbackCard';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import type { BatchSubmitResult, MockExam, MockExamResponse } from '@/types/exam';

interface Props {
  initialMock: MockExam;
}

const DEFAULT_TIMER_SECONDS = 60 * 60; // 60 minutes

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MockExamClient({ initialMock }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [mock, setMock] = useState(initialMock);

  // Mode locked from record
  const mode = mock.mode;
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Navigation
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    initialMock.status === 'completed' ? 0 : initialMock.currentIndex,
  );

  // Unified answer collection for both modes
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Question marking
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set());

  const toggleMark = useCallback((index: number) => {
    setMarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Submit modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompleted = mock.status === 'completed';
  const currentQuestion = mock.questions[currentQuestionIndex];
  const totalQuestions = mock.questions.length;

  // Timer countdown — auto-opens submit modal on expiry
  useEffect(() => {
    if (timerEnabled && !isCompleted && !hasSubmitted) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimerExpired(true);
            setSubmitModalOpen(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerEnabled, isCompleted, hasSubmitted]);

  // Handle successful submission from ExamSubmitModal
  const handleSubmitSuccess = useCallback(
    (result: BatchSubmitResult) => {
      setHasSubmitted(true);
      setMock((prev) => ({
        ...prev,
        status: 'completed',
        score: result.score,
        responses: result.responses,
        currentIndex: totalQuestions,
      }));
      setCurrentQuestionIndex(0);
    },
    [totalQuestions],
  );

  // Determine question status for sidebar
  const getQuestionStatus = (index: number) => {
    if (index === currentQuestionIndex) return 'active';
    if (isCompleted) {
      const response = mock.responses.find((r) => r.questionIndex === index);
      if (response) return response.isCorrect ? 'correct' : 'incorrect';
      return 'unanswered';
    }
    // In-progress: check local answers
    if (markedQuestions.has(index)) {
      return answers[index]?.trim() ? 'marked-answered' : 'marked';
    }
    return answers[index]?.trim() ? 'answered' : 'unanswered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'indigo';
      case 'correct':
        return 'green';
      case 'incorrect':
        return 'red';
      case 'answered':
        return 'teal';
      case 'marked':
        return 'orange';
      case 'marked-answered':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Update answer for current question
  const handleAnswerChange = useCallback(
    (value: string) => {
      setAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }));
    },
    [currentQuestionIndex],
  );

  // Navigate to question
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  // Get current answer value
  const getCurrentAnswer = () => {
    if (isCompleted) {
      const response = mock.responses.find((r) => r.questionIndex === currentQuestionIndex);
      return response?.userAnswer ?? '';
    }
    return answers[currentQuestionIndex] ?? '';
  };

  // Get current feedback
  const getCurrentFeedback = (): MockExamResponse | null => {
    if (isCompleted) {
      return mock.responses.find((r) => r.questionIndex === currentQuestionIndex) ?? null;
    }
    return null;
  };

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;
  const progressValue = isCompleted ? 100 : (answeredCount / totalQuestions) * 100;

  const currentFeedback = getCurrentFeedback();

  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Group justify="space-between" align="flex-start" className="animate-fade-in-up">
        <Box>
          <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
            {mock.title}
          </Title>
          <Text c="dimmed" size="md" fw={400} mt={2}>
            {isCompleted
              ? `Completed · ${totalQuestions} questions`
              : `${mode === 'practice' ? 'Practice' : 'Exam'} Mode · ${totalQuestions} questions`}
          </Text>
        </Box>

        {!isCompleted && (
          <Group gap="xs">
            <Switch
              label="Timer"
              size="sm"
              checked={timerEnabled}
              onChange={(e) => setTimerEnabled(e.currentTarget.checked)}
              disabled={hasSubmitted}
            />
            {timerEnabled && (
              <Text
                size="sm"
                fw={700}
                ff="monospace"
                c={timeRemaining < 60 ? 'red' : timeRemaining < 300 ? 'orange' : undefined}
                className={timeRemaining < 60 ? 'exam-timer-flash' : undefined}
              >
                {formatTime(timeRemaining)}
              </Text>
            )}
          </Group>
        )}

        {isCompleted && mock.score !== null && (
          <Group gap="xs">
            <Trophy size={18} color="gold" />
            <Text fw={700}>
              {mock.score}/{mock.totalPoints}
            </Text>
          </Group>
        )}
      </Group>

      {/* Progress bar */}
      <Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
        <Progress value={progressValue} size="sm" color={getDocColor('exam')} />
      </Box>

      {/* Score summary banner (shown for completed exams) */}
      {isCompleted &&
        mock.score !== null &&
        (() => {
          const scorePercent = Math.round((mock.score / mock.totalPoints) * 100);
          const ringColor =
            scorePercent >= 80 ? 'green' : scorePercent >= 50 ? 'yellow' : 'red';
          const correctCount = mock.responses.filter((r) => r.isCorrect).length;
          const incorrectCount = mock.responses.filter((r) => !r.isCorrect).length;

          return (
            <Paper
              withBorder
              radius="lg"
              p="md"
              className="animate-fade-in-up animate-delay-100"
              style={{
                borderColor: 'var(--mantine-color-gray-2)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                opacity: 0,
              }}
            >
              <Group justify="center" gap="lg" wrap="wrap">
                <RingProgress
                  size={64}
                  thickness={6}
                  roundCaps
                  sections={[{ value: scorePercent, color: ringColor }]}
                  label={
                    <Text ta="center" fw={700} fz="xs">
                      {scorePercent}%
                    </Text>
                  }
                />
                <Text fw={700} fz="lg">
                  {mock.score}/{mock.totalPoints}
                </Text>
                <SimpleGrid cols={3} spacing="sm">
                  <Group gap={4}>
                    <Target size={14} color="var(--mantine-color-dimmed)" />
                    <Text fz="sm" c="dimmed">
                      {t.exam.totalQuestions}
                    </Text>
                    <Text fw={700} fz="sm">
                      {totalQuestions}
                    </Text>
                  </Group>
                  <Group gap={4}>
                    <Check size={14} color="var(--mantine-color-green-6)" />
                    <Text fz="sm" c="dimmed">
                      {t.exam.correct}
                    </Text>
                    <Text fw={700} fz="sm" c="green">
                      {correctCount}
                    </Text>
                  </Group>
                  <Group gap={4}>
                    <X size={14} color="var(--mantine-color-red-6)" />
                    <Text fz="sm" c="dimmed">
                      {t.exam.incorrect}
                    </Text>
                    <Text fw={700} fz="sm" c="red">
                      {incorrectCount}
                    </Text>
                  </Group>
                </SimpleGrid>
              </Group>
            </Paper>
          );
        })()}

      {/* Two-column layout — fills remaining height */}
      <Card
        withBorder
        radius="lg"
        p={0}
        className="animate-fade-in-up animate-delay-200"
        style={{
          borderColor: 'var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          opacity: 0,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Group align="stretch" gap={0} wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
          {/* Left sidebar — Question list (hidden on mobile, replaced by bottom nav) */}
          <Box
            w={280}
            visibleFrom="sm"
            style={{
              flexShrink: 0,
              borderRight: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <ScrollArea h="100%">
              <Stack gap={0}>
                {mock.questions.map((q, i) => {
                  const status = getQuestionStatus(i);
                  const isActive = i === currentQuestionIndex;
                  const statusColor = getStatusColor(status);

                  return (
                    <UnstyledButton
                      key={i}
                      onClick={() => goToQuestion(i)}
                      p="xs"
                      style={{
                        borderLeft: isActive
                          ? `3px solid var(--mantine-color-${getDocColor('exam')}-5)`
                          : '3px solid transparent',
                        backgroundColor: isActive
                          ? `var(--mantine-color-${getDocColor('exam')}-0)`
                          : undefined,
                        transition: 'all 150ms ease',
                      }}
                    >
                      <Group gap="sm" wrap="nowrap">
                        <Badge
                          size="md"
                          circle
                          variant={status === 'unanswered' ? 'light' : 'filled'}
                          color={statusColor}
                        >
                          {status === 'correct' ? <Check size={12} /> : i + 1}
                        </Badge>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" lineClamp={1}>
                            {q.content.replace(/[#*_`$\\]/g, '').slice(0, 50)}
                          </Text>
                          <Group gap={4} mt={2}>
                            <Badge size="xs" variant="dot">
                              {(t.knowledge.questionTypes as Record<string, string>)[q.type] ??
                                q.type}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {q.points} pts
                            </Text>
                          </Group>
                        </div>
                        {markedQuestions.has(i) && (
                          <Flag
                            size={10}
                            color="var(--mantine-color-orange-5)"
                            style={{ flexShrink: 0 }}
                          />
                        )}
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Box>

          {/* Right panel — flex column: scrollable content + sticky action bar */}
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Scrollable content area */}
            <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
              <Stack gap="lg" p="lg">
                {/* Current question */}
                {currentQuestion && (
                  <QuestionCard
                    question={currentQuestion}
                    index={currentQuestionIndex}
                    total={totalQuestions}
                    value={getCurrentAnswer()}
                    onChange={isCompleted ? () => {} : handleAnswerChange}
                    disabled={isCompleted}
                    marked={markedQuestions.has(currentQuestionIndex)}
                    onToggleMark={() => toggleMark(currentQuestionIndex)}
                    showMarkButton={!isCompleted}
                  />
                )}

                {/* Feedback */}
                {currentFeedback && currentQuestion && (
                  <FeedbackCard
                    feedback={currentFeedback}
                    explanation={currentQuestion.explanation}
                    correctAnswer={currentQuestion.answer}
                  />
                )}

                {/* Back to exams link */}
                {isCompleted && (
                  <Button variant="subtle" onClick={() => router.push('/study')} mt="md">
                    Back to Exam Practice
                  </Button>
                )}
              </Stack>
            </ScrollArea>

            {/* Sticky action bar */}
            <Group
              justify="space-between"
              px="lg"
              py="sm"
              style={{ borderTop: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}
            >
              <Button
                variant="subtle"
                leftSection={<ArrowLeft size={16} />}
                disabled={currentQuestionIndex <= 0}
                onClick={() => goToQuestion(currentQuestionIndex - 1)}
              >
                Previous
              </Button>

              {!isCompleted && (
                <Button
                  loading={hasSubmitted}
                  disabled={answeredCount === 0 || hasSubmitted}
                  onClick={() => setSubmitModalOpen(true)}
                  color={getDocColor('exam')}
                >
                  {t.exam.submitAnswer} ({answeredCount}/{totalQuestions})
                </Button>
              )}

              {isCompleted && (
                <Text size="sm" c="dimmed">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </Text>
              )}

              <Button
                variant="subtle"
                rightSection={<ArrowRight size={16} />}
                disabled={currentQuestionIndex >= totalQuestions - 1}
                onClick={() => goToQuestion(currentQuestionIndex + 1)}
              >
                Next
              </Button>
            </Group>
          </Box>
        </Group>

        {/* Mobile bottom question nav */}
        <Box
          hiddenFrom="sm"
          py="xs"
          px="md"
          style={{
            borderTop: '1px solid var(--mantine-color-gray-2)',
            flexShrink: 0,
          }}
        >
          <ScrollArea type="never">
            <Group gap={6} wrap="nowrap">
              {mock.questions.map((_, i) => (
                <Button
                  key={i}
                  size="compact-xs"
                  radius="xl"
                  variant={i === currentQuestionIndex ? 'filled' : 'light'}
                  color={getStatusColor(getQuestionStatus(i))}
                  onClick={() => goToQuestion(i)}
                  miw={32}
                >
                  {i + 1}
                </Button>
              ))}
            </Group>
          </ScrollArea>
        </Box>
      </Card>

      {/* Submit modal — three phases: confirm → grading → results */}
      <ExamSubmitModal
        opened={submitModalOpen}
        onClose={() => {
          setSubmitModalOpen(false);
          setTimerExpired(false);
        }}
        mockId={mock.id}
        answers={answers}
        questions={mock.questions}
        markedQuestions={markedQuestions}
        onSubmitSuccess={handleSubmitSuccess}
        onNavigateToQuestion={(index) => setCurrentQuestionIndex(index)}
        autoSubmit={timerExpired}
      />
    </Stack>
  );
}
