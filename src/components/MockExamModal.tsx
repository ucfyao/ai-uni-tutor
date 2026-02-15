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
const R = 8;

const inputStyles = {
  label: { fontSize: '12px', fontWeight: 500, marginBottom: '4px' },
  input: { borderColor: 'var(--mantine-color-gray-2)' },
  dropdown: {
    borderRadius: '10px',
    padding: '3px',
    border: '1px solid var(--mantine-color-gray-2)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  },
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
    // Remount SegmentedControl after pop transition (180ms) to fix indicator
    const timer = setTimeout(() => setSegKey((k) => k + 1), 200);
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
      radius={16}
      centered
      padding={24}
      size="460px"
      overlayProps={{ backgroundOpacity: 0.25, blur: 6, color: '#1a1b1e' }}
      transitionProps={{ transition: 'pop', duration: 180, timingFunction: 'ease' }}
      styles={{
        content: {
          boxShadow: '0 16px 40px -8px rgba(0,0,0,0.12)',
          border: '1px solid var(--mantine-color-gray-2)',
        },
      }}
    >
      <Stack gap={18}>
        {/* Header */}
        <Group justify="space-between" align="center">
          <Text fw={700} size="md" c="dark.8">
            {t.exam.startExam}
          </Text>
          <UnstyledButton
            onClick={onClose}
            w={28}
            h={28}
            className="flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={14} strokeWidth={2.5} color="var(--mantine-color-gray-5)" />
          </UnstyledButton>
        </Group>

        {/* Source tabs */}
        <Tooltip label={sourceDescMap[source]} position="bottom" withArrow openDelay={300}>
          <SegmentedControl
            key={segKey}
            value={source}
            onChange={(v) => setSource(v as Source)}
            data={sourceData}
            fullWidth
            size="sm"
            radius={R}
            color="purple"
            withItemsBorders={false}
            styles={{
              root: { padding: 4 },
              label: { fontWeight: 600, fontSize: '13.5px' },
              indicator: { borderRadius: R - 2 },
            }}
          />
        </Tooltip>

        {/* ── Form fields ── */}
        <Box
          p={14}
          style={{
            borderRadius: 12,
            backgroundColor: 'var(--mantine-color-gray-0)',
            border: '1px solid var(--mantine-color-gray-1)',
          }}
        >
          <Stack gap={10}>
            {/* University + Course */}
            <Group grow gap={8}>
              <Select
                label={t.exam.university ?? 'University'}
                placeholder={t.exam.selectUniversity ?? 'Select'}
                data={uniOptions}
                value={selectedUniId}
                onChange={setSelectedUniId}
                searchable
                size="sm"
                radius={R}
                styles={inputStyles}
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
                radius={R}
                styles={inputStyles}
              />
            </Group>

            {/* No papers warning */}
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

            {/* AI: topic + count + difficulty */}
            {source === 'ai' && (
              <>
                <TextInput
                  label={t.exam.topic}
                  placeholder="e.g., Binary Trees, Linear Regression"
                  value={topic}
                  onChange={(e) => setTopic(e.currentTarget.value)}
                  size="sm"
                  radius={R}
                  styles={inputStyles}
                />
                <Group grow gap={8}>
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
              </>
            )}
          </Stack>
        </Box>

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

        {/* Action buttons */}
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
              color="purple"
              styles={{ label: { fontWeight: 600, fontSize: '13px' } }}
            >
              {isPending && pendingMode === 'practice' ? (
                <Group gap={5}>
                  <IconLoader2 size={13} className="animate-spin" />
                  <span>{t.exam.practiceMode}</span>
                </Group>
              ) : (
                t.exam.practiceMode
              )}
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
              color="purple"
              styles={{ label: { fontWeight: 600, fontSize: '13px' } }}
            >
              {isPending && pendingMode === 'exam' ? (
                <Group gap={5}>
                  <IconLoader2 size={13} className="animate-spin" />
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
