'use client';

import {
  IconArrowRight,
  IconArrowsShuffle,
  IconFileText,
  IconLoader2,
  IconSparkles,
} from '@tabler/icons-react';
import { Book, Building2, ChevronDown, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Center,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  createRandomMixMock,
  createRealExamMock,
  generateMockFromTopic,
  getExamPapersForCourse,
} from '@/app/actions/mock-exams';
import { COURSES, UNIVERSITIES } from '@/constants';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';

type Source = 'real' | 'random' | 'ai';

const THEME = 'purple';

/* Unstyled select inside FormRow — matches NewSessionModal exactly */
const formRowSelectStyles = {
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

interface MockExamModalProps {
  opened: boolean;
  onClose: () => void;
}

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
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');

  // Restore last selection
  useEffect(() => {
    if (!opened) return;
    const lastUni = localStorage.getItem('lastUniId');
    const lastCourse = localStorage.getItem('lastCourseId');
    if (lastUni) {
      setSelectedUniId(lastUni);
      if (lastCourse) {
        const course = COURSES.find((c) => c.id === lastCourse && c.universityId === lastUni);
        if (course) setSelectedCourseCode(course.code);
      }
    }
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
        if (selectedUniId) localStorage.setItem('lastUniId', selectedUniId);
        const course = COURSES.find((c) => c.code === selectedCourseCode);
        if (course) localStorage.setItem('lastCourseId', course.id);
        onClose();
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        setError(result.error);
      }
    });
  };

  const isStartDisabled =
    (source === 'real' && !selectedPaper) ||
    (source === 'random' && (!selectedCourseCode || papers.length === 0)) ||
    (source === 'ai' && !topic.trim());

  const showNoPapers =
    (source === 'real' || source === 'random') &&
    selectedCourseCode &&
    !loadingPapers &&
    papers.length === 0;

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

        {/* 1. University + Course — prominent FormRows (same as NewSessionModal) */}
        <Stack gap={12}>
          <FormRow icon={Building2} label={t.exam.university ?? 'University'} active={true}>
            <Select
              data={uniOptions}
              value={selectedUniId}
              onChange={(val) => {
                setSelectedUniId(val);
                setSelectedCourseCode(null);
              }}
              placeholder={PLACEHOLDERS.SELECT_UNIVERSITY}
              variant="unstyled"
              styles={formRowSelectStyles}
              allowDeselect={false}
              searchable
            />
          </FormRow>

          <FormRow icon={Book} label={t.exam.course ?? 'Course'} active={!!selectedUniId}>
            <Select
              data={courseOptions}
              value={selectedCourseCode}
              onChange={setSelectedCourseCode}
              placeholder={selectedUniId ? PLACEHOLDERS.SELECT_COURSE : PLACEHOLDERS.SELECT_FIRST}
              variant="unstyled"
              styles={formRowSelectStyles}
              disabled={!selectedUniId}
              allowDeselect={false}
              searchable
            />
          </FormRow>
        </Stack>

        {/* 2. Source + Mode — compact inline row */}
        <Group grow gap={12} align="stretch">
          <SegmentedField label={t.exam.selectSource}>
            <SourcePill
              active={source === 'real'}
              label={t.exam.realExam}
              icon={<IconFileText size={14} strokeWidth={2.2} />}
              onClick={() => setSource('real')}
            />
            <SourcePill
              active={source === 'random'}
              label={t.exam.randomMix}
              icon={<IconArrowsShuffle size={14} strokeWidth={2.2} />}
              onClick={() => setSource('random')}
            />
            <SourcePill
              active={source === 'ai'}
              label={t.exam.aiMock}
              icon={<IconSparkles size={14} strokeWidth={2.2} />}
              onClick={() => setSource('ai')}
            />
          </SegmentedField>

          <SegmentedField label="Mode">
            <ModePill
              active={selectedMode === 'practice'}
              label="Practice"
              onClick={() => setSelectedMode('practice')}
            />
            <ModePill
              active={selectedMode === 'exam'}
              label="Exam"
              onClick={() => setSelectedMode('exam')}
            />
          </SegmentedField>
        </Group>

        {/* 3. Source-specific options */}
        {showNoPapers && (
          <Box
            px="sm"
            py={10}
            style={{
              borderRadius: '10px',
              backgroundColor: 'var(--mantine-color-orange-0)',
              border: '1px solid var(--mantine-color-orange-2)',
            }}
          >
            <Text size="xs" fw={500} c="orange.8">
              {t.exam.noPapersAvailable}
            </Text>
          </Box>
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
            size="sm"
            radius="md"
            styles={{
              dropdown: {
                borderRadius: '12px',
                border: '1px solid #e9ecef',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              },
            }}
          />
        )}

        {source === 'random' && papers.length > 0 && (
          <Select
            label={t.exam.numQuestions}
            data={['5', '10', '15', '20']}
            value={numQuestions}
            onChange={setNumQuestions}
            size="sm"
            radius="md"
          />
        )}

        {source === 'ai' && (
          <Stack gap="xs">
            <TextInput
              label={t.exam.topic}
              placeholder="e.g., Binary Trees, Linear Regression"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              size="sm"
              radius="md"
            />
            <Group grow>
              <Select
                label={t.exam.numQuestions}
                data={['5', '10', '15', '20']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="sm"
                radius="md"
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
                radius="md"
              />
            </Group>
          </Stack>
        )}

        {/* Error */}
        {error && (
          <Box
            px="sm"
            py={10}
            style={{
              borderRadius: '10px',
              backgroundColor: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-2)',
            }}
          >
            <Text size="xs" fw={500} c="red.8">
              {error}
            </Text>
          </Box>
        )}

        {/* 4. Start */}
        <Button
          fullWidth
          size="lg"
          radius="xl"
          h={56}
          onClick={handleStart}
          disabled={isStartDisabled || isPending}
          loading={isPending}
          variant="gradient"
          gradient={
            !isStartDisabled
              ? { from: `${THEME}.5`, to: `${THEME}.6`, deg: 90 }
              : { from: 'gray.3', to: 'gray.4', deg: 90 }
          }
          styles={{
            root: {
              boxShadow: !isStartDisabled ? '0 10px 20px -5px rgba(147, 51, 234, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
            },
            label: {
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.3px',
              textTransform: 'uppercase' as const,
            },
          }}
          rightSection={
            !isPending && !isStartDisabled && <IconArrowRight size={18} strokeWidth={3} />
          }
        >
          {isPending ? (
            <Group gap={8}>
              <IconLoader2 size={18} className="animate-spin" />
              <span>Preparing...</span>
            </Group>
          ) : (
            t.exam.startExam
          )}
        </Button>
      </Stack>
    </Modal>
  );
};

