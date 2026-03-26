'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  ClipboardCheck,
  Lightbulb,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Container,
  Group,
  Loader,
  NativeSelect,
  RingProgress,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, PDF_MIME_TYPE } from '@mantine/dropzone';
import { useDisclosure } from '@mantine/hooks';
import { fetchReadyAssignmentsByCourse } from '@/app/actions/assignments';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { useCourseData } from '@/hooks/useCourseData';
import { useLanguage } from '@/i18n/LanguageContext';
import { queryKeys } from '@/lib/query-keys';
import type { GradingResponse, GradingResult } from '@/types/grading';

const TOOLS_COLOR = 'violet';

type GradingStage = 'idle' | 'extracting' | 'grading' | 'complete' | 'error';

interface LogEntry {
  id: number;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

// ============================================================================
// Pipeline Log Components
// ============================================================================

const LOG_ICON_SIZE = 10;

function getLogColors(infoColor: string): Record<LogEntry['level'], string> {
  return {
    info: `var(--mantine-color-${infoColor}-5)`,
    success: 'var(--mantine-color-teal-5)',
    warning: 'var(--mantine-color-yellow-6)',
    error: 'var(--mantine-color-red-5)',
  };
}

function LogIcon({
  level,
  logColors,
}: {
  level: LogEntry['level'];
  logColors: Record<LogEntry['level'], string>;
}) {
  if (level === 'success')
    return <Check size={LOG_ICON_SIZE} color={logColors.success} strokeWidth={3} />;
  if (level === 'warning')
    return <CircleAlert size={LOG_ICON_SIZE} color={logColors.warning} strokeWidth={2.5} />;
  if (level === 'error')
    return <AlertTriangle size={LOG_ICON_SIZE} color={logColors.error} strokeWidth={2.5} />;
  return (
    <Box
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: logColors.info,
        flexShrink: 0,
      }}
    />
  );
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function PipelineLog({
  logs,
  isBusy,
  startTime,
}: {
  logs: LogEntry[];
  isBusy: boolean;
  startTime: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const logColors = getLogColors(TOOLS_COLOR);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs.length]);

  if (logs.length === 0) return null;

  return (
    <ScrollArea.Autosize
      mah={150}
      viewportRef={viewportRef}
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
        border: '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
      }}
    >
      <Stack gap={1} px={8} py={6}>
        {logs.map((entry) => (
          <Group key={entry.id} gap={6} wrap="nowrap" align="flex-start">
            <Box mt={3} style={{ flexShrink: 0 }}>
              <LogIcon level={entry.level} logColors={logColors} />
            </Box>
            <Text
              size="xs"
              c={entry.level === 'error' ? 'red' : entry.level === 'warning' ? 'yellow' : 'dimmed'}
              style={{
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              <Text span style={{ color: logColors.info, fontSize: 10, fontWeight: 500 }}>
                {formatElapsed(entry.timestamp - startTime)}
              </Text>{' '}
              {entry.message}
            </Text>
          </Group>
        ))}
        {isBusy && logs.length > 0 && (
          <Group gap={6} wrap="nowrap">
            <Box mt={3} style={{ flexShrink: 0 }}>
              <Loader2
                size={LOG_ICON_SIZE}
                color={logColors.info}
                strokeWidth={2.5}
                style={{ animation: 'spin 1s linear infinite' }}
              />
            </Box>
            <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>
              ...
            </Text>
          </Group>
        )}
      </Stack>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </ScrollArea.Autosize>
  );
}

// ============================================================================
// Per-Question Feedback Card
// ============================================================================

