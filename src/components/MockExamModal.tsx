'use client';

import {
  IconArrowRight,
  IconArrowsShuffle,
  IconFileText,
  IconLoader2,
  IconSparkles,
} from '@tabler/icons-react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
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

const THEME = 'purple';

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
      size="520px"
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
      <Stack gap={20}>
        {/* Header */}
        <Group justify="space-between" align="center">
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

        {/* ★ 1. Source — hero section */}
        <Group grow gap={10}>
          <SourceCard
            active={source === 'real'}
            title={t.exam.realExam}
            desc={t.exam.realExamDesc}
            icon={<IconFileText size={22} strokeWidth={1.8} />}
            onClick={() => setSource('real')}
          />
          <SourceCard
            active={source === 'random'}
            title={t.exam.randomMix}
            desc={t.exam.randomMixDesc}
            icon={<IconArrowsShuffle size={22} strokeWidth={1.8} />}
            onClick={() => setSource('random')}
          />
          <SourceCard
            active={source === 'ai'}
            title={t.exam.aiMock}
            desc={t.exam.aiMockDesc}
            icon={<IconSparkles size={22} strokeWidth={1.8} />}
            onClick={() => setSource('ai')}
          />
        </Group>

        {/* 2. University + Course — standard selects */}
        {source !== 'ai' && (
          <Group grow gap={10}>
            <Select
              label={t.exam.university ?? 'University'}
              placeholder={t.exam.selectUniversity ?? 'Select university'}
              data={uniOptions}
              value={selectedUniId}
              onChange={setSelectedUniId}
              searchable
              size="sm"
              radius="md"
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
              size="sm"
              radius="md"
            />
          </Group>
        )}

        {/* 3. Source-specific options */}
        {showNoPapers && (
          <Box
            px="sm"
            py={8}
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

        {/* 4. Mode — subtle inline toggle */}
        <Group gap={8} align="center">
          <Text size="xs" fw={600} c="gray.5">
            Mode
          </Text>
          <Group
            gap={0}
            style={{
              borderRadius: '8px',
              backgroundColor: 'var(--mantine-color-gray-0)',
              padding: '2px',
            }}
          >
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
          </Group>
        </Group>

        {/* Error */}
        {error && (
          <Box
            px="sm"
            py={8}
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

        {/* 5. Start */}
        <Button
          fullWidth
          size="lg"
          radius="xl"
          h={52}
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

/* ─── SourceCard ─── Hero-level selection card ─── */

function SourceCard({
  active,
  title,
  desc,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} style={{ flex: 1 }}>
      <Card
        withBorder
        radius="lg"
        px="sm"
        py="md"
        style={{
          borderColor: active ? `var(--mantine-color-${THEME}-4)` : 'var(--mantine-color-gray-2)',
          borderWidth: active ? '1.5px' : '1px',
          backgroundColor: active ? `var(--mantine-color-${THEME}-0)` : 'white',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          textAlign: 'center',
        }}
      >
        <Stack gap={6} align="center">
          <Box
            style={{
              color: active ? `var(--mantine-color-${THEME}-6)` : 'var(--mantine-color-gray-4)',
              transition: 'color 0.15s ease',
            }}
          >
            {icon}
          </Box>
          <Text
            size="13px"
            fw={700}
            c={active ? `${THEME}.8` : 'dark.7'}
            lh={1.2}
            style={{ transition: 'color 0.15s ease' }}
          >
            {title}
          </Text>
          <Text
            size="10px"
            c={active ? `${THEME}.5` : 'gray.4'}
            lh={1.3}
            style={{ transition: 'color 0.15s ease' }}
          >
            {desc}
          </Text>
        </Stack>
      </Card>
    </UnstyledButton>
  );
}

/* ─── ModePill ─── Minimal inline toggle ─── */

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
        borderRadius: '6px',
        padding: '4px 14px',
        backgroundColor: active ? 'white' : 'transparent',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <Text
        size="12px"
        fw={active ? 700 : 500}
        c={active ? `${THEME}.7` : 'gray.5'}
        style={{ transition: 'all 0.15s ease' }}
      >
        {label}
      </Text>
    </UnstyledButton>
  );
}

export default MockExamModal;