/* ─── FormRow ─── Same dimensions as NewSessionModal ─── */

function FormRow({
  icon: Icon,
  label,
  children,
  active,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Box
      style={{
        borderRadius: '16px',
        border: active ? `1.5px solid var(--mantine-color-${THEME}-3)` : '1.5px solid transparent',
        backgroundColor: active ? 'white' : 'var(--mantine-color-gray-0)',
        boxShadow: active ? `0 0 0 2px var(--mantine-color-${THEME}-0)` : 'none',
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
          style={{ borderRight: active ? '1px solid var(--mantine-color-gray-1)' : 'none' }}
        >
          <ThemeIcon
            variant={active ? 'light' : 'transparent'}
            color={active ? THEME : 'gray'}
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
            c={active ? `${THEME}.7` : 'gray.5'}
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
}

/* ─── SegmentedField ─── Label + pill tray ─── */

function SegmentedField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="10px" fw={700} tt="uppercase" lts={1} c={`${THEME}.7`} mb={6}>
        {label}
      </Text>
      <Group
        gap={0}
        style={{
          borderRadius: '10px',
          backgroundColor: 'var(--mantine-color-gray-0)',
          padding: '3px',
        }}
      >
        {children}
      </Group>
    </div>
  );
}

/* ─── SourcePill ─── */

function SourcePill({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: '8px',
        padding: '6px 2px',
        backgroundColor: active ? 'white' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <Group gap={4} justify="center" wrap="nowrap">
        <Box
          style={{
            color: active ? `var(--mantine-color-${THEME}-6)` : 'var(--mantine-color-gray-5)',
            transition: 'color 0.15s ease',
            display: 'flex',
          }}
        >
          {icon}
        </Box>
        <Text
          size="11px"
          fw={active ? 700 : 500}
          c={active ? `${THEME}.7` : 'gray.6'}
          style={{ transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}
        >
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

/* ─── ModePill ─── */

function ModePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: '8px',
        padding: '6px 8px',
        backgroundColor: active ? 'white' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <Text
        size="11px"
        fw={active ? 700 : 500}
        c={active ? `${THEME}.7` : 'gray.6'}
        ta="center"
        style={{ transition: 'all 0.15s ease' }}
      >
        {label}
      </Text>
    </UnstyledButton>
  );
}

export default MockExamModal;
