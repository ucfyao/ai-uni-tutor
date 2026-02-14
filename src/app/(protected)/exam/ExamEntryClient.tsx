'use client';

import { IconLoader2, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { generateMockExam } from '@/app/actions/mock-exams';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode } from '@/types/exam';
import type { Course, University } from '@/types/index';

interface Props {
  courses: Course[];
  universities: University[];
}

export function ExamEntryClient({ courses, universities }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');
  const [error, setError] = useState<string | null>(null);

  const courseOptions = courses.map((c) => {
    const uni = universities.find((u) => u.id === c.universityId);
    return {
      value: c.code,
      label: `${c.code} — ${c.name}`,
      group: uni?.shortName ?? 'Other',
    };
  });

  const handleStart = () => {
    if (!selectedCourse) return;
    setError(null);

    startTransition(async () => {
      const result = await generateMockExam(selectedCourse, selectedMode);
      if (result.success) {
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Box className="animate-fade-in-up">
        <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
          {t.exam.startExam}
        </Title>
        <Text c="dimmed" size="md" fw={400} mt={2}>
          Generate mock exams from real past papers
        </Text>
      </Box>

      {/* Course + Mode + Start */}
      <Card
        withBorder
        radius="lg"
        p="xl"
        className="animate-fade-in-up animate-delay-100"
        style={{
          borderColor: 'var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          opacity: 0,
        }}
      >
        <Stack gap="lg">
          {/* Course selector */}
          <Select
            label="Course"
            placeholder="Select a course"
            data={courseOptions}
            value={selectedCourse}
            onChange={setSelectedCourse}
            searchable
            size="md"
          />

          {/* Mode selector */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Mode
            </Text>
            <Group grow gap="md">
              <ModeCard
                active={selectedMode === 'practice'}
                title="Practice"
                description="Answer one question at a time with immediate feedback"
                onClick={() => setSelectedMode('practice')}
              />
              <ModeCard
                active={selectedMode === 'exam'}
                title="Exam"
                description="Answer all questions, then submit for a final score"
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

          {/* Start button */}
          <Button
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
            leftSection={
              isPending ? (
                <IconLoader2 size={20} className="animate-spin" />
              ) : (
                <IconSparkles size={20} />
              )
            }
            loading={isPending}
            disabled={!selectedCourse}
            onClick={handleStart}
            fullWidth
          >
            Start Mock Exam
          </Button>
        </Stack>
      </Card>
    </Stack>
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
          borderColor: active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
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
