'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  XCircle,
} from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Card,
  Code,
  Group,
  Pagination,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { AdminContent } from '@/components/admin/AdminContent';

interface LlmLogRow {
  id: string;
  user_id: string | null;
  call_type: string;
  provider: string;
  model: string;
  status: string;
  error_message: string | null;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface LlmLogStats {
  totalToday: number;
  errorsToday: number;
  avgLatencyMs: number;
  estimatedCostToday: number;
}

interface LlmLogsResponse {
  logs: LlmLogRow[];
  total: number;
  stats: LlmLogStats;
  page: number;
  pageSize: number;
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getLatencyColor(ms: number) {
  if (ms < 1000) return 'teal';
  if (ms < 3000) return 'yellow';
  return 'red';
}

function formatTokens(n: number | null) {
  if (n == null) return '-';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="sm">
        {icon}
        <div>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text size="lg" fw={700} c={color}>
            {value}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}

export function LlmLogsClient() {
  const [page, setPage] = useState(1);
  const [callType, setCallType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 50;

  const { data, isLoading } = useQuery<LlmLogsResponse>({
    queryKey: ['admin-llm-logs', callType, status, model, timeRange, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (callType) params.set('callType', callType);
      if (status) params.set('status', status);
      if (model) params.set('model', model);
      params.set('timeRange', timeRange);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`/api/admin/llm-logs?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 0,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        <Group gap="xs">
          <FileText size={20} color="var(--mantine-color-cyan-5)" />
          <Text fw={650} size="lg">
            LLM Call Logs
          </Text>
        </Group>
      </Box>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <AdminContent>
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
            <StatCard
              icon={<Activity size={20} color="var(--mantine-color-blue-5)" />}
              label="Total Calls"
              value={String(data?.stats.totalToday ?? '-')}
              color="blue"
            />
            <StatCard
              icon={<AlertTriangle size={20} color="var(--mantine-color-red-5)" />}
              label="Errors"
              value={String(data?.stats.errorsToday ?? '-')}
              color={data?.stats.errorsToday ? 'red' : 'green'}
            />
            <StatCard
              icon={<Clock size={20} color="var(--mantine-color-yellow-5)" />}
              label="Avg Latency"
              value={data ? formatLatency(data.stats.avgLatencyMs) : '-'}
              color={getLatencyColor(data?.stats.avgLatencyMs ?? 0)}
            />
            <StatCard
              icon={<DollarSign size={20} color="var(--mantine-color-green-5)" />}
              label="Est. Cost"
              value={data ? `$${data.stats.estimatedCostToday.toFixed(4)}` : '-'}
              color="green"
            />
          </SimpleGrid>

          <Group gap="sm">
            <Select
              size="xs"
              placeholder="Call Type"
              clearable
              value={callType}
              onChange={(v) => {
                setCallType(v);
                setPage(1);
              }}
              data={[
                { value: 'chat', label: 'Chat' },
                { value: 'parse', label: 'Parse' },
                { value: 'exam', label: 'Exam' },
                { value: 'embedding', label: 'Embedding' },
                { value: 'explain', label: 'Explain' },
                { value: 'rerank', label: 'Rerank' },
              ]}
            />
            <Select
              size="xs"
              placeholder="Status"
              clearable
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              data={[
                { value: 'success', label: 'Success' },
                { value: 'error', label: 'Error' },
              ]}
            />
            <Select
              size="xs"
              placeholder="Model"
              clearable
              value={model}
              onChange={(v) => {
                setModel(v);
                setPage(1);
              }}
              data={[
                { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
                { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
                { value: 'gemini-embedding-001', label: 'gemini-embedding-001' },
              ]}
            />
            <Select
              size="xs"
              value={timeRange}
              onChange={(v) => {
                setTimeRange(v ?? '24h');
                setPage(1);
              }}
              data={[
                { value: '1h', label: 'Last 1 hour' },
                { value: '24h', label: 'Last 24 hours' },
                { value: '7d', label: 'Last 7 days' },
                { value: '30d', label: 'Last 30 days' },
              ]}
            />
          </Group>

          <Card withBorder padding={0}>
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Model</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Latency</Table.Th>
                    <Table.Th>Tokens (in/out)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {isLoading ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text ta="center" py="md" c="dimmed">
                          Loading...
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : !data?.logs.length ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text ta="center" py="md" c="dimmed">
                          No logs found.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.logs.map((log) => (
                      <Fragment key={log.id}>
                        <Table.Tr
                          bg={
                            log.status === 'error' ? 'var(--mantine-color-red-light)' : undefined
                          }
                          onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Table.Td>
                            <Text size="xs" ff="monospace">
                              {formatTime(log.created_at)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light">
                              {log.call_type}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light" color="gray">
                              {log.provider}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" truncate maw={140}>
                              {log.model}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {log.status === 'success' ? (
                              <CheckCircle size={14} color="var(--mantine-color-green-6)" />
                            ) : (
                              <XCircle size={14} color="var(--mantine-color-red-6)" />
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={getLatencyColor(log.latency_ms)}
                              variant="light"
                            >
                              {formatLatency(log.latency_ms)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" ff="monospace">
                              {formatTokens(log.input_tokens)} / {formatTokens(log.output_tokens)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                        {expandedRow === log.id && (
                          <Table.Tr>
                            <Table.Td colSpan={7} bg="var(--mantine-color-dark-light)">
                              <Stack gap="xs" p="xs">
                                {log.error_message && (
                                  <Text size="xs" c="red" fw={500}>
                                    Error: {log.error_message}
                                  </Text>
                                )}
                                {log.cost_estimate != null && (
                                  <Text size="xs" c="dimmed">
                                    Estimated cost: ${Number(log.cost_estimate).toFixed(6)}
                                  </Text>
                                )}
                                {log.user_id && (
                                  <Text size="xs" c="dimmed">
                                    User: {log.user_id}
                                  </Text>
                                )}
                                <Code block>{JSON.stringify(log.metadata, null, 2)}</Code>
                              </Stack>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
              <Text size="xs" c="dimmed">
                {data?.total ?? 0} total records
              </Text>
            </Group>
          )}
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
