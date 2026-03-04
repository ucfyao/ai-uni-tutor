'use client';

import { CircleDollarSign, Link, Users, Wallet } from 'lucide-react';
import { Group, Paper, SimpleGrid, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { InstitutionDashboardStats } from '@/types/institution';

interface InstitutionKPICardsProps {
  stats: InstitutionDashboardStats | null;
  loading: boolean;
}

export function InstitutionKPICards({ stats, loading }: InstitutionKPICardsProps) {
  const { t } = useLanguage();

  const totalIncome = stats ? `\u00a5${(stats.totalIncome / 100).toFixed(2)}` : '\u00a50.00';

  const cards = [
    {
      label: t.institution.ambassadors,
      value: stats?.totalAmbassadors ?? 0,
      icon: Users,
      color: 'blue',
    },
    {
      label: t.institution.teamReferrals,
      value: stats?.teamReferrals ?? 0,
      icon: Link,
      color: 'violet',
    },
    {
      label: t.institution.paidConversions,
      value: stats?.paidConversions ?? 0,
      icon: CircleDollarSign,
      color: 'green',
    },
    {
      label: t.institution.totalIncome,
      value: totalIncome,
      icon: Wallet,
      color: 'orange',
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
            <ThemeIcon size="lg" radius="md" variant="light" color={card.color}>
              <card.icon size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
