import { IconClock, IconFileText, IconTrophy } from '@tabler/icons-react';
import Link from 'next/link';
import {
  Anchor,
  Badge,
  Box,
  Button,
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
    <Container size="md" py={48} style={{ position: 'relative' }}>
      <Box
        style={{
          position: 'absolute',
          top: -40,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 200,
          background:
            'radial-gradient(ellipse at center, var(--mantine-color-indigo-0) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.7,
        }}
      />
      <Box style={{ position: 'relative', zIndex: 1 }}>
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start" className="animate-fade-in-up">
            <Box>
              <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
                Mock Exam History
              </Title>
              <Text c="dimmed" size="md" fw={400} mt={2}>
                Review your past exam attempts
              </Text>
            </Box>
            <Button component={Link} href="/exam" variant="subtle" radius="md">
              Back to Exam Practice
            </Button>
          </Group>

          {/* Content */}
          <Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
            {mocks.length === 0 ? (
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
                      No mock exams yet
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      Generate one from the exam practice page to get started.
                    </Text>
                  </Box>
                  <Button
                    component={Link}
                    href="/exam"
                    variant="light"
                    color="indigo"
                    size="sm"
                    radius="md"
                  >
                    Go to Exam Practice
                  </Button>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {mocks.map((mock) => (
                  <Anchor
                    key={mock.id}
                    href={`/exam/mock/${mock.id}`}
                    underline="never"
                    c="inherit"
                  >
                    <Card
                      withBorder
                      radius="lg"
                      p="lg"
                      style={{
                        borderColor: 'var(--mantine-color-gray-2)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
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
                  </Anchor>
                ))}
              </SimpleGrid>
            )}
          </Box>
        </Stack>
      </Box>
    </Container>
  );
}