function QuestionCard({
  resp,
  t,
}: {
  resp: GradingResponse;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const [questionOpened, { toggle: toggleQuestion }] = useDisclosure(false);
  const [refOpened, { toggle: toggleRef }] = useDisclosure(false);

  const scorePercent = resp.maxPoints > 0 ? (resp.score / resp.maxPoints) * 100 : 0;
  const scoreColor = scorePercent >= 80 ? 'green' : scorePercent >= 60 ? 'yellow' : 'red';

  return (
    <Card withBorder radius="sm" p="md">
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text fw={700} size="sm">
            Q{resp.questionIndex + 1}
          </Text>
          {resp.isCorrect !== undefined && (
            <Badge variant="light" color={scoreColor === 'green' ? 'teal' : scoreColor} size="xs">
              {resp.isCorrect ? 'correct' : 'partial'}
            </Badge>
          )}
        </Group>
        <Badge color={scoreColor} variant="filled" size="sm">
          {resp.score} / {resp.maxPoints}
        </Badge>
      </Group>

      {/* Original Question (collapsible) */}
      {resp.questionContent && (
        <Box mb="sm">
          <Button variant="subtle" color="gray" size="compact-xs" onClick={toggleQuestion} mb={4}>
            {questionOpened ? '▾' : '▸'} {t.tools.originalQuestion}
          </Button>
          <Collapse in={questionOpened}>
            <Box
              p="xs"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
                border:
                  '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
              }}
            >
              <MarkdownRenderer content={resp.questionContent} compact />
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Your Answer */}
      {resp.userAnswer && (
        <Box mb="sm">
          <Text fw={600} size="xs" c="dimmed" mb={4}>
            {t.tools.yourAnswer}
          </Text>
          <Box
            p="xs"
            style={{
              borderRadius: 'var(--mantine-radius-sm)',
              background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
              border:
                '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
            }}
          >
            <MarkdownRenderer content={resp.userAnswer} compact />
          </Box>
        </Box>
      )}

      {/* Reference Answer (collapsible) */}
      {resp.referenceAnswer && (
        <Box mb="sm">
          <Button variant="subtle" color="gray" size="compact-xs" onClick={toggleRef} mb={4}>
            {refOpened ? '▾' : '▸'} {t.tools.referenceAnswerLabel}
          </Button>
          <Collapse in={refOpened}>
            <Box
              p="xs"
              style={{
                borderRadius: 'var(--mantine-radius-sm)',
                background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
                border:
                  '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
              }}
            >
              <MarkdownRenderer content={resp.referenceAnswer} compact />
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Feedback */}
      <Box>
        <MarkdownRenderer content={resp.feedback} compact />
      </Box>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function GradingPageClient() {
  const { t } = useLanguage();
  const router = useRouter();

  // Input state
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Course data via shared TanStack Query hook (cached across pages)
  const { courses, isLoading: coursesLoading } = useCourseData();

  // Assignments via TanStack Query (cached per course)
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: queryKeys.assignments.byCourse(selectedCourseId),
    queryFn: async () => {
      const result = await fetchReadyAssignmentsByCourse(selectedCourseId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
  });

  // Grading state
  const [stage, setStage] = useState<GradingStage>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Pipeline log state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [gradingStartTime, setGradingStartTime] = useState(0);
  const logIdRef = useRef(0);

  const appendLog = useCallback((message: string, level: LogEntry['level']) => {
    logIdRef.current += 1;
    setLogs((prev) => [...prev, { id: logIdRef.current, message, level, timestamp: Date.now() }]);
  }, []);

  // Reset assignment selection when course changes
  const handleCourseChange = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedAssignmentId('');
  }, []);

  // Submit for grading
  const handleSubmit = useCallback(async () => {
    if (!selectedAssignmentId || !file) return;

    const startTime = Date.now();
    setStage('extracting');
    setErrorMessage('');
    setResult(null);
    setLogs([]);
    setGradingStartTime(startTime);
    logIdRef.current = 0;

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
        appendLog(t.tools.gradingFailed, 'error');
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
              if (s.stage === 'error') {
                setErrorMessage(s.message || t.tools.gradingFailed);
              }
            } else if (eventType === 'grading_result') {
              const r = parsed as unknown as { result: GradingResult };
              setResult(r.result);
            } else if (eventType === 'log') {
              const l = parsed as unknown as {
                message: string;
                level: LogEntry['level'];
              };
              appendLog(l.message, l.level);
            } else if (eventType === 'error') {
              const e = parsed as unknown as { message: string };
              setStage('error');
              setErrorMessage(e.message || t.tools.gradingFailed);
              appendLog(e.message || t.tools.gradingFailed, 'error');
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
      appendLog(t.tools.gradingFailed, 'error');
    }
  }, [selectedAssignmentId, file, t, appendLog]);

  // Cancel grading
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setErrorMessage('');
    appendLog('Grading cancelled', 'warning');
  }, [appendLog]);

  // Resubmit — reset file + results but keep course/assignment
  const handleResubmit = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setErrorMessage('');
    setResult(null);
    setFile(null);
    setLogs([]);
  }, []);

  const isSubmitting = stage === 'extracting' || stage === 'grading';
  const canSubmit = !!selectedAssignmentId && !!file && !isSubmitting;
  const scorePercent = result ? Math.round((result.totalScore / result.maxScore) * 100) : 0;
  const ringColor = scorePercent >= 80 ? 'teal' : scorePercent >= 60 ? 'yellow' : 'red';

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
      : [
          {
            value: '',
            label: selectedCourseId ? t.tools.noAssignments : t.tools.selectAssignmentPlaceholder,
          },
        ];

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

          {/* Input Card — always visible */}
          <Card withBorder radius="md" p="xl">
            <Stack gap="md">
              {/* Course select */}
              <NativeSelect
                label={t.tools.selectCourse}
                data={courseSelectData}
                value={selectedCourseId}
                onChange={(e) => handleCourseChange(e.currentTarget.value)}
                disabled={isSubmitting}
                rightSection={coursesLoading ? <Loader size={14} /> : undefined}
              />

              {/* Assignment select */}
              <NativeSelect
                label={t.tools.selectAssignment}
                data={assignmentSelectData}
                value={selectedAssignmentId}
                onChange={(e) => setSelectedAssignmentId(e.currentTarget.value)}
                disabled={!selectedCourseId || assignmentsLoading || isSubmitting}
                rightSection={assignmentsLoading ? <Loader size={14} /> : undefined}
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
                <Card
                  withBorder
                  radius="sm"
                  p="sm"
                  style={{ borderColor: 'var(--mantine-color-red-4)' }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <AlertTriangle size={16} color="var(--mantine-color-red-6)" />
                    <Text size="sm" c="red">
                      {errorMessage}
                    </Text>
                  </Group>
                </Card>
              )}

              {/* Submit / Cancel buttons */}
              <Group gap="sm">
                <Button
                  color={TOOLS_COLOR}
                  flex={1}
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onClick={() => void handleSubmit()}
                >
                  {stage === 'complete' ? t.tools.startGrading : t.tools.startGrading}
                </Button>
                {isSubmitting && (
                  <Button variant="light" color="red" onClick={handleCancel}>
                    {t.tools.cancelGrading}
                  </Button>
                )}
                {stage === 'complete' && (
                  <Button
                    variant="light"
                    color={TOOLS_COLOR}
                    leftSection={<RefreshCw size={14} />}
                    onClick={handleResubmit}
                  >
                    {t.tools.resubmit}
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>

          {/* Pipeline Log — visible when grading has started */}
          {logs.length > 0 && (
            <Box>
              <Text fw={600} size="sm" mb={6}>
                {t.tools.pipelineLog}
              </Text>
              <PipelineLog logs={logs} isBusy={isSubmitting} startTime={gradingStartTime} />
            </Box>
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
                    sections={[{ value: scorePercent, color: ringColor }]}
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
                    <Box maw={400}>
                      <MarkdownRenderer content={result.summary.overallFeedback} compact />
                    </Box>
                  </Stack>
                </Group>
              </Card>

              {/* Format warning */}
              {result.summary.formatWarning && (
                <Card
                  withBorder
                  radius="sm"
                  p="sm"
                  style={{ borderColor: 'var(--mantine-color-orange-4)' }}
                >
                  <Group gap="xs" wrap="nowrap">
                    <AlertTriangle size={16} color="var(--mantine-color-orange-6)" />
                    <Box>
                      <Text fw={600} size="sm" c="orange">
                        {t.tools.formatWarning}
                      </Text>
                      <Text size="sm">{result.summary.formatWarning}</Text>
                    </Box>
                  </Group>
                </Card>
              )}

              {/* Per-question feedback */}
              <Box>
                <Title order={4} mb="md">
                  {t.tools.questionFeedback}
                </Title>
                <Stack gap="sm">
                  {result.responses.map((resp, idx) => (
                    <QuestionCard key={idx} resp={resp} t={t} />
                  ))}
                </Stack>
              </Box>

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
                        <Box style={{ flex: 1 }}>
                          <MarkdownRenderer content={tip} compact />
                        </Box>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              )}

              {/* Footer */}
              <Text c="dimmed" size="xs" ta="center">
                {t.tools.gradingResultsNotSaved}
              </Text>
            </Stack>
          )}
        </Stack>
      </Container>
    </>
  );
}
