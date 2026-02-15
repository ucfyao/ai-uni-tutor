'use client';

import { IconArrowsShuffle, IconFileText, IconLoader2, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  createRandomMixMock,
  createRealExamMock,
  generateMockFromTopic,
  getExamPapersForCourse,
} from '@/app/actions/mock-exams';
import { COURSES, UNIVERSITIES } from '@/constants';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';

export function ExamEntryClient() {
  const courses = COURSES;
  const universities = UNIVERSITIES;
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<'real' | 'random' | 'ai'>('real');
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [numQuestions, setNumQuestions] = useState<string | null>('10');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');
  const [loadingPapers, setLoadingPapers] = useState(false);

  const courseOptions = (() => {
    const groups: Record<string, { value: string; label: string }[]> = {};
    for (const c of courses ?? []) {
      const uni = (universities ?? []).find((u) => u.id === c.universityId);
      const group = uni?.shortName ?? 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push({ value: c.code, label: `${c.code} — ${c.name}` });
    }
    return Object.entries(groups).map(([group, items]) => ({ group, items }));
  })();

  useEffect(() => {
    if (!selectedCourse) {
      setPapers([]);
      return;
    }
    setLoadingPapers(true);
    setSelectedPaper(null);
    getExamPapersForCourse(selectedCourse).then((result) => {
      if (result.success) {
        setPapers(result.papers);
        // Auto-switch to 'ai' if no papers available
        if (result.papers.length === 0) setSource('ai');
      } else {
        setPapers([]);
        setSource('ai');
      }
      setLoadingPapers(false);
    });
  }, [selectedCourse]);

  const handleStart = () => {
    if (!selectedCourse) return;
    setError(null);

    startTransition(async () => {
      let result;
      if (source === 'real') {
        if (!selectedPaper) return;
        result = await createRealExamMock(selectedPaper, selectedMode);
      } else if (source === 'random') {
        result = await createRandomMixMock(selectedCourse, Number(numQuestions), selectedMode);
      } else {
        if (!topic.trim()) return;
        result = await generateMockFromTopic(
          topic.trim(),
          Number(numQuestions),
          difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
          [],
        );
      }
      if (result.success) {
        router.push(`/exam/mock/${result.mockId}`);
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
          {t.exam.startExam}
        </Title>
        <Text c="dimmed" size="md" fw={400} mt={2}>
          {t.exam.startExamSubtitle}
        </Text>
      </Box>

      {/* Course + Source + Options + Mode + Start */}
      <Card
        withBorder
        radius="lg"
        p="xl"
        className="animate-fade-in-up animate-delay-100"
        style={{
          borderColor: 'var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          opacity: 0,
        }}
      >
        <Stack gap="lg">
          {/* Course selector */}
          <Select
            label="Course"
            placeholder="Select a course"
            data={courseOptions}
            value={selectedCourse}
            onChange={setSelectedCourse}
            searchable
            size="md"
          />

          {/* Source selector */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              {t.exam.selectSource}
            </Text>
            <Group grow gap="md">
              <SourceCard
                active={source === 'real'}
                title={t.exam.realExam}
                description={t.exam.realExamDesc}
                icon={<IconFileText size={18} />}
                disabled={papers.length === 0 && !loadingPapers && !!selectedCourse}
                onClick={() => setSource('real')}
              />
              <SourceCard
                active={source === 'random'}
                title={t.exam.randomMix}
                description={t.exam.randomMixDesc}
                icon={<IconArrowsShuffle size={18} />}
                disabled={papers.length === 0 && !loadingPapers && !!selectedCourse}
                onClick={() => setSource('random')}
              />
              <SourceCard
                active={source === 'ai'}
                title={t.exam.aiMock}
                description={t.exam.aiMockDesc}
                icon={<IconSparkles size={18} />}
                disabled={false}
                onClick={() => setSource('ai')}
              />
            </Group>
            {selectedCourse && papers.length === 0 && !loadingPapers && (
              <Text size="xs" c="orange" mt="xs">
                {t.exam.noPapersAvailable}
              </Text>
            )}
          </div>

          {/* Source-specific options */}
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

          {source === 'random' && (
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

          {/* Mode selector */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Mode
            </Text>
            <Group grow gap="md">
              <ModeCard
                active={selectedMode === 'practice'}
                title="Practice"
                description="Answer one question at a time with immediate feedback"
                onClick={() => setSelectedMode('practice')}
              />
              <ModeCard
                active={selectedMode === 'exam'}
                title="Exam"
                description="Answer all questions, then submit for a final score"
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

          {/* Start button */}
          <Button
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
            leftSection={
              isPending ? (
                <IconLoader2 size={20} className="animate-spin" />
              ) : (
                <IconSparkles size={20} />
              )
            }
            loading={isPending}
            disabled={
              !selectedCourse ||
              (source === 'real' && !selectedPaper) ||
              (source === 'ai' && !topic.trim())
            }
            onClick={handleStart}
            fullWidth
          >
            Start Mock Exam
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

function SourceCard({
  active,
  title,
  description,
  icon,
  disabled,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          borderColor: active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <Group gap="xs" mb={4}>
          {icon}
          <Text fw={600} size="sm">
            {title}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
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
          borderColor: active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
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
