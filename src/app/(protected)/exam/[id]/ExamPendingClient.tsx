'use client';

import { Check, Loader, Shuffle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  generateMockQuestions,
  getExamPapersForCourse,
  populateMockFromPaper,
  populateMockRandomMix,
} from '@/app/actions/mock-exams';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper, MockExam } from '@/types/exam';

type Source = 'real' | 'random' | 'ai';

const ExamIcon = getDocIcon('exam');

interface Props {
  mock: MockExam;
  courseCode?: string;
}

export function ExamPendingClient({ mock, courseCode }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Source selection
  const [source, setSource] = useState<Source>('ai');

  // Real exam options
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(!!courseCode);

  // Random / AI shared
  const [numQuestions, setNumQuestions] = useState<string | null>('10');

  // AI-only options
  const [topic, setTopic] = useState(courseCode ?? '');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');

  // Mode selector
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');

  // Fetch papers when courseCode is present
  useEffect(() => {
    if (!courseCode) return;
    setLoadingPapers(true);
    getExamPapersForCourse(courseCode).then((result) => {
      if (result.success) {
        setPapers(result.papers);
      } else {
        setPapers([]);
      }
      setLoadingPapers(false);
    });
  }, [courseCode]);

  // Auto-select AI source when no papers available
  useEffect(() => {
    if (!loadingPapers && papers.length === 0) {
      setSource('ai');
    }
  }, [loadingPapers, papers.length]);

  const hasPapers = papers.length > 0;
  const hasEnoughForRandom = papers.length >= 2;

  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && papers.length === 0) ||
    (source === 'ai' && !topic.trim());

  const handleStart = () => {
    setError(null);

    startTransition(async () => {
      let result: { success: true } | { success: false; error: string };

      if (source === 'real') {
        if (!selectedPaper) return;
        result = await populateMockFromPaper(mock.id, selectedPaper, selectedMode);
      } else if (source === 'random') {
        if (!courseCode) return;
        result = await populateMockRandomMix(
          mock.id,
          courseCode,
          Number(numQuestions),
          selectedMode,
        );
      } else {
        if (!topic.trim()) return;
        result = await generateMockQuestions(
          mock.id,
          topic.trim(),
          Number(numQuestions),
          (difficulty as 'easy' | 'medium' | 'hard' | 'mixed') ?? 'mixed',
          [],
          selectedMode,
        );
      }

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Box className="animate-fade-in-up">
        <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
          {t.exam.configureExam}
        </Title>
        <Text c="dimmed" size="md" fw={400} mt={2}>
          {t.exam.startExamSubtitle}
        </Text>
      </Box>

      {/* Course badge */}
      {courseCode && (
        <Group gap="xs" className="animate-fade-in-up">
          <Badge size="lg" variant="light" color={getDocColor('exam')}>
            {courseCode}
          </Badge>
        </Group>
      )}

      {isPending ? (
        <Card
          withBorder
          radius="lg"
          p="xl"
          ta="center"
          className="animate-fade-in-up animate-delay-100"
          style={{
            borderColor: 'var(--mantine-color-gray-2)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Stack align="center" gap="lg" py="xl">
            <Loader
              size={48}
              className="animate-spin"
              color={`var(--mantine-color-${getDocColor('exam')}-5)`}
            />
            <Title order={3}>
              {source === 'ai' ? 'Generating Questions...' : 'Loading Questions...'}
            </Title>
            <Text c="dimmed" maw={400}>
              {source === 'ai'
                ? `AI is creating ${numQuestions} questions on "${topic}". This may take a moment.`
                : 'Setting up your mock exam...'}
            </Text>
          </Stack>
        </Card>
      ) : (
        <Card
          withBorder
          radius="lg"
          p="xl"
          className="animate-fade-in-up animate-delay-100"
          style={{
            borderColor: 'var(--mantine-color-gray-2)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <Stack gap="lg">
            {/* 1. Source selector */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                {t.exam.selectSource}
              </Text>
              <Group grow gap="md" align="stretch">
                <SourceCard
                  active={source === 'ai'}
                  title={t.exam.aiMock}
                  description={t.exam.aiMockDesc}
                  icon={<Sparkles size={18} />}
                  onClick={() => setSource('ai')}
                  recommended
                />
                <SourceCard
                  active={source === 'real'}
                  title={t.exam.realExam}
                  description={t.exam.realExamDesc}
                  icon={<ExamIcon size={18} />}
                  onClick={() => setSource('real')}
                  disabled={!hasPapers}
                  disabledNote={
                    !hasPapers && !loadingPapers ? t.exam.noPapersAvailableShort : undefined
                  }
                />
                <SourceCard
                  active={source === 'random'}
                  title={t.exam.randomMix}
                  description={t.exam.randomMixDesc}
                  icon={<Shuffle size={18} />}
                  onClick={() => setSource('random')}
                  disabled={!hasEnoughForRandom}
                  disabledNote={
                    !hasEnoughForRandom && !loadingPapers ? t.exam.notEnoughPapers : undefined
                  }
                />
              </Group>
            </div>

            {/* 2. Source-specific options */}
            <CollapseSection visible={!!source}>
              {source === 'real' && papers.length > 0 && (
                <Select
                  label={t.exam.selectPaper}
                  placeholder="Select an exam paper"
                  data={papers.map((p) => ({
                    value: p.id,
                    label: `${p.title}${p.year ? ` (${p.year})` : ''}${p.questionCount ? ` — ${p.questionCount} Q` : ''}`,
                  }))}
                  value={selectedPaper}
                  onChange={setSelectedPaper}
                  size="md"
                />
              )}

              {source === 'random' && papers.length > 0 && (
                <Select
                  label={t.exam.numQuestions}
                  data={['5', '10', '15', '20']}
                  value={numQuestions}
                  onChange={setNumQuestions}
                  size="md"
                />
              )}

              {source === 'ai' && (
                <Stack gap="sm">
                  <TextInput
                    label={t.exam.topic}
                    placeholder="e.g., Binary Trees, Linear Regression"
                    value={topic}
                    onChange={(e) => setTopic(e.currentTarget.value)}
                    size="md"
                  />
                  <Group grow>
                    <Select
                      label={t.exam.numQuestions}
                      data={['5', '10', '15', '20']}
                      value={numQuestions}
                      onChange={setNumQuestions}
                      size="md"
                    />
                    <Select
                      label={t.exam.difficulty}
                      data={[
                        { value: 'mixed', label: 'Mixed' },
                        { value: 'easy', label: 'Easy' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'hard', label: 'Hard' },
                      ]}
                      value={difficulty}
                      onChange={setDifficulty}
                      size="md"
                    />
                  </Group>
                </Stack>
              )}
            </CollapseSection>

            {/* 3. Mode + Start */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                {t.exam.answerMode}
              </Text>
              <Group grow gap="md">
                <ModeCard
                  active={selectedMode === 'practice'}
                  title={t.exam.practiceMode}
                  description={t.exam.practiceModeDesc}
                  onClick={() => setSelectedMode('practice')}
                />
                <ModeCard
                  active={selectedMode === 'exam'}
                  title={t.exam.examMode}
                  description={t.exam.examModeDesc}
                  onClick={() => setSelectedMode('exam')}
                />
              </Group>
            </div>

            {/* Error */}
            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}

            {/* Start */}
            <Button
              size="lg"
              radius="md"
              variant="gradient"
              gradient={{
                from: `${getDocColor('exam')}.7`,
                to: `${getDocColor('exam')}.3`,
              }}
              leftSection={<Sparkles size={20} />}
              loading={isPending}
              disabled={isStartDisabled}
              onClick={handleStart}
              fullWidth
            >
              {`${t.exam.startExam}: ${source === 'real' ? t.exam.realExam : source === 'random' ? t.exam.randomMix : t.exam.aiMock} · ${selectedMode === 'practice' ? t.exam.practiceMode : t.exam.examMode}`}
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function CollapseSection({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <Box
      style={{
        maxHeight: visible ? 1000 : 0,
        opacity: visible ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 400ms ease, opacity 300ms ease',
      }}
    >
      {visible && children}
    </Box>
  );
}

function SourceCard({
  active,
  title,
  description,
  icon,
  onClick,
  recommended,
  disabled,
  disabledNote,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  recommended?: boolean;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <UnstyledButton onClick={disabled ? undefined : onClick} style={{ display: 'flex' }}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          position: 'relative',
          flex: 1,
          borderColor: active
            ? `var(--mantine-color-${getDocColor('exam')}-5)`
            : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? `var(--mantine-color-${getDocColor('exam')}-0)` : undefined,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color={getDocColor('exam')}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            <Check size={12} />
          </ThemeIcon>
        )}
        <Group gap="xs" mb={4}>
          {icon}
          <Text fw={600} size="sm">
            {title}
          </Text>
          {recommended && (
            <Badge size="xs" variant="filled" color={getDocColor('exam')}>
              ★
            </Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
        {disabled && disabledNote && (
          <Text size="xs" c="red.5" mt={2}>
            {disabledNote}
          </Text>
        )}
      </Card>
    </UnstyledButton>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          position: 'relative',
          borderColor: active
            ? `var(--mantine-color-${getDocColor('exam')}-5)`
            : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? `var(--mantine-color-${getDocColor('exam')}-0)` : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color={getDocColor('exam')}
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            <Check size={12} />
          </ThemeIcon>
        )}
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text size="xs" c="dimmed" mt={4}>
          {description}
        </Text>
      </Card>
    </UnstyledButton>
  );
}
