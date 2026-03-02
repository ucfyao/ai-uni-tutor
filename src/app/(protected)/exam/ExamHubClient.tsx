'use client';

import {
  ArrowUpDown,
  Clock,
  Play,
  Plus,
  RotateCcw,
  Search,
  Target,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { deleteMockExam, retakeMockExam } from '@/app/actions/mock-exams';
import { getDocColor } from '@/constants/doc-types';
import { useExamFilters } from '@/hooks/useExamFilters';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { MockExam } from '@/types/exam';
import { ExamCreateModal } from './ExamCreateModal';

interface Props {
  initialInProgress: MockExam[];
  initialCompleted: MockExam[];
}

export function ExamHubClient({ initialInProgress, initialCompleted }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const {
    searchInput,
    setSearchInput,
    sortOrder,
    setSortOrder,
    clearAll,
    filteredInProgress,
    filteredCompleted,
    hasActiveFilters,
  } = useExamFilters(initialInProgress, initialCompleted);

  const handleRetake = (mockId: string) => {
    modals.openConfirmModal({
      title: t.exam.retake,
      children: <Text size="sm">{t.exam.confirmRetake}</Text>,
      labels: { confirm: t.exam.retake, cancel: t.exam.cancel },
      onConfirm: () => {
        setPendingAction(`retake-${mockId}`);
        startTransition(async () => {
          const result = await retakeMockExam(mockId);
          setPendingAction(null);
          if (result.success) {
            router.push(`/exam/${result.mockId}`);
          } else {
            showNotification({ message: result.error, color: 'red' });
          }
        });
      },
    });
  };

  const handleDelete = (mockId: string) => {
    modals.openConfirmModal({
      title: t.exam.deleteExam,
      children: <Text size="sm">{t.exam.confirmDelete}</Text>,
      labels: { confirm: t.exam.deleteExam, cancel: t.exam.cancel },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setPendingAction(`delete-${mockId}`);
        startTransition(async () => {
          const result = await deleteMockExam(mockId);
          setPendingAction(null);
          if (result.success) {
            router.refresh();
          } else {
            showNotification({ message: result.error, color: 'red' });
          }
        });
      },
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  };

  const formatCourse = (mock: MockExam) => {
    if (mock.courseCode) return mock.courseCode;
    return '—';
  };

  const examColor = getDocColor('exam');

  return (
    <Container size="lg" py="xl">
      {/* Background gradient */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100vw',
          height: 240,
          background: `radial-gradient(ellipse at center, var(--mantine-color-${examColor}-0) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.5,
        }}
      />

      <Stack gap="xl" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Group justify="space-between" align="flex-end">
          <Box>
            <Group gap="sm" mb={4}>
              <Target size={28} color={`var(--mantine-color-${examColor}-6)`} />
              <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
                {t.exam.examHub}
              </Title>
            </Group>
            <Text c="dimmed" size="sm">
              {t.exam.startExamSubtitle}
            </Text>
          </Box>
          <Button
            leftSection={<Plus size={18} />}
            variant="gradient"
            gradient={{ from: `${examColor}.7`, to: `${examColor}.4` }}
            radius="md"
            size="md"
            onClick={() => setCreateModalOpen(true)}
          >
            {t.exam.newMock}
          </Button>
        </Group>

        {/* In-progress section */}
        {filteredInProgress.length > 0 && (
          <Box>
            <Group gap="xs" mb="sm">
              <Clock size={16} color={`var(--mantine-color-${examColor}-6)`} />
              <Text fw={600} size="sm">
                {t.exam.inProgress}
              </Text>
              <Badge size="sm" variant="light" color={examColor}>
                {filteredInProgress.length}
              </Badge>
            </Group>
            <Group gap="md" wrap="wrap">
              {filteredInProgress.map((mock) => (
                <Card
                  key={mock.id}
                  withBorder
                  radius="md"
                  p="md"
                  w={280}
                  style={{
                    cursor: 'pointer',
                    borderColor: `var(--mantine-color-${examColor}-3)`,
                    backgroundColor: `var(--mantine-color-${examColor}-0)`,
                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                  onClick={() => router.push(`/exam/${mock.id}`)}
                >
                  <Group justify="space-between" mb="xs">
                    <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} size="sm" lineClamp={1}>
                        {mock.title}
                      </Text>
                      {mock.retakeOf && (
                        <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                          {t.exam.retake}
                        </Badge>
                      )}
                    </Group>
                    <Badge size="xs" variant="dot" color={examColor} style={{ flexShrink: 0 }}>
                      {mock.mode === 'practice' ? t.exam.practiceMode : t.exam.examMode}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {t.exam.questionsCount.replace('{n}', String(mock.questions.length))}
                    </Text>
                    <Text size="xs" c="dimmed">
                      ·
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(mock.createdAt)}
                    </Text>
                  </Group>
                  <Group gap="xs" mt="sm">
                    <Button
                      variant="light"
                      color={examColor}
                      size="xs"
                      leftSection={<Play size={14} />}
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/exam/${mock.id}`);
                      }}
                    >
                      {t.exam.continueExam}
                    </Button>
                    <Tooltip label={t.exam.deleteExam}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        loading={pendingAction === `delete-${mock.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(mock.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Card>
              ))}
            </Group>
          </Box>
        )}

        {/* Completed section */}
        <Box>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Trophy size={16} color={`var(--mantine-color-${examColor}-6)`} />
              <Text fw={600} size="sm">
                {t.exam.examHistory}
              </Text>
              <Badge size="sm" variant="light" color="gray">
                {filteredCompleted.length}
              </Badge>
            </Group>
            <Group gap="xs">
              <Tooltip label={sortOrder === 'newest' ? t.exam.newestFirst : t.exam.oldestFirst}>
                <ActionIcon
                  variant={sortOrder === 'oldest' ? 'light' : 'subtle'}
                  color="gray"
                  size="md"
                  onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                >
                  <ArrowUpDown size={16} />
                </ActionIcon>
              </Tooltip>
              <TextInput
                placeholder={t.exam.searchExams}
                leftSection={<Search size={16} />}
                size="xs"
                w={200}
                value={searchInput}
                onChange={(e) => setSearchInput(e.currentTarget.value)}
                rightSection={
                  searchInput ? (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => setSearchInput('')}
                    >
                      <X size={12} />
                    </ActionIcon>
                  ) : null
                }
              />
            </Group>
          </Group>

          {filteredCompleted.length === 0 &&
          filteredInProgress.length === 0 &&
          !hasActiveFilters &&
          initialCompleted.length === 0 &&
          initialInProgress.length === 0 ? (
            <Card withBorder radius="md" p="xl" ta="center">
              <Stack align="center" gap="md" py="lg">
                <Target size={48} color="var(--mantine-color-gray-4)" strokeWidth={1.2} />
                <Box>
                  <Text fw={600} size="lg">
                    {t.exam.noExamsYet}
                  </Text>
                  <Text c="dimmed" size="sm" mt={4}>
                    {t.exam.noExamsDescription}
                  </Text>
                </Box>
                <Button
                  variant="light"
                  color={examColor}
                  leftSection={<Plus size={16} />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  {t.exam.newMock}
                </Button>
              </Stack>
            </Card>
          ) : hasActiveFilters &&
            filteredCompleted.length === 0 &&
            filteredInProgress.length === 0 ? (
            <Card withBorder radius="md" p="xl" ta="center">
              <Stack align="center" gap="md" py="lg">
                <Search size={48} color="var(--mantine-color-gray-4)" strokeWidth={1.2} />
                <Box>
                  <Text fw={600} size="lg">
                    {t.exam.noFilterResults}
                  </Text>
                  <Text c="dimmed" size="sm" mt={4}>
                    {t.exam.noFilterResultsDescription}
                  </Text>
                </Box>
                <Button variant="subtle" color="gray" onClick={clearAll}>
                  {t.exam.clearExamFilters}
                </Button>
              </Stack>
            </Card>
          ) : filteredCompleted.length > 0 ? (
            <Card withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t.exam.course}</Table.Th>
                    <Table.Th>{t.exam.examTitle}</Table.Th>
                    <Table.Th>{t.exam.answerMode}</Table.Th>
                    <Table.Th ta="center">{t.exam.questions}</Table.Th>
                    <Table.Th ta="center">{t.exam.score}</Table.Th>
                    <Table.Th>{t.knowledge.date}</Table.Th>
                    <Table.Th ta="center" />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredCompleted.map((mock) => {
                    const correctCount = mock.responses.filter((r) => r.isCorrect).length;
                    return (
                      <Table.Tr
                        key={mock.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/exam/${mock.id}`)}
                      >
                        <Table.Td>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {formatCourse(mock)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" lineClamp={1}>
                              {mock.title}
                            </Text>
                            {mock.retakeOf && (
                              <Tooltip label={t.exam.retake}>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color="gray"
                                  style={{ cursor: 'default' }}
                                >
                                  <RotateCcw size={10} />
                                </Badge>
                              </Tooltip>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light" color={examColor}>
                            {mock.mode === 'practice' ? t.exam.practiceMode : t.exam.examMode}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Text
                            size="sm"
                            fw={500}
                            c={
                              mock.responses.length > 0
                                ? correctCount / mock.responses.length >= 0.6
                                  ? 'green'
                                  : 'red'
                                : 'dimmed'
                            }
                          >
                            {mock.responses.length > 0
                              ? `${correctCount}/${mock.questions.length}`
                              : `—/${mock.questions.length}`}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">
                          <Text
                            size="sm"
                            fw={500}
                            c={
                              mock.score !== null && mock.totalPoints
                                ? mock.score / mock.totalPoints >= 0.6
                                  ? 'green'
                                  : 'red'
                                : 'dimmed'
                            }
                          >
                            {mock.score !== null && mock.totalPoints
                              ? `${Math.round((mock.score / mock.totalPoints) * 100)}%`
                              : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {formatDate(mock.createdAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="center" wrap="nowrap">
                            <Tooltip label={t.exam.retake}>
                              <ActionIcon
                                variant="subtle"
                                color={examColor}
                                size="sm"
                                loading={pendingAction === `retake-${mock.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetake(mock.id);
                                }}
                              >
                                <RotateCcw size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label={t.exam.deleteExam}>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                loading={pendingAction === `delete-${mock.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(mock.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Card>
          ) : null}
        </Box>
      </Stack>

      {/* Create Modal */}
      <ExamCreateModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </Container>
  );
}
