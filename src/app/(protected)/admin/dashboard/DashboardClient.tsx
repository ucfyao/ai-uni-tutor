'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Cpu, CreditCard, Database, RefreshCw } from 'lucide-react';
import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Divider,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';

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
  dailyCommands: number;
  dailyCommandsLimit: number;
  monthlyBandwidth: number;
  monthlyBandwidthLimit: number;
  currentStorage: number;
  storageLimit: number;
  monthlyBilling: number;
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

interface DashboardResponse {
  stripe: StripeData | { error: string };
  upstash: UpstashData | { error: string };
  gemini: GeminiData | { error: string };
  fetchedAt: string;
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
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
// Card error fallback
// ---------------------------------------------------------------------------

function CardError({ message }: { message: string }) {
  return (
    <Alert color="red" variant="light" icon={<AlertCircle size={16} />}>
      {message}
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Individual cards
// ---------------------------------------------------------------------------

function StripeCard({ data }: { data: StripeData | { error: string } }) {
  if (isError(data)) return <CardError message={data.error} />;

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

function UpstashCard({ data }: { data: UpstashData | { error: string } }) {
  if (isError(data)) return <CardError message={data.error} />;

  return (
    <Stack gap="sm">
      <Badge color="gray" variant="light" size="xs">
        Plan: {data.plan}
      </Badge>
      <UsageRow label="Daily Commands" used={data.dailyCommands} limit={data.dailyCommandsLimit} />
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
      <StatRow label="Monthly Requests" value={formatNumber(data.monthlyRequests)} />
      <StatRow label="Monthly Cost" value={`$${data.monthlyBilling.toFixed(2)}`} />
    </Stack>
  );
}

function GeminiCard({ data }: { data: GeminiData | { error: string } }) {
  if (isError(data)) return <CardError message={data.error} />;

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

// ---------------------------------------------------------------------------
// Main dashboard client
// ---------------------------------------------------------------------------

export function DashboardClient() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard');
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard data (${res.status})`);
      }
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  const updatedAt = data?.fetchedAt ? formatTime(data.fetchedAt) : null;

  if (isLoading) {
    return (
      <Stack align="center" justify="center" h="100%" py="xl">
        <Loader size="md" />
        <Text size="sm" c="dimmed">
          Loading dashboard...
        </Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack p="lg" maw={600} mx="auto">
        <Alert color="red" variant="light" title="Error" icon={<AlertCircle size={16} />}>
          {error instanceof Error ? error.message : 'Failed to load dashboard data'}
        </Alert>
      </Stack>
    );
  }

  if (!data) return null;

  return (
    <Stack gap="lg" p="lg" maw={1200} mx="auto">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Title order={3}>API Dashboard</Title>
        <Group gap="sm" align="center">
          {updatedAt && (
            <Text size="xs" c="dimmed">
              Updated: {updatedAt}
            </Text>
          )}
          <Tooltip label="Refresh">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => refetch()}
              loading={isFetching}
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Cards grid */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {/* Stripe */}
        <Card withBorder shadow="sm" padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <CreditCard size={18} color="var(--mantine-color-violet-5)" />
              <Text fw={600}>Stripe</Text>
            </Group>
            <Badge color="violet" variant="light" size="sm">
              Payment
            </Badge>
          </Group>
          <StripeCard data={data.stripe} />
        </Card>

        {/* Upstash */}
        <Card withBorder shadow="sm" padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Database size={18} color="var(--mantine-color-teal-5)" />
              <Text fw={600}>Upstash</Text>
            </Group>
            <Badge color="teal" variant="light" size="sm">
              Cache
            </Badge>
          </Group>
          <UpstashCard data={data.upstash} />
        </Card>

        {/* Gemini */}
        <Card withBorder shadow="sm" padding="lg">
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Cpu size={18} color="var(--mantine-color-blue-5)" />
              <Text fw={600}>Gemini</Text>
            </Group>
            <Badge color="blue" variant="light" size="sm">
              LLM
            </Badge>
          </Group>
          <GeminiCard data={data.gemini} />
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
