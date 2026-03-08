'use client';

import { CreditCard, TrendingUp, Users, Wallet } from 'lucide-react';
import { Box, Group, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
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
      icon: Users,
      color: 'blue',
    },
    {
      label: t.agentDashboard.totalPaid,
      value: stats?.paidReferrals ?? 0,
      icon: CreditCard,
      color: 'green',
    },
    {
      label: t.agentDashboard.conversionRate,
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'orange',
    },
    {
      label: t.agentDashboard.monthlyIncome,
      value: `\u00a5${monthlyIncome}`,
      icon: Wallet,
      color: 'indigo',
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
          <Group gap="md" wrap="nowrap">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `var(--mantine-color-${card.color}-0)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <card.icon size={20} color={`var(--mantine-color-${card.color}-6)`} />
            </Box>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={500}>
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
