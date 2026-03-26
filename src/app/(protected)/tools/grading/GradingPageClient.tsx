'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  NativeSelect,
  Paper,
  RingProgress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useLanguage } from '@/i18n/LanguageContext';
import type { GradingResult } from '@/types/grading';

const TOOLS_COLOR = 'violet';

type GradingStage = 'idle' | 'extracting' | 'grading' | 'complete' | 'error';

interface Course {
  id: string;
  code: string;
  name: string;
}

interface Assignment {
  id: string;
  title: string;
}

export default function GradingPageClient() {
  const { t } = useLanguage();
  const router = useRouter();

  // Input state
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Grading state
  const [stage, setStage] = useState<GradingStage>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch courses on mount
  const fetchCourses = useCallback(async () => {
    if (coursesLoaded) return;
    try {
      const res = await fetch('/api/courses');
      if (!res.ok) return;
      const data = (await res.json()) as { courses: Course[] };
      setCourses(data.courses);
      setCoursesLoaded(true);
    } catch {
      // silently fail
    }
  }, [coursesLoaded]);

  // Lazy-load courses on first render
  const coursesInitRef = useRef(false);
  if (!coursesInitRef.current) {
    coursesInitRef.current = true;
    void fetchCourses();
  }

  // Fetch assignments when course changes
  const handleCourseChange = useCallback(
    async (courseId: string) => {
      setSelectedCourseId(courseId);
      setSelectedAssignmentId('');
      setAssignments([]);

      if (!courseId) return;

      setAssignmentsLoading(true);
      try {
        const res = await fetch(
          `/api/assignments?courseId=${encodeURIComponent(courseId)}&status=ready`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { assignments: Assignment[] };
        setAssignments(data.assignments);
      } catch {
        // silently fail
      } finally {
        setAssignmentsLoading(false);
      }
    },
    [],
  );

  // Submit for grading
  const handleSubmit = useCallback(async () => {
    if (!selectedAssignmentId || !file) return;

    setStage('extracting');
    setStatusMessage(t.tools.extractingAnswers);
    setErrorMessage('');
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('assignmentId', selectedAssignmentId);
      formData.append('file', file);

      const response = await fetch('/api/assignments/grade', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        setStage('error');
        setErrorMessage(t.tools.gradingFailed);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (!eventType || !data) continue;

          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;

            if (eventType === 'grading_status') {
              const s = parsed as unknown as {
                stage: GradingStage;
                message: string;
              };
              setStage(s.stage);
              if (s.stage === 'extracting') setStatusMessage(t.tools.extractingAnswers);
              else if (s.stage === 'grading') setStatusMessage(t.tools.gradingInProgress);
              else if (s.stage === 'complete') setStatusMessage(t.tools.gradingComplete);
              else if (s.stage === 'error') {
                setErrorMessage(s.message || t.tools.gradingFailed);
              }
            } else if (eventType === 'grading_result') {
              const r = parsed as unknown as { result: GradingResult };
              setResult(r.result);
            } else if (eventType === 'error') {
              const e = parsed as unknown as { message: string };
              setStage('error');
              setErrorMessage(e.message || t.tools.gradingFailed);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStage('error');
      setErrorMessage(t.tools.gradingFailed);
    }
  }, [selectedAssignmentId, file, t]);

  // Reset to input state
  const handleResubmit = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setStatusMessage('');
    setErrorMessage('');
    setResult(null);
    setFile(null);
  }, []);

  const isSubmitting = stage === 'extracting' || stage === 'grading';
  const canSubmit = !!selectedAssignmentId && !!file && !isSubmitting;
  const scorePercent = result ? Math.round((result.totalScore / result.maxScore) * 100) : 0;

  const courseSelectData = [
    { value: '', label: t.tools.selectCoursePlaceholder },
    ...courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` })),
  ];

  const assignmentSelectData =
    assignments.length > 0
      ? [
          { value: '', label: t.tools.selectAssignmentPlaceholder },
          ...assignments.map((a) => ({ value: a.id, label: a.title })),
        ]
      : [{ value: '', label: selectedCourseId ? t.tools.noAssignments : t.tools.selectAssignmentPlaceholder }];

  return (
    <>
      {/* Background gradient */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100vw',
          height: 240,
          background: `radial-gradient(ellipse at center, var(--mantine-color-${TOOLS_COLOR}-0) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ position: 'relative', zIndex: 1 }}>
          {/* Back button */}
          <Button
            variant="subtle"
            color="gray"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => router.push('/tools')}
            style={{ alignSelf: 'flex-start' }}
          >
            {t.tools.toolsHub}
          </Button>

          {/* Header */}
          <Box>
            <Group gap="sm" mb={4}>
              <ClipboardCheck size={28} color={`var(--mantine-color-${TOOLS_COLOR}-6)`} />
              <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
                {t.tools.assignmentGrading}
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              {t.tools.assignmentGradingDesc}
            </Text>
          </Box>

          {/* Input Card — visible when not showing results */}
          {stage !== 'complete' && (
            <Card withBorder radius="md" p="xl">
              <Stack gap="md">
                {/* Course select */}
                <NativeSelect
                  label={t.tools.selectCourse}
                  data={courseSelectData}
                  value={selectedCourseId}
                  onChange={(e) => void handleCourseChange(e.currentTarget.value)}
                />

                {/* Assignment select */}
                <NativeSelect
                  label={t.tools.selectAssignment}
                  data={assignmentSelectData}
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.currentTarget.value)}
                  disabled={!selectedCourseId || assignmentsLoading}
                />

                {/* File upload */}
                <Box>
                  <Text fw={500} size="sm" mb={4}>
                    {t.tools.uploadFile}
                  </Text>
                  <Dropzone
                    onDrop={(files) => setFile(files[0] ?? null)}
                    accept={[...PDF_MIME_TYPE, ...IMAGE_MIME_TYPE]}
                    maxSize={20 * 1024 * 1024}
                    maxFiles={1}
                    multiple={false}
                    disabled={isSubmitting}
                  >
                    <Stack align="center" gap="xs" py="lg">
                      <Upload
                        size={32}
                        color={`var(--mantine-color-${TOOLS_COLOR}-6)`}
                        strokeWidth={1.5}
                      />
                      {file ? (
                        <>
                          <Text fw={500} size="sm">
                            {file.name}
                          </Text>
                          <Text c="dimmed" size="xs">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </Text>
                        </>
                      ) : (
                        <Text c="dimmed" size="sm">
                          {t.tools.uploadFileHint}
                        </Text>
                      )}
                    </Stack>
                  </Dropzone>
                </Box>

                {/* Error alert */}
                {stage === 'error' && errorMessage && (
                  <Alert
                    color="red"
                    icon={<AlertTriangle size={16} />}
                    title={t.tools.gradingFailed}
                  >
                    {errorMessage}
                  </Alert>
                )}

                {/* Progress indicator */}
                {isSubmitting && (
                  <Group gap="sm" justify="center" py="sm">
                    <Loader size="sm" color={TOOLS_COLOR} />
                    <Text size="sm" c="dimmed">
                      {statusMessage}
                    </Text>
                  </Group>
                )}

                {/* Submit button */}
                <Button
                  color={TOOLS_COLOR}
                  fullWidth
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onClick={() => void handleSubmit()}
                >
                  {t.tools.startGrading}
                </Button>
              </Stack>
            </Card>
          )}

          {/* Results — visible when grading is complete */}
          {stage === 'complete' && result && (
            <Stack gap="lg">
              {/* Score card */}
              <Card withBorder radius="md" p="xl">
                <Group align="center" gap="xl" wrap="wrap" justify="center">
                  <RingProgress
                    size={120}
                    thickness={10}
                    roundCaps
                    sections={[{ value: scorePercent, color: TOOLS_COLOR }]}
                    label={
                      <Text ta="center" fw={700} size="xl">
                        {scorePercent}%
                      </Text>
                    }
                  />
                  <Stack gap="xs">
                    <Text fw={600} size="lg">
                      {t.tools.totalScore}: {result.totalScore} / {result.maxScore}
                    </Text>
                    <Text c="dimmed" size="sm" maw={400}>
                      {result.summary.overallFeedback}
                    </Text>
                  </Stack>
                </Group>
              </Card>

              {/* Format warning */}
              {result.summary.formatWarning && (
                <Alert
                  color="orange"
                  icon={<AlertTriangle size={16} />}
                  title={t.tools.formatWarning}
                >
                  {result.summary.formatWarning}
                </Alert>
              )}

              {/* Per-question feedback */}
              <Card withBorder radius="md" p="xl">
                <Title order={4} mb="md">
                  {t.tools.questionFeedback}
                </Title>
                <Stack gap="sm">
                  {result.responses.map((resp, idx) => (
                    <Paper key={idx} withBorder radius="sm" p="md">
                      <Group justify="space-between" mb="xs">
                        <Group gap="xs">
                          {resp.isCorrect ? (
                            <CheckCircle2 size={18} color="var(--mantine-color-green-6)" />
                          ) : (
                            <XCircle size={18} color="var(--mantine-color-red-6)" />
                          )}
                          <Text fw={600} size="sm">
                            Q{resp.questionIndex + 1}
                          </Text>
                        </Group>
                        <Badge
                          color={resp.isCorrect ? 'green' : 'red'}
                          variant="light"
                          size="sm"
                        >
                          {resp.score} / {resp.maxPoints}
                        </Badge>
                      </Group>
                      {resp.userAnswer && (
                        <Text c="dimmed" size="xs" mb="xs" style={{ fontStyle: 'italic' }}>
                          {resp.userAnswer}
                        </Text>
                      )}
                      <Text size="sm">{resp.feedback}</Text>
                    </Paper>
                  ))}
                </Stack>
              </Card>

              {/* Improvement suggestions */}
              {result.summary.improvements.length > 0 && (
                <Card withBorder radius="md" p="xl">
                  <Group gap="xs" mb="md">
                    <Lightbulb size={20} color={`var(--mantine-color-${TOOLS_COLOR}-6)`} />
                    <Title order={4}>{t.tools.improvements}</Title>
                  </Group>
                  <Stack gap="xs">
                    {result.summary.improvements.map((tip, idx) => (
                      <Group key={idx} gap="xs" wrap="nowrap" align="flex-start">
                        <Text fw={600} size="sm" c={TOOLS_COLOR} style={{ minWidth: 20 }}>
                          {idx + 1}.
                        </Text>
                        <Text size="sm">{tip}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* Footer */}
              <Stack align="center" gap="sm" py="md">
                <Text c="dimmed" size="xs">
                  {t.tools.gradingResultsNotSaved}
                </Text>
                <Button
                  variant="light"
                  color={TOOLS_COLOR}
                  leftSection={<RefreshCw size={16} />}
                  onClick={handleResubmit}
                >
                  {t.tools.resubmit}
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Container>
    </>
  );
}
