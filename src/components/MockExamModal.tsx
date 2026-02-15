'use client';

import { IconLoader2 } from '@tabler/icons-react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Box,
  Button,
  Group,
  Modal,
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
import { COURSES, UNIVERSITIES } from '@/constants';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode, ExamPaper } from '@/types/exam';

type Source = 'real' | 'random' | 'ai';

interface MockExamModalProps {
  opened: boolean;
  onClose: () => void;
}

/* ── Shared styles ── */
const INPUT_RADIUS = 10;

const dropdownStyles = {
  borderRadius: '12px',
  padding: '4px',
  border: '1px solid #e9ecef',
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

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
    {
      value: 'real',
      label: (
        <Tooltip label={t.exam.realExamDesc} position="bottom" withArrow openDelay={300}>
          <span style={{ display: 'block', width: '100%' }}>{t.exam.realExam}</span>
        </Tooltip>
      ),
    },
    {
      value: 'random',
      label: (
        <Tooltip label={t.exam.randomMixDesc} position="bottom" withArrow openDelay={300}>
          <span style={{ display: 'block', width: '100%' }}>{t.exam.randomMix}</span>
        </Tooltip>
      ),
    },
    {
      value: 'ai',
      label: (
        <Tooltip label={t.exam.aiMockDesc} position="bottom" withArrow openDelay={300}>
          <span style={{ display: 'block', width: '100%' }}>{t.exam.aiMock}</span>
        </Tooltip>
      ),
    },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      radius={20}
      centered
      padding={28}
      size="460px"
      overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
      transitionProps={{ transition: 'pop', duration: 200, timingFunction: 'ease' }}
      styles={{
        content: {
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.1)',
          border: '1px solid var(--mantine-color-gray-2)',
          background: 'white',
        },
      }}
    >
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Text fw={700} size="lg" c="dark.8">
            {t.exam.startExam}
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={32}
            h={32}
            className="flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={16} strokeWidth={2.5} color="var(--mantine-color-gray-5)" />
          </UnstyledButton>
        </Group>

        {/* Source tabs */}
        <SegmentedControl
          value={source}
          onChange={(v) => setSource(v as Source)}
          data={sourceData}
          fullWidth
          size="md"
          radius="md"
          color="purple"
        />

        {/* University + Course — always shown */}
        <Group grow gap="xs">
          <Select
            label={t.exam.university ?? 'University'}
            placeholder={t.exam.selectUniversity ?? 'Select'}
            data={uniOptions}
            value={selectedUniId}
            onChange={setSelectedUniId}
            searchable
            size="sm"
            radius={INPUT_RADIUS}
            styles={{ dropdown: dropdownStyles }}
          />
          <Select
            label={t.exam.course ?? 'Course'}
            placeholder={
              selectedUniId
                ? (t.exam.selectCourse ?? 'Select')
                : (t.exam.selectUniversityFirst ?? 'Select university first')
            }
            data={courseOptions}
            value={selectedCourseCode}
            onChange={setSelectedCourseCode}
            disabled={!selectedUniId}
            searchable
            size="sm"
            radius={INPUT_RADIUS}
            styles={{ dropdown: dropdownStyles }}
          />
        </Group>

        {/* No papers warning */}
        {showNoPapers && (
          <Box
            px="sm"
            py={8}
            style={{
              borderRadius: INPUT_RADIUS,
              backgroundColor: 'var(--mantine-color-orange-0)',
              border: '1px solid var(--mantine-color-orange-2)',
            }}
          >
            <Text size="sm" fw={500} c="orange.8">
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
            radius={INPUT_RADIUS}
            styles={{ dropdown: dropdownStyles }}
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
            radius={INPUT_RADIUS}
            styles={{ dropdown: dropdownStyles }}
          />
        )}

        {/* AI: topic + count + difficulty */}
        {source === 'ai' && (
          <Stack gap="xs">
            <TextInput
              label={t.exam.topic}
              placeholder="e.g., Binary Trees, Linear Regression"
              value={topic}
              onChange={(e) => setTopic(e.currentTarget.value)}
              size="sm"
              radius={INPUT_RADIUS}
            />
            <Group grow gap="xs">
              <Select
                label={t.exam.numQuestions}
                data={['5', '10', '15', '20']}
                value={numQuestions}
                onChange={setNumQuestions}
                size="sm"
                radius={INPUT_RADIUS}
                styles={{ dropdown: dropdownStyles }}
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
                radius={INPUT_RADIUS}
                styles={{ dropdown: dropdownStyles }}
              />
            </Group>
          </Stack>
        )}

        {/* Error */}
        {error && (
          <Box
            px="sm"
            py={8}
            style={{
              borderRadius: INPUT_RADIUS,
              backgroundColor: 'var(--mantine-color-red-0)',
              border: '1px solid var(--mantine-color-red-2)',
            }}
          >
            <Text size="sm" fw={500} c="red.8">
              {error}
            </Text>
          </Box>
        )}

        {/* Action buttons — Practice / Exam */}
        <Group grow gap="sm" mt={4}>
          <Tooltip label={t.exam.practiceModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="md"
              radius="md"
              h={44}
              onClick={() => handleStart('practice')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'practice'}
              color="purple"
            >
              {isPending && pendingMode === 'practice' ? (
                <Group gap={6}>
                  <IconLoader2 size={16} className="animate-spin" />
                  <span>{t.exam.practiceMode}</span>
                </Group>
              ) : (
                t.exam.practiceMode
              )}
            </Button>
          </Tooltip>
          <Tooltip label={t.exam.examModeDesc} position="bottom" withArrow openDelay={400}>
            <Button
              size="md"
              radius="md"
              h={44}
              onClick={() => handleStart('exam')}
              disabled={isStartDisabled || isPending}
              loading={isPending && pendingMode === 'exam'}
              variant="light"
              color="purple"
            >
              {isPending && pendingMode === 'exam' ? (
                <Group gap={6}>
                  <IconLoader2 size={16} className="animate-spin" />
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
