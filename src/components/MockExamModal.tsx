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

const selectStyles = {
  input: {
    border: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    paddingRight: '20px',
    height: 'auto',
    fontSize: '13px',
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
      size="540px"
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

        {/* 1. University + Course — compact FormRow */}
        <Stack gap={8}>
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
              placeholder={selectedUniId ? PLACEHOLDERS.SELECT_COURSE : PLACEHOLDERS.SELECT_FIRST}
              variant="unstyled"
              styles={selectStyles}
              disabled={!selectedUniId}
              allowDeselect={false}
              searchable
            />
          </FormRow>
        </Stack>

        {/* 2. Source selector — segmented pills */}
        <div>
          <Text size="10px" fw={700} tt="uppercase" lts={1} c={`${THEME}.7`} mb={8}>
            {t.exam.selectSource}
          </Text>
          <Group
            gap={0}
            style={{
              borderRadius: '12px',
              backgroundColor: 'var(--mantine-color-gray-0)',
              padding: '4px',
            }}
          >
            <SourcePill
              active={source === 'real'}
              label={t.exam.realExam}
              icon={<IconFileText size={15} strokeWidth={2.2} />}
              onClick={() => setSource('real')}
            />
            <SourcePill
              active={source === 'random'}
              label={t.exam.randomMix}
              icon={<IconArrowsShuffle size={15} strokeWidth={2.2} />}
              onClick={() => setSource('random')}
            />
            <SourcePill
              active={source === 'ai'}
              label={t.exam.aiMock}
              icon={<IconSparkles size={15} strokeWidth={2.2} />}
              onClick={() => setSource('ai')}
            />
          </Group>
        </div>

        {/* 3. Source-specific options */}
        {showNoPapers && (
          <Box
            p="sm"
            style={{
              borderRadius: '12px',
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
            size="md"
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
            size="md"
            radius="md"
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
              radius="md"
            />
            <Group grow>
              <Select
                label={t.exam.numQuestions}
                data={['5', '10', '15', '20']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="md"
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
                size="md"
                radius="md"
              />
            </Group>
          </Stack>
        )}

        {/* 4. Mode — segmented pills */}
        <div>
          <Text size="10px" fw={700} tt="uppercase" lts={1} c={`${THEME}.7`} mb={8}>
            Mode
          </Text>
          <Group
            gap={0}
            style={{
              borderRadius: '12px',
              backgroundColor: 'var(--mantine-color-gray-0)',
              padding: '4px',
            }}
          >
            <ModePill
              active={selectedMode === 'practice'}
              label="Practice"
              desc="Feedback per question"
              onClick={() => setSelectedMode('practice')}
            />
            <ModePill
              active={selectedMode === 'exam'}
              label="Exam"
              desc="Submit all for a score"
              onClick={() => setSelectedMode('exam')}
            />
          </Group>
        </div>

        {/* Error */}
        {error && (
          <Box
            p="sm"
            style={{
              borderRadius: '12px',
              backgroundColor: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-2)',
            }}
          >
            <Text size="xs" fw={500} c="red.8">
              {error}
            </Text>
          </Box>
        )}

        {/* 5. Start */}
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

/* ─── FormRow ─── Matches NewSessionModal's row pattern ─── */

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
        borderRadius: '12px',
        border: active ? `1.5px solid var(--mantine-color-${THEME}-3)` : '1.5px solid transparent',
        backgroundColor: active ? 'white' : 'var(--mantine-color-gray-0)',
        boxShadow: active ? `0 0 0 2px var(--mantine-color-${THEME}-0)` : 'none',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Group gap={0} wrap="nowrap" align="stretch" w="100%" h="100%">
        <Center
          w={44}
          style={{ borderRight: active ? '1px solid var(--mantine-color-gray-1)' : 'none' }}
        >
          <ThemeIcon
            variant={active ? 'light' : 'transparent'}
            color={active ? THEME : 'gray'}
            size={26}
            radius="md"
          >
            <Icon size={14} strokeWidth={2} />
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
          px="sm"
        >
          <Text
            size="9px"
            fw={700}
            tt="uppercase"
            lts={0.8}
            c={active ? `${THEME}.7` : 'gray.5'}
            mb={0}
            lh={1}
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
              <ChevronDown size={12} strokeWidth={2} />
            </Box>
          </Box>
        </Box>
      </Group>
    </Box>
  );
}

/* ─── SourcePill ─── Segmented toggle for question source ─── */

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
        borderRadius: '10px',
        padding: '8px 4px',
        backgroundColor: active ? 'white' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <Group gap={5} justify="center" wrap="nowrap">
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
          size="12px"
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

/* ─── ModePill ─── Segmented toggle for exam mode ─── */

function ModePill({
  active,
  label,
  desc,
  onClick,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: '10px',
        padding: '10px 12px',
        backgroundColor: active ? 'white' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <Text
        size="13px"
        fw={active ? 700 : 500}
        c={active ? `${THEME}.7` : 'gray.6'}
        ta="center"
        style={{ transition: 'all 0.15s ease' }}
      >
        {label}
      </Text>
      <Text
        size="10px"
        c={active ? `${THEME}.5` : 'gray.4'}
        ta="center"
        mt={2}
        style={{ transition: 'all 0.15s ease' }}
      >
        {desc}
      </Text>
    </UnstyledButton>
  );
}

export default MockExamModal;
