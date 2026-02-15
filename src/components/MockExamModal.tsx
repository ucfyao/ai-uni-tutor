'use client';

import { IconArrowsShuffle, IconFileText, IconLoader2, IconSparkles } from '@tabler/icons-react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
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

  // Restore last selection from localStorage
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
        // Save last selection
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={24}
      centered
      padding={32}
      size="600px"
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
      <Stack gap="lg">
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

        {/* 1. University + Course */}
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
          <Group grow gap="sm">
            <SourceCard
              active={source === 'real'}
              title={t.exam.realExam}
              icon={<IconFileText size={16} />}
              onClick={() => setSource('real')}
            />
            <SourceCard
              active={source === 'random'}
              title={t.exam.randomMix}
              icon={<IconArrowsShuffle size={16} />}
              onClick={() => setSource('random')}
            />
            <SourceCard
              active={source === 'ai'}
              title={t.exam.aiMock}
              icon={<IconSparkles size={16} />}
              onClick={() => setSource('ai')}
            />
          </Group>
        </div>

        {/* 3. Source-specific options */}
        {source === 'real' && selectedCourseCode && !loadingPapers && papers.length === 0 && (
          <Text size="sm" c="orange">
            {t.exam.noPapersAvailable}
          </Text>
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
          <Text size="sm" c="orange">
            {t.exam.noPapersAvailable}
          </Text>
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

        {/* 4. Mode */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Mode
          </Text>
          <Group grow gap="sm">
            <ModeCard
              active={selectedMode === 'practice'}
              title="Practice"
              description="Immediate feedback per question"
              onClick={() => setSelectedMode('practice')}
            />
            <ModeCard
              active={selectedMode === 'exam'}
              title="Exam"
              description="Submit all at once for a score"
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
          radius="xl"
          h={56}
          variant="gradient"
          gradient={
            !isStartDisabled
              ? { from: 'purple.5', to: 'purple.6', deg: 90 }
              : { from: 'gray.3', to: 'gray.4', deg: 90 }
          }
          leftSection={
            isPending ? (
              <IconLoader2 size={20} className="animate-spin" />
            ) : (
              <IconSparkles size={20} />
            )
          }
          loading={isPending}
          disabled={isStartDisabled}
          onClick={handleStart}
          fullWidth
          styles={{
            root: {
              boxShadow: !isStartDisabled ? '0 10px 20px -5px rgba(147, 51, 234, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
            },
            label: { fontWeight: 700, fontSize: '15px', letterSpacing: '0.3px' },
          }}
        >
          {t.exam.startExam}
        </Button>
      </Stack>
    </Modal>
  );
};

function SourceCard({
  active,
  title,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} w="100%">
      <Card
        withBorder
        radius="md"
        p="sm"
        style={{
          borderColor: active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <Group gap={6} justify="center">
          {icon}
          <Text fw={600} size="xs">
            {title}
          </Text>
        </Group>
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
    <UnstyledButton onClick={onClick} w="100%">
      <Card
        withBorder
        radius="md"
        p="sm"
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
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
      </Card>
    </UnstyledButton>
  );
}

export default MockExamModal;
