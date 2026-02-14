'use client';

import {
  IconBolt,
  IconClock,
  IconFileText,
  IconLoader2,
  IconLock,
  IconPlus,
  IconSparkles,
  IconTrophy,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Progress,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { getExamPaperDetail } from '@/app/actions/exam-papers';
import { generateMockExam, generateMockFromTopic } from '@/app/actions/mock-exams';
import type { ExamPaper, ExamQuestion, MockExam } from '@/types/exam';
import { ExamPaperUploadModal } from './ExamPaperUploadModal';

interface Props {
  papers: ExamPaper[];
  recentMocks: MockExam[];
}

export function ExamEntryClient({ papers, recentMocks }: Props) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [quickGenOpen, setQuickGenOpen] = useState(false);
  const [quickGenTopic, setQuickGenTopic] = useState('');
  const [quickGenNum, setQuickGenNum] = useState<string>('10');
  const [quickGenDifficulty, setQuickGenDifficulty] = useState<string>('mixed');
  const [quickGenTypes, setQuickGenTypes] = useState<string[]>([]);
  const [quickGenLoading, setQuickGenLoading] = useState(false);
  const [quickGenError, setQuickGenError] = useState<string | null>(null);

  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [paperDetail, setPaperDetail] = useState<{
    paper: ExamPaper;
    questions: ExamQuestion[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleSelectPaper = useCallback(
    async (paperId: string) => {
      if (paperId === selectedPaperId) return;
      setSelectedPaperId(paperId);
      setLoadingDetail(true);
      setPaperDetail(null);
      try {
        const detail = await getExamPaperDetail(paperId);
        setPaperDetail(detail);
      } finally {
        setLoadingDetail(false);
      }
    },
    [selectedPaperId],
  );

  const handleGenerate = (paperId: string) => {
    setGeneratingId(paperId);
    startTransition(async () => {
      const result = await generateMockExam(paperId);
      setGeneratingId(null);
      if (result.success) {
        router.push(`/exam/mock/${result.mockId}`);
      }
    });
  };

  const handleQuickGenerate = async () => {
    if (!quickGenTopic.trim()) return;
    setQuickGenLoading(true);
    setQuickGenError(null);
    try {
      const result = await generateMockFromTopic(
        quickGenTopic,
        Number(quickGenNum),
        quickGenDifficulty as 'easy' | 'medium' | 'hard' | 'mixed',
        quickGenTypes,
      );
      if (result.success) {
        setQuickGenOpen(false);
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        setQuickGenError(result.error);
      }
    } catch {
      setQuickGenError('An unexpected error occurred');
    } finally {
      setQuickGenLoading(false);
    }
  };

  const questionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      choice: 'Choice',
      fill_blank: 'Fill Blank',
      true_false: 'True/False',
      short_answer: 'Short Answer',
      essay: 'Essay',
      calculation: 'Calculation',
      proof: 'Proof',
    };
    return labels[type] || type;
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start" className="animate-fade-in-up">
        <Box>
          <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
            Exam Practice
          </Title>
          <Text c="dimmed" size="md" fw={400} mt={2}>
            Generate mock exams from real past papers
          </Text>
        </Box>
        <Group>
          <Button
            leftSection={<IconBolt size={16} />}
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            onClick={() => setQuickGenOpen(true)}
            radius="md"
          >
            Quick Generate
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
            onClick={() => setUploadOpen(true)}
            radius="md"
          >
            Upload Exam Paper
          </Button>
          <Button variant="subtle" onClick={() => router.push('/exam/history')} radius="md">
            View History
          </Button>
        </Group>
      </Group>

      {/* Paper Bank — Two-Column Layout */}
      <Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
        <Title order={4} mb="md">
          Paper Bank
        </Title>
        {papers.length === 0 ? (
          <Card
            radius="lg"
            p="xl"
            withBorder
            style={{
              borderColor: 'var(--mantine-color-gray-2)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <Stack align="center" gap="md" py="lg">
              <Box
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'var(--mantine-color-violet-0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconFileText size={32} color="var(--mantine-color-violet-4)" />
              </Box>
              <Box ta="center">
                <Text fw={500} size="md">
                  No exam papers yet
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  Upload a paper or generate from a topic to get started.
                </Text>
              </Box>
              <Group justify="center" mt="xs">
                <Button
                  leftSection={<IconBolt size={16} />}
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan' }}
                  onClick={() => setQuickGenOpen(true)}
                  radius="md"
                >
                  Generate from Topic
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  variant="light"
                  onClick={() => setUploadOpen(true)}
                  radius="md"
                >
                  Upload Paper
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : (
          <Card
            withBorder
            radius="lg"
            p={0}
            style={{
              borderColor: 'var(--mantine-color-gray-2)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
            }}
          >
            <Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 400 }}>
              {/* Left sidebar — Paper list */}
              <Box
                w={280}
                style={{
                  flexShrink: 0,
                  borderRight: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                <ScrollArea h={480}>
                  <Stack gap={0}>
                    {papers.map((paper) => {
                      const isActive = selectedPaperId === paper.id;
                      return (
                        <UnstyledButton
                          key={paper.id}
                          onClick={() => handleSelectPaper(paper.id)}
                          p="sm"
                          style={{
                            borderLeft: isActive
                              ? '3px solid var(--mantine-color-violet-5)'
                              : '3px solid transparent',
                            backgroundColor: isActive ? 'var(--mantine-color-violet-0)' : undefined,
                            transition: 'all 150ms ease',
                          }}
                        >
                          <Group justify="space-between" mb={4} wrap="nowrap">
                            <Text
                              size="sm"
                              fw={isActive ? 600 : 500}
                              lineClamp={1}
                              style={{ flex: 1 }}
                            >
                              {paper.title}
                            </Text>
                            {paper.visibility === 'private' && (
                              <IconLock size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                            )}
                          </Group>
                          <Group gap={4} mb={4}>
                            {paper.school && (
                              <Badge size="xs" variant="light">
                                {paper.school}
                              </Badge>
                            )}
                            {paper.course && (
                              <Badge size="xs" variant="light" color="violet">
                                {paper.course}
                              </Badge>
                            )}
                            {paper.year && (
                              <Badge size="xs" variant="light" color="gray">
                                {paper.year}
                              </Badge>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {paper.questionCount ?? 0} questions
                          </Text>
                        </UnstyledButton>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              </Box>

              {/* Right panel — Paper detail */}
              <Box style={{ flex: 1, minWidth: 0 }} p="lg">
                {!selectedPaperId ? (
                  <Stack align="center" justify="center" h={400} gap="sm">
                    <IconFileText size={48} style={{ opacity: 0.2 }} />
                    <Text c="dimmed">Select a paper to view details</Text>
                  </Stack>
                ) : loadingDetail ? (
                  <Stack align="center" justify="center" h={400}>
                    <Loader size="md" />
                    <Text size="sm" c="dimmed">
                      Loading paper details...
                    </Text>
                  </Stack>
                ) : paperDetail ? (
                  <Stack gap="lg">
                    <div>
                      <Title order={3} mb="xs">
                        {paperDetail.paper.title}
                      </Title>
                      <Group gap="xs">
                        {paperDetail.paper.school && (
                          <Badge variant="light">{paperDetail.paper.school}</Badge>
                        )}
                        {paperDetail.paper.course && (
                          <Badge variant="light" color="violet">
                            {paperDetail.paper.course}
                          </Badge>
                        )}
                        {paperDetail.paper.year && (
                          <Badge variant="light" color="gray">
                            {paperDetail.paper.year}
                          </Badge>
                        )}
                        <Badge variant="light" color="indigo">
                          {paperDetail.questions.length} questions
                        </Badge>
                      </Group>
                    </div>

                    {/* Questions preview */}
                    <Stack gap="xs">
                      <Text size="sm" fw={600} c="dimmed">
                        Questions Preview
                      </Text>
                      {paperDetail.questions.slice(0, 5).map((q, i) => (
                        <Group key={q.id} gap="sm" wrap="nowrap" align="flex-start">
                          <Badge size="sm" variant="light" color="indigo" style={{ flexShrink: 0 }}>
                            Q{i + 1}
                          </Badge>
                          <Badge size="xs" variant="dot" style={{ flexShrink: 0 }}>
                            {questionTypeLabel(q.type)}
                          </Badge>
                          <Text size="sm" lineClamp={1} c="dimmed" style={{ flex: 1 }}>
                            {q.content.replace(/[#*_`$\\]/g, '').slice(0, 80)}
                          </Text>
                        </Group>
                      ))}
                      {paperDetail.questions.length > 5 && (
                        <Text size="xs" c="dimmed" fs="italic">
                          ... and {paperDetail.questions.length - 5} more questions
                        </Text>
                      )}
                    </Stack>

                    <Button
                      variant="gradient"
                      gradient={{ from: 'indigo', to: 'violet' }}
                      leftSection={
                        generatingId === selectedPaperId ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconSparkles size={16} />
                        )
                      }
                      loading={generatingId === selectedPaperId}
                      disabled={isPending}
                      onClick={() => handleGenerate(selectedPaperId)}
                      size="md"
                      radius="md"
                    >
                      Generate Mock Exam
                    </Button>
                  </Stack>
                ) : (
                  <Stack align="center" justify="center" h={400}>
                    <Text c="dimmed">Failed to load paper details</Text>
                  </Stack>
                )}
              </Box>
            </Group>
          </Card>
        )}
      </Box>

      {/* Recent Mock Exams */}
      {recentMocks.length > 0 && (
        <Box className="animate-fade-in-up animate-delay-200" style={{ opacity: 0 }}>
          <Group justify="space-between" mb="md">
            <Title order={4}>Recent Mock Exams</Title>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => router.push('/exam/history')}
              radius="md"
            >
              View All
            </Button>
          </Group>
          <ScrollArea>
            <Group gap="md" wrap="nowrap">
              {recentMocks.map((mock) => (
                <Card
                  key={mock.id}
                  withBorder
                  radius="lg"
                  p="md"
                  miw={250}
                  style={{
                    cursor: 'pointer',
                    borderColor: 'var(--mantine-color-gray-2)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                  onClick={() => router.push(`/exam/mock/${mock.id}`)}
                >
                  <Text fw={500} size="sm" lineClamp={1}>
                    {mock.title}
                  </Text>
                  <Group gap="xs" mt="xs">
                    {mock.status === 'completed' ? (
                      <>
                        <IconTrophy size={14} color="gold" />
                        <Text size="sm" fw={600}>
                          {mock.score}/{mock.totalPoints}
                        </Text>
                      </>
                    ) : (
                      <>
                        <IconClock size={14} style={{ opacity: 0.5 }} />
                        <Text size="xs" c="dimmed">
                          {mock.currentIndex}/{mock.questions.length} answered
                        </Text>
                      </>
                    )}
                  </Group>
                  {mock.status === 'completed' && (
                    <Progress
                      value={(mock.score! / mock.totalPoints) * 100}
                      mt="xs"
                      size="xs"
                      color={mock.score! / mock.totalPoints >= 0.6 ? 'green' : 'red'}
                    />
                  )}
                </Card>
              ))}
            </Group>
          </ScrollArea>
        </Box>
      )}

      <ExamPaperUploadModal opened={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* Quick Generate Modal */}
      <Modal
        opened={quickGenOpen}
        onClose={() => {
          setQuickGenOpen(false);
          setQuickGenError(null);
        }}
        title="Quick Generate Mock Exam"
        size="md"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Topic / Course"
            placeholder="e.g. Linear Algebra, Organic Chemistry"
            required
            value={quickGenTopic}
            onChange={(e) => setQuickGenTopic(e.currentTarget.value)}
          />
          <Select
            label="Number of Questions"
            data={[
              { value: '5', label: '5 questions' },
              { value: '10', label: '10 questions' },
              { value: '15', label: '15 questions' },
              { value: '20', label: '20 questions' },
            ]}
            value={quickGenNum}
            onChange={(v) => setQuickGenNum(v ?? '10')}
          />
          <Select
            label="Difficulty"
            data={[
              { value: 'mixed', label: 'Mixed' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
            value={quickGenDifficulty}
            onChange={(v) => setQuickGenDifficulty(v ?? 'mixed')}
          />
          <MultiSelect
            label="Question Types (optional)"
            placeholder="Leave empty for auto"
            data={[
              { value: 'choice', label: 'Multiple Choice' },
              { value: 'true_false', label: 'True / False' },
              { value: 'fill_blank', label: 'Fill in the Blank' },
              { value: 'short_answer', label: 'Short Answer' },
              { value: 'calculation', label: 'Calculation' },
              { value: 'essay', label: 'Essay' },
            ]}
            value={quickGenTypes}
            onChange={setQuickGenTypes}
          />
          {quickGenError && (
            <Text size="sm" c="red">
              {quickGenError}
            </Text>
          )}
          <Button
            variant="gradient"
            gradient={{ from: 'teal', to: 'cyan' }}
            leftSection={
              quickGenLoading ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconBolt size={16} />
              )
            }
            loading={quickGenLoading}
            disabled={!quickGenTopic.trim()}
            onClick={handleQuickGenerate}
            fullWidth
          >
            Generate Exam
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
