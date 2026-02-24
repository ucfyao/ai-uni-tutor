'use client';

import { Shuffle, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
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

interface MockExamModalProps {
  opened: boolean;
  onClose: () => void;
  /** Pre-select university (UUID) */
  initialUniId?: string | null;
  /** Pre-select course code (e.g. "COMP3530") */
  initialCourseCode?: string | null;
}

/* ── Design tokens (4px grid · whole-pixel type scale) ── */
const ExamIcon = getDocIcon('exam');
const examColor = getDocColor('exam');
const R = 8;

const inputStyles = {
  label: {
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '4px',
    color: 'var(--mantine-color-dimmed)',
  },
  input: { borderColor: 'var(--mantine-color-gray-2)', fontSize: '14px' },
  dropdown: {
    borderRadius: '10px',
    padding: '4px',
    border: '1px solid var(--mantine-color-gray-2)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  },
};

const MockExamModal: React.FC<MockExamModalProps> = ({
  opened,
  onClose,
  initialUniId,
  initialCourseCode,
}) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<Source>('ai');
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [numQuestions, setNumQuestions] = useState<string | null>('10');
  const [pendingMode, setPendingMode] = useState<ExamMode | null>(null);
  const isInitialLoad = useRef(true);

  // AI-specific state
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');

  const { universities, courses: filteredCourses, allCourses } = useCourseData(selectedUniId);

  // Force SegmentedControl remount after modal transition settles
  const [segKey, setSegKey] = useState(0);

  // Reset source & restore last selection when modal opens
  useEffect(() => {
    if (!opened) {
      setSegKey(0);
      return;
    }
    setSource('ai');
    setError(null);
    setTopic('');
    setDifficulty('mixed');
    isInitialLoad.current = true;
    // Remount SegmentedControl after pop transition (200ms) to fix indicator
    const timer = setTimeout(() => setSegKey((k) => k + 1), 220);

    // Prefer initial props over localStorage
    if (initialUniId) {
      setSelectedUniId(initialUniId);
      if (initialCourseCode) {
        setSelectedCourseCode(initialCourseCode);
      }
    } else {
      const lastUni = localStorage.getItem('lastUniId');
      const lastCourse = localStorage.getItem('lastCourseId');
      if (lastUni) {
        setSelectedUniId(lastUni);
        if (lastCourse) {
          const course = allCourses.find((c) => c.id === lastCourse && c.universityId === lastUni);
          if (course) setSelectedCourseCode(course.code);
        }
      }
    }
    return () => clearTimeout(timer);
  }, [opened, allCourses, initialUniId, initialCourseCode]);

  const uniOptions = useMemo(
    () => universities.map((u) => ({ value: u.id, label: u.name })),
    [universities],
  );

  const courseOptions = useMemo(() => {
    if (!selectedUniId) return [];
    return filteredCourses.map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }));
  }, [selectedUniId, filteredCourses]);

  useEffect(() => {
    // Only reset if it's NOT the initial load
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    setSelectedCourseCode(null);
    setPapers([]);
    setSelectedPaper(null);
  }, [selectedUniId]);

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

  const saveSelection = () => {
    if (selectedUniId) localStorage.setItem('lastUniId', selectedUniId);
    const course = allCourses.find((c) => c.code === selectedCourseCode);
    if (course) localStorage.setItem('lastCourseId', course.id);
  };

  const handleStart = (mode: ExamMode) => {
    if (source === 'ai') {
      if (!topic.trim()) return;
      setError(null);
      setPendingMode(mode);
      startTransition(async () => {
        const result = await generateMockFromTopic(
          topic.trim(),
          Number(numQuestions),
          difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
          [],
        );
        if (result.success) {
          saveSelection();
          router.push(`/exam/mock/${result.mockId}`);
          setTimeout(onClose, 500);
        } else {
          setError(result.error);
        }
        setPendingMode(null);
      });
      return;
    }
    setError(null);
    setPendingMode(mode);
    startTransition(async () => {
      let result;
      if (source === 'real') {
        if (!selectedPaper) return;
        result = await createRealExamMock(selectedPaper, mode);
      } else {
        if (!selectedCourseCode) return;
        result = await createRandomMixMock(selectedCourseCode, Number(numQuestions), mode);
      }
      if (result.success) {
        saveSelection();
        router.push(`/exam/mock/${result.mockId}`);
        setTimeout(onClose, 500);
      } else {
        setError(result.error);
      }
      setPendingMode(null);
    });
  };

  const isStartDisabled =
    !selectedUniId ||
    !selectedCourseCode ||
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && papers.length === 0) ||
    (source === 'ai' && !topic.trim());

  const showNoPapers =
    source !== 'ai' && selectedCourseCode && !loadingPapers && papers.length === 0;

  // AI Generated first, then Real Exam, then Random Mix
  const sourceData = [
    {
      value: 'ai',
      label: (
        <Group gap={6} wrap="nowrap" justify="center">
          <Sparkles size={14} />
          <span>{t.exam.aiMock}</span>
        </Group>
      ),
    },
    {
      value: 'real',
      label: (
        <Group gap={6} wrap="nowrap" justify="center">
          <ExamIcon size={14} />
          <span>{t.exam.realExam}</span>
        </Group>
      ),
    },
    {
      value: 'random',
      label: (
        <Group gap={6} wrap="nowrap" justify="center">
          <Shuffle size={14} />
          <span>{t.exam.randomMix}</span>
        </Group>
      ),
    },
  ];

  const sourceDescMap: Record<Source, string> = {
    real: t.exam.realExamDesc,
    random: t.exam.randomMixDesc,
    ai: t.exam.aiMockDesc,
  };

  return (
    <FullScreenModal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={24}
      centered
      padding={32}
      size="500px"
      overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
      transitionProps={{ transition: 'pop', duration: 200, timingFunction: 'ease' }}
      styles={{
        content: {
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.1)',
          border: '1px solid var(--mantine-color-default-border)',
          background: 'var(--mantine-color-body)',
        },
      }}
    >
      <Stack gap={24}>
        {/* Header */}
        <Group justify="space-between" align="center">
          <Text fw={800} size="22px" lts={-0.2}>
            {t.exam.startExam}
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={36}
            h={36}
            className="flex items-center justify-center rounded-full sidebar-hover"
          >
            <X size={18} strokeWidth={3} color="var(--mantine-color-gray-4)" />
          </UnstyledButton>
        </Group>

        {/* Source tabs — AI first */}
        <Tooltip label={sourceDescMap[source]} position="bottom" withArrow openDelay={300}>
          <SegmentedControl
            key={segKey}
            value={source}
            onChange={(v) => setSource(v as Source)}
            data={sourceData}
            fullWidth
            size="md"
            radius={R}
            color={examColor}
            withItemsBorders={false}
            styles={{
              root: { padding: 4 },
              label: { fontWeight: 600, fontSize: '14px' },
              indicator: { borderRadius: R - 2 },
            }}
          />
        </Tooltip>

        {/* University + Course */}
        <Select
          placeholder={t.exam.selectUniversity ?? 'Select university'}
          data={uniOptions}
          value={selectedUniId}
          onChange={setSelectedUniId}
          searchable
          size="sm"
          radius={R}
          styles={inputStyles}
        />
        <Select
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
          size="sm"
          radius={R}
          styles={inputStyles}
        />

        {/* No papers warning (real / random only) */}
        {showNoPapers && (
          <Box
            px="xs"
            py={6}
            style={{
              borderRadius: R,
              backgroundColor: 'var(--mantine-color-orange-0)',
              border: '1px solid var(--mantine-color-orange-2)',
            }}
          >
            <Text size="xs" fw={500} c="orange.8">
              {t.exam.noPapersAvailable}
            </Text>
          </Box>
        )}

        {/* Real: paper picker */}
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
            size="sm"
            radius={R}
            styles={inputStyles}
          />
        )}

        {/* Random: question count */}
        {source === 'random' && papers.length > 0 && (
          <Select
            label={t.exam.numQuestions}
            data={['5', '10', '15', '20']}
            value={numQuestions}
            onChange={setNumQuestions}
            size="sm"
            radius={R}
            styles={inputStyles}
          />
        )}

        {/* AI: topic, question count, difficulty */}
        {source === 'ai' && (
          <Stack gap="sm">
            <TextInput
              label={t.exam.topic}
              placeholder="e.g., Binary Trees, Linear Regression"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              size="sm"
              radius={R}
              styles={inputStyles}
            />
            <Group grow>
              <Select
                label={t.exam.numQuestions}
                data={['5', '10', '15', '20']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="sm"
                radius={R}
                styles={inputStyles}
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
                size="sm"
                radius={R}
                styles={inputStyles}
              />
            </Group>
          </Stack>
        )}

        {/* Error */}
        {error && (
          <Box
            px="xs"
            py={6}
            style={{
              borderRadius: R,
              backgroundColor: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-2)',
            }}
          >
            <Text size="xs" fw={500} c="red.8">
              {error}
            </Text>
          </Box>
        )}

        {/* Action buttons — Practice & Exam mode */}
        <Group justify="space-between" gap={10}>
          <Tooltip label={t.exam.practiceModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="xs"
              radius={R}
              h={36}
              px={20}
              onClick={() => handleStart('practice')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'practice'}
              color={examColor}
              styles={{ label: { fontWeight: 600, fontSize: '13px' } }}
            >
              {t.exam.practiceMode}
            </Button>
          </Tooltip>
          <Tooltip label={t.exam.examModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="xs"
              radius={R}
              h={36}
              px={20}
              onClick={() => handleStart('exam')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'exam'}
              variant="light"
              color={examColor}
              styles={{ label: { fontWeight: 600, fontSize: '13px' } }}
            >
              {t.exam.examMode}
            </Button>
          </Tooltip>
        </Group>
      </Stack>
    </FullScreenModal>
  );
};

export default MockExamModal;
