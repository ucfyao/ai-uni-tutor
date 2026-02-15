'use client';

import { IconLoader2 } from '@tabler/icons-react';
import { Book, Building2, ChevronDown, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Center,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
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

type Source = 'real' | 'random' | 'ai';

interface MockExamModalProps {
  opened: boolean;
  onClose: () => void;
}

/* ── Shared styles — matching NewSessionModal ── */

const selectStyles = {
  input: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    paddingRight: '24px',
    height: 'auto',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--mantine-color-dark-9)',
    width: '100%',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
  },
  wrapper: { width: '100%' },
  section: { display: 'none' },
  dropdown: {
    borderRadius: '12px',
    padding: '4px',
    border: '1px solid #e9ecef',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
};

const fieldSelectStyles = {
  input: { fontSize: '14px', borderColor: 'var(--mantine-color-gray-2)' },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '4px',
    color: 'var(--mantine-color-dark-4)',
  },
  dropdown: {
    borderRadius: '12px',
    padding: '4px',
    border: '1px solid #e9ecef',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
};

const fieldInputStyles = {
  input: { fontSize: '14px', borderColor: 'var(--mantine-color-gray-2)' },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '4px',
    color: 'var(--mantine-color-dark-4)',
  },
};

const THEME_COLOR = 'purple';

const FormRow = ({
  icon: Icon,
  label,
  children,
  active,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  active: boolean;
}) => (
  <Box
    style={{
      borderRadius: '16px',
      border: active
        ? `1.5px solid var(--mantine-color-${THEME_COLOR}-3)`
        : '1.5px solid transparent',
      backgroundColor: active ? 'white' : 'var(--mantine-color-gray-0)',
      boxShadow: active ? `0 0 0 2px var(--mantine-color-${THEME_COLOR}-0)` : 'none',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <Group gap={0} wrap="nowrap" align="stretch" w="100%" h="100%">
      <Center
        w={60}
        style={{ borderRight: active ? `1px solid var(--mantine-color-gray-1)` : 'none' }}
      >
        <ThemeIcon
          variant={active ? 'light' : 'transparent'}
          color={active ? THEME_COLOR : 'gray'}
          size={32}
          radius="lg"
        >
          <Icon size={18} strokeWidth={2} />
        </ThemeIcon>
      </Center>

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
        px="md"
      >
        <Text
          size="10px"
          fw={700}
          tt="uppercase"
          lts={1}
          c={active ? `${THEME_COLOR}.7` : 'gray.5'}
          mb={0}
        >
          {label}
        </Text>
        <Box style={{ position: 'relative', width: '100%' }}>
          {children}
          <Box
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: 'var(--mantine-color-gray-4)',
            }}
          >
            <ChevronDown size={14} strokeWidth={2} />
          </Box>
        </Box>
      </Box>
    </Group>
  </Box>
);

