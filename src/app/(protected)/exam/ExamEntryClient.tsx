'use client';

import {
  IconClock,
  IconFileText,
  IconLock,
  IconPlus,
  IconSparkles,
  IconTrophy,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { generateMockExam } from '@/app/actions/mock-exams';
import type { ExamPaper, MockExam } from '@/types/exam';
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

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1} fw={800} mb={4}>
              Exam Practice
            </Title>
            <Text c="dimmed" size="lg">
              Generate mock exams from real past papers
            </Text>
          </div>
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'violet' }}
              onClick={() => setUploadOpen(true)}
            >
              Upload Exam Paper
            </Button>
            <Button variant="subtle" onClick={() => router.push('/exam/history')}>
              View History
            </Button>
          </Group>
        </Group>

        {/* Paper Bank */}
        <div>
          <Title order={4} mb="md">
            Paper Bank
          </Title>
          {papers.length === 0 ? (
            <Card withBorder radius="lg" p="xl" ta="center">
              <IconFileText size={48} style={{ opacity: 0.3 }} />
              <Text c="dimmed" mt="sm">
                No exam papers yet. Upload one to get started.
              </Text>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {papers.map((paper) => (
                <Card key={paper.id} withBorder radius="lg" p="lg">
                  <Group justify="space-between" mb="xs">
                    <Text fw={600} lineClamp={1}>
                      {paper.title}
                    </Text>
                    {paper.visibility === 'private' && (
                      <IconLock size={14} style={{ opacity: 0.5 }} />
                    )}
                  </Group>

                  <Group gap="xs" mb="sm">
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

                  <Group gap="xs" mb="md">
                    <Text size="xs" c="dimmed">
                      {paper.questionCount ?? 0} questions
                    </Text>
                    <Text size="xs" c="dimmed">
                      ·
                    </Text>
                    {paper.questionTypes.slice(0, 3).map((t) => (
                      <Badge key={t} size="xs" variant="dot">
                        {t}
                      </Badge>
                    ))}
                  </Group>

                  <Button
                    fullWidth
                    variant="gradient"
                    gradient={{ from: 'indigo', to: 'violet' }}
                    leftSection={<IconSparkles size={16} />}
                    loading={generatingId === paper.id}
                    disabled={isPending}
                    onClick={() => handleGenerate(paper.id)}
                  >
                    Generate Mock Exam
                  </Button>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </div>

        {/* Recent Mock Exams */}
        {recentMocks.length > 0 && (
          <div>
            <Group justify="space-between" mb="md">
              <Title order={4}>Recent Mock Exams</Title>
              <Button variant="subtle" size="xs" onClick={() => router.push('/exam/history')}>
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
                    style={{ cursor: 'pointer' }}
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
          </div>
        )}

        <ExamPaperUploadModal opened={uploadOpen} onClose={() => setUploadOpen(false)} />
      </Stack>
    </Container>
  );
}
