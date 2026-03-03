'use client';

import { Group, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AgentDashboardStats } from '@/types/referral';

interface AgentKPICardsProps {
  stats: AgentDashboardStats | null;
  loading: boolean;
}

export function AgentKPICards({ stats, loading }: AgentKPICardsProps) {
  const { t } = useLanguage();

  const conversionRate =
    stats && stats.totalReferrals > 0
      ? ((stats.paidReferrals / stats.totalReferrals) * 100).toFixed(1)
      : '0.0';

  const monthlyIncome = stats ? (stats.totalEarned / 100).toFixed(2) : '0.00';

  const cards = [
    {
      label: t.agentDashboard.totalInvited,
      value: stats?.totalReferrals ?? 0,
    },
    {
      label: t.agentDashboard.totalPaid,
      value: stats?.paidReferrals ?? 0,
    },
    {
      label: t.agentDashboard.conversionRate,
      value: `${conversionRate}%`,
    },
    {
      label: t.agentDashboard.monthlyIncome,
      value: `\u00a5${monthlyIncome}`,
    },
  ];

  if (loading) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {Array.from({ length: 4 }).map((_, i) => (
          <Paper key={i} withBorder p="md" radius="md">
            <Stack gap={8}>
              <Skeleton h={14} w={80} />
              <Skeleton h={28} w={60} />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    );
  }

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      {cards.map((card) => (
        <Paper key={card.label} withBorder p="md" radius="md">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={4}>
              <Text size="sm" c="dimmed" fw={500}>
                {card.label}
              </Text>
              <Text size="xl" fw={700}>
                {card.value}
              </Text>
            </Stack>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
