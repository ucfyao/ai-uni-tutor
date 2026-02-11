import { IconClock, IconTrophy } from '@tabler/icons-react';
import Link from 'next/link';
import {
  Badge,
  Card,
  Container,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { getMockExamList } from '@/app/actions/mock-exams';

export default async function ExamHistoryPage() {
  const mocks = await getMockExamList();

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        <Title order={1} fw={800}>
          Mock Exam History
        </Title>

        {mocks.length === 0 ? (
          <Text c="dimmed">No mock exams yet. Generate one from the exam practice page.</Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {mocks.map((mock) => (
              <Card
                key={mock.id}
                component={Link}
                href={`/exam/mock/${mock.id}`}
                withBorder
                radius="lg"
                p="lg"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <Text fw={600} lineClamp={1}>
                  {mock.title}
                </Text>

                <Group gap="xs" mt="sm">
                  {mock.status === 'completed' ? (
                    <>
                      <IconTrophy size={16} color="gold" />
                      <Text fw={600}>
                        {mock.score}/{mock.totalPoints}
                      </Text>
                      <Badge color="green" size="xs">
                        Completed
                      </Badge>
                    </>
                  ) : (
                    <>
                      <IconClock size={16} style={{ opacity: 0.5 }} />
                      <Text size="sm" c="dimmed">
                        {mock.currentIndex}/{mock.questions.length} answered
                      </Text>
                      <Badge color="yellow" size="xs">
                        In Progress
                      </Badge>
                    </>
                  )}
                </Group>

                {mock.status === 'completed' && (
                  <Progress
                    value={(mock.score! / mock.totalPoints) * 100}
                    mt="sm"
                    size="sm"
                    color={mock.score! / mock.totalPoints >= 0.6 ? 'green' : 'red'}
                  />
                )}

                <Text size="xs" c="dimmed" mt="sm">
                  {new Date(mock.createdAt).toLocaleDateString()}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
