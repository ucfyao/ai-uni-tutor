'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import { getAgentDashboard } from '@/app/actions/agent-actions';
import { AgentKPICards } from '@/components/referral/AgentKPICards';
import { AgentTrendChart } from '@/components/referral/AgentTrendChart';
import { PromoCodeTable } from '@/components/referral/PromoCodeTable';
import { WalletSection } from '@/components/referral/WalletSection';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { AgentDashboardStats } from '@/types/referral';

export default function AgentDashboardClient() {
  const { t } = useLanguage();
  const { setHeaderContent } = useHeader();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<AgentDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" truncate>
        {t.agentDashboard.title}
      </Text>
    ),
    [t.agentDashboard.title],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  const fetchDashboard = useCallback(async () => {
    try {
      const result = await getAgentDashboard();
      if (result.success) {
        setStats(result.data);
      } else {
        showNotification({ message: result.error ?? t.common.error, color: 'red' });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard', error);
      showNotification({ message: t.common.error, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <Container size={900} py={60}>
        <Stack gap={24}>
          <Skeleton h={40} w={200} />
          <Skeleton h={100} />
          <Skeleton h={300} />
          <Skeleton h={200} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size={900} py={60}>
      <Stack gap={24}>
        <Title order={2} fw={700}>
          {t.agentDashboard.title}
        </Title>

        <AgentKPICards stats={stats} loading={loading} />
        <AgentTrendChart />
        <PromoCodeTable />
        <WalletSection stats={stats} onRefresh={fetchDashboard} />
      </Stack>
    </Container>
  );
}
