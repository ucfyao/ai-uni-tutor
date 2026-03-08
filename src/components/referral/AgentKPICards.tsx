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
      color: 'pink',
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
        <Paper
          key={card.label}
          withBorder
          p="md"
          radius="md"
          style={{
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            cursor: 'default',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Group gap="md" wrap="nowrap">
            <Box
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `var(--mantine-color-${card.color}-0)`,
                border: `1px solid var(--mantine-color-${card.color}-1)`,
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
