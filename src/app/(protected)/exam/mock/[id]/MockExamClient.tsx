'use client';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconSend,
  IconTrophy,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Progress,
  ScrollArea,
  Stack,
  Switch,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { batchSubmitMockAnswers, submitMockAnswer } from '@/app/actions/mock-exams';
import { FeedbackCard } from '@/components/exam/FeedbackCard';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { MockExam, MockExamResponse } from '@/types/exam';

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
  const [mock, setMock] = useState(initialMock);
  const [isPending, startTransition] = useTransition();

  // Mode locked from record
  const mode = mock.mode;
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Navigation
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    initialMock.status === 'completed' ? 0 : initialMock.currentIndex,
  );

  // Practice mode state
  const [practiceUserAnswer, setPracticeUserAnswer] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<MockExamResponse | null>(null);

  // Exam mode state
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examResults, setExamResults] = useState<MockExamResponse[]>([]);

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompleted = mock.status === 'completed' || examSubmitted;
  const currentQuestion = mock.questions[currentQuestionIndex];
  const totalQuestions = mock.questions.length;

  // Timer countdown
  useEffect(() => {
    if (timerEnabled && !isCompleted) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Auto-submit in exam mode when time expires
            if (mode === 'exam') {
              handleBatchSubmit();
            }
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerEnabled, isCompleted]);

  // Determine question status for sidebar
  const getQuestionStatus = (index: number) => {
    if (index === currentQuestionIndex) return 'active';
    if (isCompleted) {
      // Check if we have feedback for it
      const response =
        mock.status === 'completed'
          ? mock.responses[index]
          : examResults.find((r) => r.questionIndex === index);
      if (response) return response.isCorrect ? 'correct' : 'incorrect';
      return 'unanswered';
    }
    if (mode === 'practice') {
      const hasResponse = mock.responses.some((r) => r.questionIndex === index);
      return hasResponse ? 'submitted' : 'unanswered';
    }
    // Exam mode
    return examAnswers[index] ? 'answered' : 'unanswered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'violet';
      case 'submitted':
        return 'green';
      case 'correct':
        return 'green';
      case 'incorrect':
        return 'red';
      case 'answered':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Practice mode: submit single answer
  const handlePracticeSubmit = useCallback(() => {
    if (!practiceUserAnswer.trim()) return;
    setHasSubmitted(true);

    startTransition(async () => {
      const result = await submitMockAnswer(mock.id, currentQuestionIndex, practiceUserAnswer);
      if (result.success) {
        setPracticeFeedback(result.feedback);
        setMock((prev) => ({
          ...prev,
          responses: [...prev.responses, result.feedback],
        }));
      }
    });
  }, [mock.id, currentQuestionIndex, practiceUserAnswer]);

  // Practice mode: go to next question
  const handlePracticeNext = useCallback(() => {
    setPracticeFeedback(null);
    setPracticeUserAnswer('');

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= totalQuestions) {
      setMock((prev) => ({
        ...prev,
        status: 'completed',
        score: prev.responses.reduce((sum, r) => sum + r.score, 0),
        currentIndex: totalQuestions,
      }));
      setCurrentQuestionIndex(0); // Reset to first for review
    } else {
      setCurrentQuestionIndex(nextIndex);
      setMock((prev) => ({ ...prev, currentIndex: nextIndex }));
    }
  }, [currentQuestionIndex, totalQuestions]);

  // Exam mode: update answer for current question
  const handleExamAnswerChange = useCallback(
    (value: string) => {
      setExamAnswers((prev) => ({ ...prev, [currentQuestionIndex]: value }));
    },
    [currentQuestionIndex],
  );

  // Exam mode: batch submit all answers
  const handleBatchSubmit = useCallback(() => {
    const answersToSubmit = Object.entries(examAnswers)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => ({ questionIndex: Number(k), userAnswer: v }));

    if (answersToSubmit.length === 0) return;
    setHasSubmitted(true);

    startTransition(async () => {
      const result = await batchSubmitMockAnswers(mock.id, answersToSubmit);
      if (result.success) {
        setExamResults(result.result.responses);
        setExamSubmitted(true);
        setMock((prev) => ({
          ...prev,
          status: 'completed',
          score: result.result.score,
          responses: result.result.responses,
          currentIndex: totalQuestions,
        }));
        setCurrentQuestionIndex(0); // Show first question for review
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock.id, examAnswers, totalQuestions]);

  // Navigate to question
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    // In practice mode, clear current answer/feedback when navigating to a new question
    if (mode === 'practice' && !isCompleted) {
      setPracticeUserAnswer('');
      setPracticeFeedback(null);
    }
  };

  // Get current answer value
  const getCurrentAnswer = () => {
    if (isCompleted) {
      // Show submitted answer in review
      const response =
        mock.responses[currentQuestionIndex] ??
        examResults.find((r) => r.questionIndex === currentQuestionIndex);
      return response?.userAnswer ?? '';
    }
    if (mode === 'practice') return practiceUserAnswer;
    return examAnswers[currentQuestionIndex] ?? '';
  };

  // Get current feedback
  const getCurrentFeedback = (): MockExamResponse | null => {
    if (mode === 'practice' && practiceFeedback) return practiceFeedback;
    if (isCompleted) {
      return (
        mock.responses[currentQuestionIndex] ??
        examResults.find((r) => r.questionIndex === currentQuestionIndex) ??
        null
      );
    }
    return null;
  };

  const answeredCount =
    mode === 'exam'
      ? Object.values(examAnswers).filter((v) => v.trim()).length
      : mock.responses.length;
  const progressValue = isCompleted ? 100 : (answeredCount / totalQuestions) * 100;

  const currentFeedback = getCurrentFeedback();
  const isPracticeAnswered =
    mode === 'practice' && mock.responses.some((r) => r.questionIndex === currentQuestionIndex);

  return (
    <Stack gap="md">
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
              <Text size="sm" fw={700} ff="monospace" c={timeRemaining < 300 ? 'red' : undefined}>
                {formatTime(timeRemaining)}
              </Text>
            )}
          </Group>
        )}

        {isCompleted && mock.score !== null && (
          <Group gap="xs">
            <IconTrophy size={18} color="gold" />
            <Text fw={700}>
              {mock.score}/{mock.totalPoints}
            </Text>
          </Group>
        )}
      </Group>

      {/* Progress bar */}
      <Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
        <Progress value={progressValue} size="sm" color="indigo" />
      </Box>

      {/* Two-column layout */}
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
        }}
      >
        <Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 500 }}>
          {/* Left sidebar — Question list */}
          <Box
            w={280}
            style={{
              flexShrink: 0,
              borderRight: '1px solid var(--mantine-color-gray-3)',
            }}
          >
            <ScrollArea h="calc(100vh - 200px)" style={{ maxHeight: 600 }}>
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
                          ? '3px solid var(--mantine-color-violet-5)'
                          : '3px solid transparent',
                        backgroundColor: isActive ? 'var(--mantine-color-violet-0)' : undefined,
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
                          {status === 'submitted' || status === 'correct' ? (
                            <IconCheck size={12} />
                          ) : (
                            i + 1
                          )}
                        </Badge>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" lineClamp={1}>
                            {q.content.replace(/[#*_`$\\]/g, '').slice(0, 50)}
                          </Text>
                          <Group gap={4} mt={2}>
                            <Badge size="xs" variant="dot">
                              {q.type}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {q.points} pts
                            </Text>
                          </Group>
                        </div>
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Box>

          {/* Right panel — Question detail */}
          <Box style={{ flex: 1, minWidth: 0 }} p="lg">
            <Stack gap="lg">
              {/* Completion score card */}
              {isCompleted &&
                mock.score !== null &&
                currentQuestionIndex === 0 &&
                !currentFeedback && (
                  <Card
                    withBorder
                    radius="lg"
                    p="xl"
                    ta="center"
                    style={{
                      borderColor: 'var(--mantine-color-gray-2)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <IconTrophy size={48} color="gold" />
                    <Title order={2} mt="md">
                      Exam Completed!
                    </Title>
                    <Text size="xl" fw={700} mt="sm">
                      {mock.score}/{mock.totalPoints}
                    </Text>
                    <Progress
                      value={(mock.score / mock.totalPoints) * 100}
                      mt="md"
                      size="lg"
                      color={mock.score / mock.totalPoints >= 0.6 ? 'green' : 'red'}
                    />
                    <Text size="sm" c="dimmed" mt="md">
                      Click any question in the sidebar to review
                    </Text>
                  </Card>
                )}

              {/* Current question */}
              {currentQuestion && (
                <QuestionCard
                  question={currentQuestion}
                  index={currentQuestionIndex}
                  total={totalQuestions}
                  value={getCurrentAnswer()}
                  onChange={
                    isCompleted || isPracticeAnswered
                      ? () => {}
                      : mode === 'practice'
                        ? setPracticeUserAnswer
                        : handleExamAnswerChange
                  }
                  disabled={isCompleted || isPracticeAnswered || !!practiceFeedback}
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

              {/* Actions */}
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  leftSection={<IconArrowLeft size={16} />}
                  disabled={currentQuestionIndex <= 0}
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                >
                  Previous
                </Button>

                {!isCompleted &&
                  mode === 'practice' &&
                  !practiceFeedback &&
                  !isPracticeAnswered && (
                    <Button
                      leftSection={<IconCheck size={16} />}
                      loading={isPending}
                      disabled={!practiceUserAnswer.trim()}
                      onClick={handlePracticeSubmit}
                    >
                      Submit Answer
                    </Button>
                  )}

                {!isCompleted &&
                  mode === 'practice' &&
                  (practiceFeedback || isPracticeAnswered) && (
                    <Button
                      rightSection={<IconArrowRight size={16} />}
                      onClick={handlePracticeNext}
                    >
                      {currentQuestionIndex >= totalQuestions - 1 ? 'Finish Exam' : 'Next Question'}
                    </Button>
                  )}

                {!isCompleted && mode === 'exam' && (
                  <Button
                    leftSection={<IconSend size={16} />}
                    loading={isPending}
                    disabled={answeredCount === 0}
                    onClick={handleBatchSubmit}
                    color="violet"
                  >
                    Submit All ({answeredCount}/{totalQuestions})
                  </Button>
                )}

                {isCompleted && (
                  <Text size="sm" c="dimmed">
                    {currentQuestionIndex + 1} / {totalQuestions}
                  </Text>
                )}

                <Button
                  variant="subtle"
                  rightSection={<IconArrowRight size={16} />}
                  disabled={currentQuestionIndex >= totalQuestions - 1}
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                >
                  Next
                </Button>
              </Group>

              {/* Back to exams link */}
              {isCompleted && (
                <Button variant="subtle" onClick={() => router.push('/exam')} mt="md">
                  Back to Exam Practice
                </Button>
              )}
            </Stack>
          </Box>
        </Group>
      </Card>
    </Stack>
  );
}
