'use client';

import { Check, Filter, Shuffle, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
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
  createRandomMixMock,
  createRealExamMock,
  generateMockFromTopic,
  getExamPapersForCourse,
} from '@/app/actions/mock-exams';
import { FullScreenModal } from '@/components/FullScreenModal';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useCourseData } from '@/hooks/useCourseData';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';

type Source = 'real' | 'random' | 'ai';

const ExamIcon = getDocIcon('exam');
const EXAM_PREFS_KEY = 'exam-course-prefs';

interface ExamEntryClientProps {
  initialCourseCode?: string | null;
  initialCourseName?: string | null;
  initialUniId?: string | null;
}

export function ExamEntryClient({
  initialCourseCode,
  initialCourseName,
  initialUniId,
}: ExamEntryClientProps = {}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // Source selection
  const [source, setSource] = useState<Source>('ai');

  // University → Course (for real / random)
  const [selectedUniId, setSelectedUniId] = useState<string | null>(initialUniId ?? null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(
    initialCourseCode ?? null,
  );
  const [courseConfirmed, setCourseConfirmed] = useState(!!initialCourseCode);

  const [modalOpen, setModalOpen] = useState(false);

  // Real exam options
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(!!initialCourseCode);

  // Random / AI shared
  const [numQuestions, setNumQuestions] = useState<string | null>('10');

  // AI-only options
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');

  // Mode (shared by all sources)
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');

  const { universities, courses: filteredCourses, allCourses } = useCourseData(selectedUniId);

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

  // Initialize from localStorage if not provided by props
  useEffect(() => {
    if (courseConfirmed) return; // If course is already confirmed by props, skip localStorage

    try {
      const stored = localStorage.getItem(EXAM_PREFS_KEY);
      if (stored) {
        const prefs = JSON.parse(stored) as { uniId?: string; courseCode?: string };
        if (prefs.uniId && prefs.courseCode) {
          setSelectedUniId(prefs.uniId);
          setSelectedCourseCode(prefs.courseCode);
          setCourseConfirmed(true);
        } else {
          setModalOpen(true);
        }
      } else {
        setModalOpen(true);
      }
    } catch {
      setModalOpen(true);
    }
  }, [courseConfirmed]); // Depend on courseConfirmed to prevent re-running if props set it

  // Persist when confirmed
  useEffect(() => {
    if (courseConfirmed && selectedUniId && selectedCourseCode) {
      localStorage.setItem(
        EXAM_PREFS_KEY,
        JSON.stringify({
          uniId: selectedUniId,
          courseCode: selectedCourseCode,
        }),
      );
    }
  }, [courseConfirmed, selectedUniId, selectedCourseCode]);

  // Reset course when university changes
  useEffect(() => {
    if (isInitialMount.current && initialCourseCode) {
      isInitialMount.current = false;
      return;
    }
    isInitialMount.current = false; // Ensure it's set to false after the first check

    setSelectedCourseCode(null);
    setPapers([]);
    setSelectedPaper(null);
  }, [selectedUniId, initialCourseCode]);

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

  // Auto-select AI source when no papers available
  useEffect(() => {
    if (courseConfirmed && !loadingPapers && papers.length === 0) {
      setSource('ai');
    }
  }, [courseConfirmed, loadingPapers, papers.length]);

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

  // Progressive disclosure conditions
  const hasPapers = papers.length > 0;
  const hasEnoughForRandom = papers.length >= 2;

  // Source config is "complete" — determines when Mode + Start appear
  const isSourceConfigured =
    (source === 'real' && !!selectedPaper) ||
    (source === 'random' && hasEnoughForRandom) ||
    (source === 'ai' && topic.trim().length > 0);

  // Button disabled logic per source
  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && (!selectedCourseCode || papers.length === 0)) ||
    (source === 'ai' && !topic.trim());

  return (
    <>
      <FullScreenModal
        opened={modalOpen}
        onClose={() => {
          if (courseConfirmed) setModalOpen(false);
        }}
        title={t.exam.selectCourseTitle}
        centered
      >
        <Stack gap="md">
          <Text c="dimmed" size="sm">
            {t.exam.selectCourseDesc}
          </Text>
          <Select
            label={t.exam.university}
            placeholder={t.exam.selectUniversity}
            data={uniOptions}
            value={selectedUniId}
            onChange={(val) => {
              setSelectedUniId(val);
              setSelectedCourseCode(null);
            }}
            searchable
            size="md"
          />
          <Select
            label={t.exam.course}
            placeholder={selectedUniId ? t.exam.selectCourse : t.exam.selectUniversityFirst}
            data={courseOptions}
            value={selectedCourseCode}
            onChange={setSelectedCourseCode}
            disabled={!selectedUniId}
            searchable
            size="md"
          />
          <Button
            size="lg"
            radius="md"
            fullWidth
            disabled={!selectedUniId || !selectedCourseCode}
            onClick={() => {
              setCourseConfirmed(true);
              setModalOpen(false);
            }}
          >
            {t.exam.startSetup}
          </Button>
        </Stack>
      </FullScreenModal>

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

        {/* Course badge + change button */}
        {courseConfirmed && (
          <Group gap="xs" className="animate-fade-in-up">
            <Badge size="lg" variant="light" color={getDocColor('exam')}>
              {initialCourseName && initialCourseCode
                ? `${initialCourseCode}: ${initialCourseName}`
                : (() => {
                    const course = allCourses.find((c) => c.code === selectedCourseCode);
                    return course ? `${course.code}: ${course.name}` : selectedCourseCode;
                  })()}
            </Badge>
            {!initialCourseCode && (
              <Button variant="subtle" size="compact-sm" onClick={() => setModalOpen(true)}>
                {t.exam.selectCourse}
              </Button>
            )}
          </Group>
        )}

        {/* Config card — only after course confirmed */}
        {courseConfirmed && (
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
                {source === 'real' &&
                  selectedCourseCode &&
                  !loadingPapers &&
                  papers.length === 0 && (
                    <Paper p="lg" radius="md" withBorder>
                      <Group>
                        <ThemeIcon
                          size={40}
                          radius="md"
                          variant="light"
                          color={getDocColor('exam')}
                        >
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

                {source === 'random' &&
                  selectedCourseCode &&
                  !loadingPapers &&
                  papers.length === 0 && (
                    <Paper p="lg" radius="md" withBorder>
                      <Group>
                        <ThemeIcon
                          size={40}
                          radius="md"
                          variant="light"
                          color={getDocColor('exam')}
                        >
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
              </CollapseSection>

              {/* 3. Mode + Start — always visible, Start disabled when config incomplete */}
              <CollapseSection visible={true}>
                <Stack gap="lg">
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
              </CollapseSection>
            </Stack>
          </Card>
        )}
      </Stack>
    </>
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
