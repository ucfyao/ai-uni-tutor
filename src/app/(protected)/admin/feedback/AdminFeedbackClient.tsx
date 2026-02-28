'use client';

import { useQuery } from '@tanstack/react-query';
import { MessageSquare, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import {
  Badge,
  Box,
  Card,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { AdminContent } from '@/components/admin/AdminContent';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface FeedbackItem {
  id: string;
  feedbackType: 'up' | 'down';
  createdAt: string;
  userEmail: string;
  messagePreview: string;
  messageRole: string;
}

interface FeedbackStats {
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  satisfactionRate: number;
}

interface FeedbackResponse {
  items: FeedbackItem[];
  stats: FeedbackStats;
}

export function AdminFeedbackClient() {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();

  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <MessageSquare size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          Chat Feedback
        </Text>
      </Group>
    ),
    [isMobile],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  const { data, isLoading } = useQuery<FeedbackResponse>({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const res = await fetch('/api/admin/feedback');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const thStyle: React.CSSProperties = {
    color: 'var(--mantine-color-gray-5)',
    fontWeight: 500,
    fontSize: 'var(--mantine-font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Desktop Header */}
      {!isMobile && (
        <Box
          px="md"
          h={52}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <AdminContent>
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <Stack gap="lg">
              {/* Stats Cards */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <StatCard
                  label="Total Feedback"
                  value={data?.stats.total ?? 0}
                  icon={<MessageSquare size={20} />}
                  color="indigo"
                />
                <StatCard
                  label="Thumbs Up"
                  value={data?.stats.thumbsUp ?? 0}
                  icon={<ThumbsUp size={20} />}
                  color="teal"
                />
                <StatCard
                  label="Thumbs Down"
                  value={data?.stats.thumbsDown ?? 0}
                  icon={<ThumbsDown size={20} />}
                  color="red"
                />
                <StatCard
                  label="Satisfaction"
                  value={`${data?.stats.satisfactionRate ?? 0}%`}
                  icon={<TrendingUp size={20} />}
                  color="green"
                />
              </SimpleGrid>

              {/* Feedback Table */}
              {(data?.items.length ?? 0) === 0 ? (
                <Text c="dimmed" ta="center" py="xl" size="sm">
                  No feedback collected yet.
                </Text>
              ) : (
                <Card
                  withBorder
                  radius="lg"
                  p={0}
                  style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
                >
                  <Table
                    verticalSpacing="sm"
                    highlightOnHover
                    highlightOnHoverColor="var(--mantine-color-gray-0)"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={thStyle}>Type</Table.Th>
                        <Table.Th style={thStyle}>Message Preview</Table.Th>
                        {!isMobile && <Table.Th style={thStyle}>User</Table.Th>}
                        <Table.Th style={thStyle}>Time</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data?.items.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Badge
                              color={item.feedbackType === 'up' ? 'teal' : 'red'}
                              variant="light"
                              leftSection={
                                item.feedbackType === 'up' ? (
                                  <ThumbsUp size={12} />
                                ) : (
                                  <ThumbsDown size={12} />
                                )
                              }
                              size="sm"
                            >
                              {item.feedbackType === 'up' ? 'Helpful' : 'Not helpful'}
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ maxWidth: 400 }}>
                            <Text size="sm" lineClamp={2}>
                              {item.messagePreview}
                            </Text>
                          </Table.Td>
                          {!isMobile && (
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {item.userEmail}
                              </Text>
                            </Table.Td>
                          )}
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Stack>
          )}
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}

// --- Stat Card ---

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card withBorder radius="lg" p="md" style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500} mb={4}>
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </Box>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}
