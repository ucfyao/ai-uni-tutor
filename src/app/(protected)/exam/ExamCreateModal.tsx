'use client';

import {
  Bookmark,
  Book,
  BookOpen,
  Building2,
  Check,
  Clock,
  Loader,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { getBookmarkedPaperIds, toggleBookmark } from '@/app/actions/bookmarks';
import {
  createStandaloneMock,
  generateMockQuestions,
  getExamPapersForCourse,
  populateMockFromPaper,
  populateMockRandomMix,
} from '@/app/actions/mock-exams';
import { FullScreenModal } from '@/components/FullScreenModal';
import { getDocColor, getDocIcon } from '@/constants/doc-types';
import { useCourseData } from '@/hooks/useCourseData';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';
type Source = 'real' | 'random' | 'ai';

const ExamIcon = getDocIcon('exam');

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function ExamCreateModal({ opened, onClose }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Course selection (match NewSessionModal: university → course)
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const { universities, courses: filteredCourses, allCourses } = useCourseData(selectedUniId);
  const selectedCourse = allCourses.find((c) => c.id === selectedCourseId);
  const courseCode = selectedCourse?.code;
  const courseName = selectedCourse?.name;
  const schoolName = universities.find((u) => u.id === selectedUniId)?.name;

  // Restore last selections from localStorage
  useEffect(() => {
    if (!opened) return;
    const lastUni = localStorage.getItem('lastUniId');
    const lastCourse = localStorage.getItem('lastCourseId');
    if (lastUni) {
      setSelectedUniId(lastUni);
      if (lastCourse) {
        const courseExists = allCourses.some(
          (c) => c.id === lastCourse && c.universityId === lastUni,
        );
        if (courseExists) setSelectedCourseId(lastCourse);
      }
    }
  }, [opened, allCourses]);

  // Source selection
  const [source, setSource] = useState<Source>('ai');

  // Real exam options
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Random / AI shared
  const [numQuestions, setNumQuestions] = useState<string | null>('3');

  // AI-only options
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');

  // Mode selector
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');

  // Bookmarks
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

  // Fetch papers and bookmarks when course changes
  useEffect(() => {
    if (!courseCode || !opened) {
      setPapers([]);
      setSelectedPaper(null);
      return;
    }
    setLoadingPapers(true);
    setSelectedPaper(null);

    Promise.all([
      getExamPapersForCourse(courseCode),
      getBookmarkedPaperIds(),
    ]).then(([papersResult, bookmarks]) => {
      if (papersResult.success) {
        setPapers(papersResult.papers);
      } else {
        setPapers([]);
      }
      setBookmarkedIds(new Set(bookmarks));
      setLoadingPapers(false);
    });
  }, [courseCode, opened]);

  const handleToggleBookmark = async (paperId: string) => {
    const result = await toggleBookmark(paperId);
    if (result.success) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (result.bookmarked) {
          next.add(paperId);
        } else {
          next.delete(paperId);
        }
        return next;
      });
    }
  };

  // Auto-select AI source when no papers available
  useEffect(() => {
    if (!loadingPapers && papers.length === 0) {
      setSource('ai');
    }
  }, [loadingPapers, papers.length]);

  const hasCourse = !!courseCode;
  const hasPapers = papers.length > 0;
  const hasEnoughForRandom = papers.length >= 2;

  const realDisabled = !hasCourse || (!hasPapers && !loadingPapers);
  const realDisabledNote = !hasCourse
    ? t.exam.selectCourseFirst
    : !hasPapers && !loadingPapers
      ? t.exam.noPapersAvailableShort
      : undefined;

  const randomDisabled = !hasCourse || (!hasEnoughForRandom && !loadingPapers);
  const randomDisabledNote = !hasCourse
    ? t.exam.selectCourseFirst
    : !hasEnoughForRandom && !loadingPapers
      ? t.exam.notEnoughPapers
      : undefined;

  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && papers.length === 0) ||
    (source === 'ai' && !topic.trim());

  const handleStart = () => {
    setError(null);
    if (selectedUniId) localStorage.setItem('lastUniId', selectedUniId);
    if (selectedCourseId) localStorage.setItem('lastCourseId', selectedCourseId);

    startTransition(async () => {
      try {
        // Create a standalone mock stub first
        const stubResult = await createStandaloneMock(
          source === 'ai' ? `${topic} - Practice Exam` : 'Mock Exam',
          selectedMode,
          { courseCode: courseCode ?? null, courseName: courseName ?? null, schoolName: schoolName ?? null },
        );
        if (!stubResult.success) {
          setError(stubResult.error);
          return;
        }

        const mockId = stubResult.mockId;

        if (source === 'real') {
          if (!selectedPaper) return;
          const result = await populateMockFromPaper(mockId, selectedPaper, selectedMode);
          if (!result.success) {
            setError(result.error);
            return;
          }
        } else if (source === 'random') {
          if (!courseCode) return;
          const result = await populateMockRandomMix(
            mockId,
            courseCode,
            Number(numQuestions),
            selectedMode,
          );
          if (!result.success) {
            setError(result.error);
            return;
          }
        } else {
          if (!topic.trim()) return;
          const result = await generateMockQuestions(
            mockId,
            topic.trim(),
            Number(numQuestions),
            (difficulty as 'easy' | 'medium' | 'hard' | 'mixed') ?? 'mixed',
            [],
            selectedMode,
          );
          if (!result.success) {
            setError(result.error);
            return;
          }
        }

        onClose();
        router.push(`/exam/${mockId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    });
  };

  const examColor = getDocColor('exam');

  return (
    <FullScreenModal
      opened={opened}
      onClose={onClose}
      title={t.exam.createMockTitle}
      size="xl"
    >
      {isPending ? (
        <Stack align="center" gap="lg" py="xl">
          <Loader
            size={48}
            className="animate-spin"
            color={`var(--mantine-color-${examColor}-5)`}
          />
          <Title order={3}>
            {source === 'ai' ? t.exam.generatingQuestions : t.exam.loadingQuestions}
          </Title>
          <Text c="dimmed" maw={400} ta="center">
            {source === 'ai'
              ? t.exam.aiCreatingQuestions
                  .replace('{n}', String(numQuestions))
                  .replace('{topic}', topic)
              : t.exam.settingUpExam}
          </Text>
        </Stack>
      ) : (
        <Stack gap="lg">
          {/* 0. University + Course selector */}
          <Group grow gap="md">
            <Select
              label={t.exam.university}
              placeholder={t.exam.selectUniversity}
              data={universities.map((u) => ({ value: u.id, label: u.name }))}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseId(null);
              }}
              searchable
              size="md"
              leftSection={<Building2 size={16} />}

            />
            <Select
              label={t.exam.course}
              placeholder={selectedUniId ? t.exam.selectCourse : t.exam.selectUniversityFirst}
              data={filteredCourses.map((c) => ({ value: c.id, label: `${c.code}: ${c.name}` }))}
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              searchable
              size="md"
              disabled={!selectedUniId}
              leftSection={<Book size={16} />}

            />
          </Group>

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
                recommended={!hasPapers && !loadingPapers}
                color={examColor}
              />
              <SourceCard
                active={source === 'real'}
                title={t.exam.realExam}
                description={t.exam.realExamDesc}
                icon={<ExamIcon size={18} />}
                onClick={() => setSource('real')}
                recommended={hasPapers}
                disabled={realDisabled}
                disabledNote={realDisabledNote}
                color={examColor}
              />
              <SourceCard
                active={source === 'random'}
                title={t.exam.randomMix}
                description={t.exam.randomMixDesc}
                icon={<Shuffle size={18} />}
                onClick={() => setSource('random')}
                disabled={randomDisabled}
                disabledNote={randomDisabledNote}
                color={examColor}
              />
            </Group>
          </div>

          {/* 2. Source-specific options */}
          <CollapseSection visible={!!source}>
            {source === 'real' && papers.length > 0 && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {t.exam.selectPaper}
                  </Text>
                  <Switch
                    label={t.exam.bookmarkedOnly}
                    size="xs"
                    checked={showBookmarkedOnly}
                    onChange={(e) => setShowBookmarkedOnly(e.currentTarget.checked)}
                  />
                </Group>
                <Select
                  placeholder={t.exam.selectExamPaperPlaceholder}
                  data={papers
                    .filter((p) => !showBookmarkedOnly || bookmarkedIds.has(p.id))
                    .sort((a, b) => {
                      const aBookmarked = bookmarkedIds.has(a.id) ? 0 : 1;
                      const bBookmarked = bookmarkedIds.has(b.id) ? 0 : 1;
                      return aBookmarked - bBookmarked;
                    })
                    .map((p) => ({
                      value: p.id,
                      label: `${bookmarkedIds.has(p.id) ? '★ ' : ''}${p.title}${p.year ? ` (${p.year})` : ''}${p.questionCount ? ` — ${p.questionCount} Q` : ''}`,
                    }))}
                  value={selectedPaper}
                  onChange={setSelectedPaper}
                  size="md"
    
                  rightSection={
                    selectedPaper ? (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        color={bookmarkedIds.has(selectedPaper) ? 'yellow' : 'gray'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(selectedPaper);
                        }}
                      >
                        <Bookmark
                          size={14}
                          fill={bookmarkedIds.has(selectedPaper) ? 'currentColor' : 'none'}
                        />
                      </ActionIcon>
                    ) : undefined
                  }
                />
              </Stack>
            )}

            {source === 'random' && papers.length > 0 && (
              <Select
                label={t.exam.numQuestions}
                data={['1', '3', '5']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="md"
  
              />
            )}

            {source === 'ai' && (
              <Stack gap="sm">
                <TextInput
                  label={t.exam.topic}
                  placeholder={t.exam.topicPlaceholder}
                  value={topic}
                  onChange={(e) => setTopic(e.currentTarget.value)}
                  size="md"
                />
                <Group grow>
                  <Select
                    label={t.exam.numQuestions}
                    data={['1', '3', '5']}
                    value={numQuestions}
                    onChange={setNumQuestions}
                    size="md"
      
                  />
                  <Select
                    label={t.exam.difficulty}
                    data={[
                      { value: 'mixed', label: t.exam.difficultyMixed },
                      { value: 'easy', label: t.exam.difficultyEasy },
                      { value: 'medium', label: t.exam.difficultyMedium },
                      { value: 'hard', label: t.exam.difficultyHard },
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
            <Group grow gap="md" align="stretch">
              <ModeCard
                active={selectedMode === 'practice'}
                title={t.exam.practiceMode}
                description={t.exam.practiceModeDesc}
                icon={<BookOpen size={18} />}
                onClick={() => setSelectedMode('practice')}
                color={examColor}
              />
              <ModeCard
                active={selectedMode === 'exam'}
                title={t.exam.examMode}
                description={t.exam.examModeDesc}
                icon={<Clock size={18} />}
                onClick={() => setSelectedMode('exam')}
                color={examColor}
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
            gradient={{ from: `${examColor}.7`, to: `${examColor}.3` }}
            leftSection={<Sparkles size={20} />}
            loading={isPending}
            disabled={isStartDisabled}
            onClick={handleStart}
            fullWidth
          >
            {`${t.exam.startExam}: ${source === 'real' ? t.exam.realExam : source === 'random' ? t.exam.randomMix : t.exam.aiMock} · ${selectedMode === 'practice' ? t.exam.practiceMode : t.exam.examMode}`}
          </Button>
        </Stack>
      )}
    </FullScreenModal>
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
  color,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  recommended?: boolean;
  disabled?: boolean;
  disabledNote?: string;
  color: string;
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
            ? `var(--mantine-color-${color}-5)`
            : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? `var(--mantine-color-${color}-0)` : undefined,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color={color}
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
            <Badge size="xs" variant="filled" color={color}>
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
  icon,
  onClick,
  color,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  color: string;
}) {
  return (
    <UnstyledButton onClick={onClick} style={{ display: 'flex' }}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          position: 'relative',
          flex: 1,
          borderColor: active
            ? `var(--mantine-color-${color}-5)`
            : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? `var(--mantine-color-${color}-0)` : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        {active && (
          <ThemeIcon
            size={20}
            radius="xl"
            color={color}
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
