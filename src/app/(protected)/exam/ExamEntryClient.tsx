'use client';

import { Check, FileText, Filter, Shuffle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import {
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
  createRandomMixMock,
  createRealExamMock,
  generateMockFromTopic,
  getExamPapersForCourse,
} from '@/app/actions/mock-exams';
import { useCourseData } from '@/hooks/useCourseData';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';

type Source = 'real' | 'random' | 'ai';

export function ExamEntryClient() {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Source selection
  const [source, setSource] = useState<Source>('real');

  // University → Course (for real / random)
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);

  // Real exam options
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Random / AI shared
  const [numQuestions, setNumQuestions] = useState<string | null>('10');

  // AI-only options
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');

  // Mode (shared by all sources)
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');

  const { universities, courses: filteredCourses } = useCourseData(selectedUniId);

  // University options
  const uniOptions = useMemo(
    () => universities.map((u) => ({ value: u.id, label: u.name })),
    [universities],
  );

  // Course options filtered by university
  const courseOptions = useMemo(() => {
    if (!selectedUniId) return [];
    return filteredCourses.map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }));
  }, [selectedUniId, filteredCourses]);

  // Reset course when university changes
  useEffect(() => {
    setSelectedCourseCode(null);
    setPapers([]);
    setSelectedPaper(null);
  }, [selectedUniId]);

  // Fetch papers when course changes
  useEffect(() => {
    if (!selectedCourseCode) {
      setPapers([]);
      setSelectedPaper(null);
      return;
    }
    setLoadingPapers(true);
    setSelectedPaper(null);
    getExamPapersForCourse(selectedCourseCode).then((result) => {
      if (result.success) {
        setPapers(result.papers);
      } else {
        setPapers([]);
      }
      setLoadingPapers(false);
    });
  }, [selectedCourseCode]);

  const handleStart = () => {
    setError(null);

    startTransition(async () => {
      let result;
      if (source === 'real') {
        if (!selectedPaper) return;
        result = await createRealExamMock(selectedPaper, selectedMode);
      } else if (source === 'random') {
        if (!selectedCourseCode) return;
        result = await createRandomMixMock(selectedCourseCode, Number(numQuestions), selectedMode);
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

  // Button disabled logic per source
  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && (!selectedCourseCode || papers.length === 0)) ||
    (source === 'ai' && !topic.trim());

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
          {/* 1. University + Course — always first */}
          <Group grow gap="md">
            <Select
              label={t.exam.university ?? 'University'}
              placeholder={t.exam.selectUniversity ?? 'Select university'}
              data={uniOptions}
              value={selectedUniId}
              onChange={setSelectedUniId}
              searchable
              size="md"
            />
            <Select
              label={t.exam.course ?? 'Course'}
              placeholder={
                selectedUniId
                  ? (t.exam.selectCourse ?? 'Select course')
                  : (t.exam.selectUniversityFirst ?? 'Select university first')
              }
              data={courseOptions}
              value={selectedCourseCode}
              onChange={setSelectedCourseCode}
              disabled={!selectedUniId}
              searchable
              size="md"
            />
          </Group>

          {/* 2. Source selector */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              {t.exam.selectSource}
            </Text>
            <Group grow gap="md">
              <SourceCard
                active={source === 'real'}
                title={t.exam.realExam}
                description={t.exam.realExamDesc}
                icon={<FileText size={18} />}
                onClick={() => setSource('real')}
              />
              <SourceCard
                active={source === 'random'}
                title={t.exam.randomMix}
                description={t.exam.randomMixDesc}
                icon={<Shuffle size={18} />}
                onClick={() => setSource('random')}
              />
              <SourceCard
                active={source === 'ai'}
                title={t.exam.aiMock}
                description={t.exam.aiMockDesc}
                icon={<Sparkles size={18} />}
                onClick={() => setSource('ai')}
              />
            </Group>
          </div>

          {/* 3. Source-specific options */}
          {source === 'real' && selectedCourseCode && !loadingPapers && papers.length === 0 && (
            <Paper p="lg" radius="md" withBorder>
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="indigo">
                  <Filter size={20} />
                </ThemeIcon>
                <Box flex={1}>
                  <Text fw={500}>{t.exam.noPapersTitle}</Text>
                  <Text fz="sm" c="dimmed">
                    {t.exam.noPapersDescription}
                  </Text>
                </Box>
              </Group>
            </Paper>
          )}

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

          {source === 'random' && selectedCourseCode && !loadingPapers && papers.length === 0 && (
            <Paper p="lg" radius="md" withBorder>
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color="indigo">
                  <Filter size={20} />
                </ThemeIcon>
                <Box flex={1}>
                  <Text fw={500}>{t.exam.noPapersTitle}</Text>
                  <Text fz="sm" c="dimmed">
                    {t.exam.noPapersDescription}
                  </Text>
                </Box>
              </Group>
            </Paper>
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

          {/* 4. Mode — always shown */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Mode
            </Text>
            <Group grow gap="md">
              <ModeCard
                active={selectedMode === 'practice'}
                title="Practice"
                description="Answer one at a time with immediate feedback"
                onClick={() => setSelectedMode('practice')}
              />
              <ModeCard
                active={selectedMode === 'exam'}
                title="Exam"
                description="Answer all, then submit for a final score"
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

          {/* 5. Start */}
          <Button
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo.7', to: 'indigo.3' }}
            leftSection={<Sparkles size={20} />}
            loading={isPending}
            disabled={isStartDisabled}
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
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
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
          borderColor: active ? 'var(--mantine-color-indigo-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-indigo-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color="indigo"
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
          position: 'relative',
          borderColor: active ? 'var(--mantine-color-indigo-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-indigo-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color="indigo"
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