const MockExamModal: React.FC<MockExamModalProps> = ({ opened, onClose }) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<Source>('real');
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [numQuestions, setNumQuestions] = useState<string | null>('10');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>('mixed');
  const [pendingMode, setPendingMode] = useState<ExamMode | null>(null);

  // Force SegmentedControl remount after modal transition settles
  const [segKey, setSegKey] = useState(0);

  // Reset source & restore last selection when modal opens
  useEffect(() => {
    if (!opened) {
      setSegKey(0);
      return;
    }
    setSource('real');
    setError(null);
    // Remount SegmentedControl after pop transition (200ms) to fix indicator
    const timer = setTimeout(() => setSegKey((k) => k + 1), 220);
    const lastUni = localStorage.getItem('lastUniId');
    const lastCourse = localStorage.getItem('lastCourseId');
    if (lastUni) {
      setSelectedUniId(lastUni);
      if (lastCourse) {
        const course = COURSES.find((c) => c.id === lastCourse && c.universityId === lastUni);
        if (course) setSelectedCourseCode(course.code);
      }
    }
    return () => clearTimeout(timer);
  }, [opened]);

  const uniOptions = useMemo(
    () => (UNIVERSITIES ?? []).map((u) => ({ value: u.id, label: u.name })),
    [],
  );

  const courseOptions = useMemo(() => {
    if (!selectedUniId) return [];
    return (COURSES ?? [])
      .filter((c) => c.universityId === selectedUniId)
      .map((c) => ({ value: c.code, label: `${c.code}: ${c.name}` }));
  }, [selectedUniId]);

  useEffect(() => {
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

  const handleStart = (mode: ExamMode) => {
    setError(null);
    setPendingMode(mode);
    startTransition(async () => {
      let result;
      if (source === 'real') {
        if (!selectedPaper) return;
        result = await createRealExamMock(selectedPaper, mode);
      } else if (source === 'random') {
        if (!selectedCourseCode) return;
        result = await createRandomMixMock(selectedCourseCode, Number(numQuestions), mode);
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
        if (selectedUniId) localStorage.setItem('lastUniId', selectedUniId);
        const course = COURSES.find((c) => c.code === selectedCourseCode);
        if (course) localStorage.setItem('lastCourseId', course.id);
        onClose();
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        setError(result.error);
      }
      setPendingMode(null);
    });
  };

  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && (!selectedCourseCode || papers.length === 0)) ||
    (source === 'ai' && !topic.trim());

  const showNoPapers =
    source !== 'ai' && selectedCourseCode && !loadingPapers && papers.length === 0;

  const sourceData = [
    { value: 'real', label: t.exam.realExam },
    { value: 'random', label: t.exam.randomMix },
    { value: 'ai', label: t.exam.aiMock },
  ];

  const sourceDescMap: Record<Source, string> = {
    real: t.exam.realExamDesc,
    random: t.exam.randomMixDesc,
    ai: t.exam.aiMockDesc,
  };

  return (
    <Modal
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
          border: '1px solid rgba(255,255,255,1)',
          background: 'white',
        },
      }}
    >
      <Stack gap={24}>
        {/* Header */}
        <Group justify="space-between" align="center" mb={2}>
          <Text fw={800} size="22px" lts={-0.2} c="dark.9">
            {t.exam.startExam}
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={36}
            h={36}
            className="flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={18} strokeWidth={3} color="var(--mantine-color-gray-4)" />
          </UnstyledButton>
        </Group>

        {/* University + Course — FormRow style */}
        <Stack gap={12}>
          <FormRow icon={Building2} label={t.exam.university ?? 'University'} active={true}>
            <Select
              data={uniOptions}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseCode(null);
              }}
              placeholder={t.exam.selectUniversity ?? 'Select university'}
              variant="unstyled"
              styles={selectStyles}
              allowDeselect={false}
              searchable
            />
          </FormRow>

          <FormRow icon={Book} label={t.exam.course ?? 'Course'} active={!!selectedUniId}>
            <Select
              data={courseOptions}
              value={selectedCourseCode}
              onChange={setSelectedCourseCode}
              placeholder={
                selectedUniId
                  ? (t.exam.selectCourse ?? 'Select course')
                  : (t.exam.selectUniversityFirst ?? 'Select university first')
              }
              variant="unstyled"
              styles={selectStyles}
              disabled={!selectedUniId}
              allowDeselect={false}
              searchable
            />
          </FormRow>
        </Stack>

        {/* Source tabs */}
        <Tooltip label={sourceDescMap[source]} position="bottom" withArrow openDelay={300}>
          <SegmentedControl
            key={segKey}
            value={source}
            onChange={(v) => setSource(v as Source)}
            data={sourceData}
            fullWidth
            size="md"
            radius={12}
            color={THEME_COLOR}
            withItemsBorders={false}
            styles={{
              root: { padding: 4 },
              label: { fontWeight: 600, fontSize: '14px' },
              indicator: { borderRadius: 10 },
            }}
          />
        </Tooltip>

        {/* No papers warning */}
        {showNoPapers && (
          <Box
            px="sm"
            py={8}
            style={{
              borderRadius: 12,
              backgroundColor: 'var(--mantine-color-orange-0)',
              border: '1px solid var(--mantine-color-orange-2)',
            }}
          >
            <Text size="xs" fw={500} c="orange.8">
              {t.exam.noPapersAvailable}
            </Text>
          </Box>
        )}

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
            size="sm"
            radius={12}
            styles={fieldSelectStyles}
          />
        )}

        {source === 'random' && papers.length > 0 && (
          <Select
            label={t.exam.numQuestions}
            data={['5', '10', '15', '20']}
            value={numQuestions}
            onChange={setNumQuestions}
            size="sm"
            radius={12}
            styles={fieldSelectStyles}
          />
        )}

        {source === 'ai' && (
          <>
            <TextInput
              label={t.exam.topic}
              placeholder="e.g., Binary Trees, Linear Regression"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              size="sm"
              radius={12}
              styles={fieldInputStyles}
            />
            <Group grow gap={12}>
              <Select
                label={t.exam.numQuestions}
                data={['5', '10', '15', '20']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="sm"
                radius={12}
                styles={fieldSelectStyles}
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
                radius={12}
                styles={fieldSelectStyles}
              />
            </Group>
          </>
        )}

        {/* Error */}
        {error && (
          <Box
            px="sm"
            py={8}
            style={{
              borderRadius: 12,
              backgroundColor: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-2)',
            }}
          >
            <Text size="xs" fw={500} c="red.8">
              {error}
            </Text>
          </Box>
        )}

        {/* Action buttons */}
        <Group justify="space-between" gap={12}>
          <Tooltip label={t.exam.practiceModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="sm"
              radius="xl"
              h={40}
              px={24}
              onClick={() => handleStart('practice')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'practice'}
              color={THEME_COLOR}
              styles={{
                root: {
                  boxShadow: !isStartDisabled ? `0 6px 16px -4px rgba(147, 51, 234, 0.3)` : 'none',
                  transition: 'all 0.2s ease',
                },
                label: { fontWeight: 700, fontSize: '14px' },
              }}
            >
              {isPending && pendingMode === 'practice' ? (
                <Group gap={6}>
                  <IconLoader2 size={14} className="animate-spin" />
                  <span>{t.exam.practiceMode}</span>
                </Group>
              ) : (
                t.exam.practiceMode
              )}
            </Button>
          </Tooltip>
          <Tooltip label={t.exam.examModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="sm"
              radius="xl"
              h={40}
              px={24}
              onClick={() => handleStart('exam')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'exam'}
              variant="light"
              color={THEME_COLOR}
              styles={{
                root: { transition: 'all 0.2s ease' },
                label: { fontWeight: 700, fontSize: '14px' },
              }}
            >
              {isPending && pendingMode === 'exam' ? (
                <Group gap={6}>
                  <IconLoader2 size={14} className="animate-spin" />
                  <span>{t.exam.examMode}</span>
                </Group>
              ) : (
                t.exam.examMode
              )}
            </Button>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
};

export default MockExamModal;
