'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { AdminContent } from '@/components/admin/AdminContent';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import type { LlmLogsPreview } from '../types';

// ---------------------------------------------------------------------------
// Types matching AdminDashboardService response
// ---------------------------------------------------------------------------

interface StripeData {
  available: number;
  pending: number;
  currency: string;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

interface UpstashData {
  monthlyRequests: number;
  monthlyRequestsLimit: number;
  dailyCommands: number;
  monthlyBandwidth: number;
  monthlyBandwidthLimit: number;
  currentStorage: number;
  storageLimit: number;
  monthlyBilling: number;
  maxCommandsPerSecond: number;
  plan: string;
}

interface PoolEntryStatus {
  id: number;
  provider: 'gemini' | 'minimax';
  model: string;
  maskedKey: string;
  disabled: boolean;
  cooldownUntil: number;
  failCount: number;
  pool: 'default' | 'chat';
}

interface PoolStatusData {
  entries: PoolEntryStatus[];
  serverTime: number;
}

interface GeminiQuotaEntry {
  displayName: string;
  modelId: string;
  rpm: number;
  tpm: number;
  rpd: number;
  todayUsage: number;
  monthlyUsage: number;
  inUse: boolean;
}

interface GeminiQuotaData {
  models: GeminiQuotaEntry[];
  totalToday: number;
  totalMonthly: number;
  activeUsersToday: number;
  dashboardUrl: string;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function isError(data: unknown): data is { error: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'string'
  );
}

function formatCents(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

async function fetchService<T>(service: string): Promise<T> {
  const res = await fetch(`/api/admin/dashboard?service=${service}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${service} data (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Stat row component
// ---------------------------------------------------------------------------

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Card loading / error states
// ---------------------------------------------------------------------------

function CardLoading() {
  return (
    <Stack align="center" py="md">
      <Loader size="sm" />
    </Stack>
  );
}

function CardError({ message }: { message: string }) {
  return (
    <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
      {message}
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Individual card content
// ---------------------------------------------------------------------------

function StripeContent({ data }: { data: StripeData }) {
  return (
    <Stack gap="sm">
      <StatRow label="Available Balance" value={formatCents(data.available, data.currency)} />
      <StatRow label="Pending Balance" value={formatCents(data.pending, data.currency)} />
      <StatRow label="Active Subscriptions" value={formatNumber(data.activeSubscriptions)} />
      <StatRow label="Monthly Revenue" value={formatCents(data.monthlyRevenue, data.currency)} />
    </Stack>
  );
}

function UsageRow({
  label,
  used,
  limit,
  format = 'number',
}: {
  label: string;
  used: number;
  limit: number;
  format?: 'number' | 'bytes';
}) {
  const fmt = format === 'bytes' ? formatBytes : formatNumber;
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'teal';

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={600}>
          {fmt(used)} / {fmt(limit)}
        </Text>
      </Group>
      <Progress value={pct} color={color} size="sm" />
    </Stack>
  );
}

function UpstashContent({ data }: { data: UpstashData }) {
  return (
    <Stack gap="sm">
      <Badge color="gray" variant="light" size="xs">
        Plan: {data.plan}
      </Badge>
      <UsageRow
        label="Monthly Requests"
        used={data.monthlyRequests}
        limit={data.monthlyRequestsLimit}
      />
      <UsageRow
        label="Storage"
        used={data.currentStorage}
        limit={data.storageLimit}
        format="bytes"
      />
      <UsageRow
        label="Bandwidth"
        used={data.monthlyBandwidth}
        limit={data.monthlyBandwidthLimit}
        format="bytes"
      />
      <StatRow label="Today Commands" value={formatNumber(data.dailyCommands)} />
      <StatRow label="Max Commands/sec" value={formatNumber(data.maxCommandsPerSecond)} />
      <StatRow label="Monthly Cost" value={`$${data.monthlyBilling.toFixed(2)}`} />
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Unified Gemini card (Quota + Usage + Key Pool)
// ---------------------------------------------------------------------------

function useService<T>(service: string) {
  return useQuery<T>({
    queryKey: ['admin-dashboard', service],
    queryFn: () => fetchService<T>(service),
    staleTime: 0,
  });
}

function GeminiQuotaCard() {
  const quota = useService<GeminiQuotaData | { error: string }>('gemini-quota');
  const quotaData =
    !quota.isLoading && !quota.isError && quota.data && !isError(quota.data) ? quota.data : null;

  return (
    <Card withBorder shadow="sm" padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Gauge size={18} color="var(--mantine-color-cyan-5)" />
          <Text fw={600}>Gemini Quota</Text>
          {quotaData && (
            <Group gap="xs" ml="xs">
              <Badge color="blue" variant="light" size="sm">
                Today: {formatNumber(quotaData.totalToday)}
              </Badge>
              <Badge color="gray" variant="light" size="sm">
                Monthly: {formatNumber(quotaData.totalMonthly)}
              </Badge>
              <Badge color="teal" variant="light" size="sm">
                Users: {formatNumber(quotaData.activeUsersToday)}
              </Badge>
            </Group>
          )}
        </Group>
        {quotaData && (
          <Anchor href={quotaData.dashboardUrl} target="_blank" size="xs">
            <Group gap={4}>
              Google AI Studio
              <ExternalLink size={12} />
            </Group>
          </Anchor>
        )}
      </Group>

      {quota.isLoading ? (
        <CardLoading />
      ) : quota.isError ? (
        <CardError
          message={quota.error instanceof Error ? quota.error.message : 'Failed to load'}
        />
      ) : quotaData ? (
        <Stack gap="xs">
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Model</Table.Th>
                  <Table.Th ta="right">RPM</Table.Th>
                  <Table.Th ta="right">RPD (used/limit)</Table.Th>
                  <Table.Th ta="right">Monthly</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {quotaData.models.map((m) => {
                  const pct = m.rpd > 0 ? (m.todayUsage / m.rpd) * 100 : 0;
                  const color = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'teal';
                  return (
                    <Table.Tr key={m.modelId}>
                      <Table.Td>
                        <Group gap={4}>
                          <Text size="xs" truncate maw={140}>
                            {m.displayName}
                          </Text>
                          {m.inUse && (
                            <Badge size="xs" variant="light" color="blue">
                              active
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{m.rpm}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" fw={600} c={color}>
                          {formatNumber(m.todayUsage)} / {formatNumber(m.rpd)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" c="dimmed">
                          {formatNumber(m.monthlyUsage)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Progress value={Math.min(pct, 100)} color={color} size="sm" w={50} />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Text size="xs" c="dimmed">
            Quota config updated: {quotaData.lastUpdated}
          </Text>
        </Stack>
      ) : null}
    </Card>
  );
}

function KeyPoolCard() {
  const queryClient = useQueryClient();
  const pool = useService<PoolStatusData | { error: string }>('gemini-pool');

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    setResetError(false);
    try {
      const res = await fetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-pool' }),
      });
      if (!res.ok) throw new Error('Reset failed');
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard', 'gemini-pool'] });
    } catch {
      setResetError(true);
    } finally {
      setResetting(false);
    }
  };

  const getStatusBadge = (entry: PoolEntryStatus, serverTime: number) => {
    if (entry.disabled) {
      return (
        <Badge color="red" variant="light" size="xs">
          Disabled
        </Badge>
      );
    }
    if (entry.cooldownUntil > 0) {
      const remaining = Math.max(0, entry.cooldownUntil - serverTime);
      const label =
        remaining > 3600000
          ? `${Math.floor(remaining / 3600000)}h ${Math.floor((remaining % 3600000) / 60000)}m`
          : remaining > 60000
            ? `${Math.floor(remaining / 60000)}m ${Math.floor((remaining % 60000) / 1000)}s`
            : `${Math.floor(remaining / 1000)}s`;
      return (
        <Badge color="yellow" variant="light" size="xs">
          Cooldown {label}
        </Badge>
      );
    }
    return (
      <Badge color="green" variant="light" size="xs">
        Online
      </Badge>
    );
  };

  const poolData =
    !pool.isLoading && !pool.isError && pool.data && !isError(pool.data) ? pool.data : null;
  const hasCooldowns = poolData?.entries.some((e) => e.cooldownUntil > 0) ?? false;

  return (
    <Card withBorder shadow="sm" padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <KeyRound size={18} color="var(--mantine-color-orange-5)" />
          <Text fw={600}>Key Pool</Text>
          <Badge color="orange" variant="light" size="sm">
            {poolData ? `${poolData.entries.length} entries` : 'Status'}
          </Badge>
        </Group>
        {hasCooldowns && (
          <Button
            size="compact-xs"
            variant="light"
            color="orange"
            onClick={handleReset}
            loading={resetting}
            leftSection={<RefreshCw size={12} />}
          >
            Reset All
          </Button>
        )}
      </Group>

      {pool.isLoading ? (
        <CardLoading />
      ) : pool.isError ? (
        <CardError message={pool.error instanceof Error ? pool.error.message : 'Failed to load'} />
      ) : poolData ? (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={30}>#</Table.Th>
                <Table.Th>Key</Table.Th>
                <Table.Th>Model</Table.Th>
                <Table.Th>Pool</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {poolData.entries.map((entry, idx) => {
                const needsReset = entry.cooldownUntil > 0 || entry.disabled;
                return (
                  <Table.Tr key={`${entry.pool}-${entry.id}`}>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {idx + 1}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace" c="dimmed" truncate maw={90}>
                        {entry.maskedKey}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" truncate maw={140}>
                        {entry.model}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={entry.pool === 'chat' ? 'indigo' : 'gray'}
                        variant="light"
                        size="xs"
                      >
                        {entry.pool}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(entry, poolData.serverTime)}</Table.Td>
                    <Table.Td>
                      {needsReset && (
                        <Tooltip label="Reset this entry">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="orange"
                            onClick={async () => {
                              const res = await fetch('/api/admin/dashboard', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'reset-pool-entry',
                                  pool: entry.pool,
                                  entryId: entry.id,
                                }),
                              });
                              if (res.ok) {
                                queryClient.invalidateQueries({
                                  queryKey: ['admin-dashboard', 'gemini-pool'],
                                });
                              }
                            }}
                          >
                            <RefreshCw size={12} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : null}

      {resetError && (
        <Text size="xs" c="red" mt={4}>
          Reset failed — please try again.
        </Text>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-service card wrapper with independent query
// ---------------------------------------------------------------------------

function ServiceCard<T>({
  queryKey,
  service,
  icon,
  title,
  badgeLabel,
  badgeColor,
  children,
}: {
  queryKey: string;
  service: string;
  icon: ReactNode;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  children: (data: T) => ReactNode;
}) {
  const {
    data,
    isLoading,
    isError: hasError,
    error,
  } = useQuery<T>({
    queryKey: ['admin-dashboard', queryKey],
    queryFn: () => fetchService<T>(service),
    staleTime: 0,
  });

  return (
    <Card withBorder shadow="sm" padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          {icon}
          <Text fw={600}>{title}</Text>
        </Group>
        <Badge color={badgeColor} variant="light" size="sm">
          {badgeLabel}
        </Badge>
      </Group>
      {isLoading ? (
        <CardLoading />
      ) : hasError ? (
        <CardError message={error instanceof Error ? error.message : 'Failed to load'} />
      ) : data && isError(data) ? (
        <CardError message={(data as { error: string }).error} />
      ) : data ? (
        children(data)
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LLM Logs Preview
// ---------------------------------------------------------------------------

function formatLatencyBadge(ms: number) {
  const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  const color = ms < 1000 ? 'teal' : ms < 3000 ? 'yellow' : 'red';
  return { label, color };
}

export const TYPE_COLORS: Record<string, string> = {
  chat: 'blue',
  exam: 'violet',
  parse: 'orange',
  'parse-lecture': 'orange',
  'parse-exam': 'orange',
  'parse-assignment': 'orange',
  grading: 'green',
  embedding: 'cyan',
  explain: 'teal',
  rerank: 'indigo',
  writing: 'pink',
  unknown: 'gray',
};

function formatTokens(n: number | null | undefined): string {
  if (!n) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function LlmLogsPreviewSection() {
  const {
    data,
    isLoading,
    isError: hasError,
    error,
  } = useQuery<LlmLogsPreview>({
    queryKey: ['admin-dashboard', 'llm-logs-preview'],
    queryFn: () => fetchService<LlmLogsPreview>('llm-logs-preview'),
    staleTime: 0,
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return `${date} ${time}`;
  };

  const total = data?.stats.totalToday ?? 0;
  const errors = data?.stats.errorsToday ?? 0;
  const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 0;

  return (
    <Card withBorder shadow="sm" padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <FileText size={18} color="var(--mantine-color-cyan-5)" />
          <Text fw={600}>LLM Call Logs</Text>
        </Group>
        <Anchor component={Link} href="/admin/llm-logs" size="sm">
          View All &rarr;
        </Anchor>
      </Group>

      {isLoading ? (
        <CardLoading />
      ) : hasError ? (
        <CardError message={error instanceof Error ? error.message : 'Failed to load'} />
      ) : data && isError(data) ? (
        <CardError message={(data as unknown as { error: string }).error} />
      ) : data ? (
        <Stack gap="md">
          {/* Stats row 1: key metrics */}
          <Group gap="lg" wrap="wrap">
            <Badge color="blue" variant="light" size="lg">
              Today: {formatNumber(data.stats.totalToday)}
            </Badge>
            <Badge color={data.stats.errorsToday > 0 ? 'red' : 'green'} variant="light" size="lg">
              Errors: {data.stats.errorsToday}
            </Badge>
            <Badge
              color={successRate >= 95 ? 'green' : successRate >= 80 ? 'yellow' : 'red'}
              variant="light"
              size="lg"
            >
              Success: {successRate}%
            </Badge>
            <Badge
              color={formatLatencyBadge(data.stats.avgLatencyMs).color}
              variant="light"
              size="lg"
            >
              Avg: {formatLatencyBadge(data.stats.avgLatencyMs).label}
            </Badge>
            {data.stats.estimatedCostToday > 0 && (
              <Badge color="grape" variant="light" size="lg">
                Cost: ${data.stats.estimatedCostToday.toFixed(4)}
              </Badge>
            )}
          </Group>

          {/* Stats row 2: per-type breakdown */}
          {data.typeBreakdown && Object.keys(data.typeBreakdown).length > 0 && (
            <Group gap={6} wrap="wrap">
              {Object.entries(data.typeBreakdown)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([type, info]) => (
                  <Tooltip
                    key={type}
                    label={`${info.errors} errors · ${formatTokens(info.totalTokens)} tokens`}
                  >
                    <Badge size="sm" variant="dot" color={TYPE_COLORS[type] ?? 'gray'}>
                      {type}: {info.count}
                    </Badge>
                  </Tooltip>
                ))}
            </Group>
          )}

          {data.logs.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No LLM calls recorded yet.
            </Text>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Model</Table.Th>
                    <Table.Th>Key</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Latency</Table.Th>
                    <Table.Th>Tokens</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.logs.map((log) => {
                    const apiKey = (log.metadata as Record<string, unknown>)?.apiKey as
                      | string
                      | undefined;
                    const hasTokens = log.input_tokens || log.output_tokens;

                    return (
                      <Table.Tr
                        key={log.id}
                        bg={log.status === 'error' ? 'var(--mantine-color-red-light)' : undefined}
                      >
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {formatTime(log.created_at)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            variant="light"
                            color={TYPE_COLORS[log.call_type] ?? 'gray'}
                          >
                            {log.call_type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" truncate maw={120}>
                            {log.model}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {apiKey ? (
                            <Text size="xs" ff="monospace" c="dimmed">
                              {apiKey}
                            </Text>
                          ) : (
                            <Text size="xs" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {log.status === 'success' ? (
                            <CheckCircle size={14} color="var(--mantine-color-green-6)" />
                          ) : (
                            <Tooltip
                              label={log.error_message || 'Unknown error'}
                              maw={300}
                              multiline
                            >
                              <XCircle size={14} color="var(--mantine-color-red-6)" />
                            </Tooltip>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            color={formatLatencyBadge(log.latency_ms).color}
                            variant="light"
                          >
                            {formatLatencyBadge(log.latency_ms).label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {hasTokens ? (
                            <Tooltip
                              label={`In: ${log.input_tokens ?? 0} · Out: ${log.output_tokens ?? 0}`}
                            >
                              <Text size="xs" c="dimmed">
                                {formatTokens((log.input_tokens ?? 0) + (log.output_tokens ?? 0))}
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text size="xs" c="dimmed">
                              -
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard client
// ---------------------------------------------------------------------------

export function DashboardClient() {
  const queryClient = useQueryClient();
  const isFetching = queryClient.isFetching({ queryKey: ['admin-dashboard'] }) > 0;
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <LayoutDashboard size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          API Dashboard
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
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          {headerNode}
          <Tooltip label="Refresh">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={handleRefresh}
              loading={isFetching}
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={16} />
            </ActionIcon>
          </Tooltip>
        </Box>
      )}

      {/* Scrollable Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <AdminContent>
          {/* Mobile: show refresh button inline since header only has title */}
          {isMobile && (
            <Group justify="flex-end">
              <Tooltip label="Refresh">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={handleRefresh}
                  loading={isFetching}
                  aria-label="Refresh dashboard"
                >
                  <RefreshCw size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}

          {/* Top row: Stripe + Upstash + Gemini Quota */}
          <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
            <ServiceCard<StripeData | { error: string }>
              queryKey="stripe"
              service="stripe"
              icon={<CreditCard size={18} color="var(--mantine-color-violet-5)" />}
              title="Stripe"
              badgeLabel="Payment"
              badgeColor="violet"
            >
              {(data) =>
                isError(data) ? <CardError message={data.error} /> : <StripeContent data={data} />
              }
            </ServiceCard>

            <ServiceCard<UpstashData | { error: string }>
              queryKey="upstash"
              service="upstash"
              icon={<Database size={18} color="var(--mantine-color-teal-5)" />}
              title="Upstash"
              badgeLabel="Cache"
              badgeColor="teal"
            >
              {(data) =>
                isError(data) ? <CardError message={data.error} /> : <UpstashContent data={data} />
              }
            </ServiceCard>

            <GeminiQuotaCard />
          </SimpleGrid>

          {/* Key Pool — full width */}
          <KeyPoolCard />

          {/* LLM Call Logs Preview */}
          <LlmLogsPreviewSection />
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
