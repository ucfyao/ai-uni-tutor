'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  Cpu,
  CreditCard,
  Database,
  FileText,
  KeyRound,
  LayoutDashboard,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
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

interface GeminiModelData {
  name: string;
  label: string;
  today: number;
  monthly: number;
}

interface GeminiData {
  models: GeminiModelData[];
  totalToday: number;
  totalMonthly: number;
  activeUsersToday: number;
}

interface PoolEntryStatus {
  id: number;
  provider: 'gemini' | 'minimax';
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

interface LlmLogPreviewStats {
  totalToday: number;
  errorsToday: number;
  avgLatencyMs: number;
  estimatedCostToday: number;
}

interface LlmLogsPreview {
  logs: LlmLogRow[];
  stats: LlmLogPreviewStats;
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

function GeminiContent({ data }: { data: GeminiData }) {
  return (
    <Stack gap="sm">
      {data.models.map((model) => (
        <Stack key={model.name} gap={4}>
          <Text size="sm" fw={500}>
            {model.label}
          </Text>
          <Group justify="space-between" pl="sm">
            <Text size="xs" c="dimmed">
              Today
            </Text>
            <Text size="xs" fw={600}>
              {formatNumber(model.today)}
            </Text>
          </Group>
          <Group justify="space-between" pl="sm">
            <Text size="xs" c="dimmed">
              Monthly
            </Text>
            <Text size="xs" fw={600}>
              {formatNumber(model.monthly)}
            </Text>
          </Group>
        </Stack>
      ))}

      <Divider />

      <StatRow label="Total Today" value={formatNumber(data.totalToday)} />
      <StatRow label="Total Monthly" value={formatNumber(data.totalMonthly)} />
      <StatRow label="Active Users Today" value={formatNumber(data.activeUsersToday)} />
    </Stack>
  );
}

function PoolStatusContent({ data, onReset }: { data: PoolStatusData; onReset: () => void }) {
  const [resetting, setResetting] = useState(false);

  const [resetError, setResetError] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    setResetError(false);
    try {
      await onReset();
    } catch {
      setResetError(true);
    } finally {
      setResetting(false);
    }
  };

  const getStatusBadge = (entry: PoolEntryStatus) => {
    if (entry.disabled) {
      return (
        <Badge color="red" variant="light" size="xs">
          Disabled
        </Badge>
      );
    }
    if (entry.cooldownUntil > 0) {
      const remaining = Math.max(0, entry.cooldownUntil - data.serverTime);
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

  const hasCooldowns = data.entries.some((e) => e.cooldownUntil > 0);

  return (
    <Stack gap="xs">
      {data.entries.map((entry) => (
        <Group key={`${entry.pool}-${entry.id}`} justify="space-between" gap="xs">
          <Group gap="xs" style={{ minWidth: 0 }}>
            <Text size="xs" ff="monospace" c="dimmed" truncate>
              {entry.maskedKey}
            </Text>
            <Badge color="gray" variant="light" size="xs">
              {entry.provider}
            </Badge>
            {entry.pool === 'chat' && (
              <Badge color="indigo" variant="light" size="xs">
                chat
              </Badge>
            )}
          </Group>
          {getStatusBadge(entry)}
        </Group>
      ))}

      {hasCooldowns && (
        <Button
          size="xs"
          variant="light"
          color="orange"
          onClick={handleReset}
          loading={resetting}
          leftSection={<RefreshCw size={14} />}
          mt="xs"
        >
          Reset All Cooldowns
        </Button>
      )}

      {resetError && (
        <Text size="xs" c="red" mt={4}>
          Reset failed — please try again.
        </Text>
      )}
    </Stack>
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
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

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
          <Group gap="lg">
            <Badge color="blue" variant="light" size="lg">
              Today: {formatNumber(data.stats.totalToday)}
            </Badge>
            <Badge color={data.stats.errorsToday > 0 ? 'red' : 'green'} variant="light" size="lg">
              Errors: {data.stats.errorsToday}
            </Badge>
            <Badge
              color={formatLatencyBadge(data.stats.avgLatencyMs).color}
              variant="light"
              size="lg"
            >
              Avg: {formatLatencyBadge(data.stats.avgLatencyMs).label}
            </Badge>
          </Group>

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
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Latency</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.logs.map((log) => (
                    <Table.Tr
                      key={log.id}
                      bg={
                        log.status === 'error' ? 'var(--mantine-color-red-light)' : undefined
                      }
                    >
                      <Table.Td>
                        <Text size="xs" ff="monospace">
                          {formatTime(log.created_at)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" variant="light" color="gray">
                          {log.call_type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" truncate maw={120}>
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
                          color={formatLatencyBadge(log.latency_ms).color}
                          variant="light"
                        >
                          {formatLatencyBadge(log.latency_ms).label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
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

          {/* Cards grid — each card fetches independently */}
          <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="lg">
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

            <ServiceCard<GeminiData | { error: string }>
              queryKey="gemini"
              service="gemini"
              icon={<Cpu size={18} color="var(--mantine-color-blue-5)" />}
              title="Gemini"
              badgeLabel="LLM"
              badgeColor="blue"
            >
              {(data) =>
                isError(data) ? <CardError message={data.error} /> : <GeminiContent data={data} />
              }
            </ServiceCard>

            <ServiceCard<PoolStatusData | { error: string }>
              queryKey="gemini-pool"
              service="gemini-pool"
              icon={<KeyRound size={18} color="var(--mantine-color-orange-5)" />}
              title="Key Pool"
              badgeLabel="Status"
              badgeColor="orange"
            >
              {(data) =>
                isError(data) ? (
                  <CardError message={data.error} />
                ) : (
                  <PoolStatusContent
                    data={data}
                    onReset={async () => {
                      const res = await fetch('/api/admin/dashboard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'reset-pool' }),
                      });
                      if (!res.ok) throw new Error('Reset failed');
                      queryClient.invalidateQueries({
                        queryKey: ['admin-dashboard', 'gemini-pool'],
                      });
                    }}
                  />
                )
              }
            </ServiceCard>
          </SimpleGrid>

          {/* LLM Call Logs Preview */}
          <LlmLogsPreviewSection />
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
