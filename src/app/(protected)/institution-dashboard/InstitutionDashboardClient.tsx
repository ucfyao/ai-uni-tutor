'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Container, Skeleton, Stack, Text, Title } from '@mantine/core';
import {
  createInstitutionInvite,
  getAmbassadorStats,
  getInstitutionDashboard,
  listInstitutionInvites,
  removeInstitutionMember,
  toggleInstitutionInvite,
} from '@/app/actions/institution-actions';
import { AmbassadorTable } from '@/components/institution/AmbassadorTable';
import { InstitutionKPICards } from '@/components/institution/InstitutionKPICards';
import { InviteManager } from '@/components/institution/InviteManager';
import { WalletSection } from '@/components/referral/WalletSection';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type {
  AmbassadorStats as AmbassadorStatsType,
  InstitutionDashboardStats,
  InstitutionInviteEntity,
} from '@/types/institution';
import type { AgentDashboardStats } from '@/types/referral';

export default function InstitutionDashboardClient() {
  const { t } = useLanguage();
  const { setHeaderContent } = useHeader();
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<InstitutionDashboardStats | null>(null);
  const [ambassadors, setAmbassadors] = useState<AmbassadorStatsType[]>([]);
  const [invites, setInvites] = useState<InstitutionInviteEntity[]>([]);
  const [loading, setLoading] = useState(true);

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" truncate>
        {t.institution.title}
      </Text>
    ),
    [t.institution.title],
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
      const [dashResult, ambassadorResult, inviteResult] = await Promise.all([
        getInstitutionDashboard(),
        getAmbassadorStats(),
        listInstitutionInvites(),
      ]);
      if (dashResult.success) setStats(dashResult.data);
      else showNotification({ message: dashResult.error ?? t.common.error, color: 'red' });
      if (ambassadorResult.success) setAmbassadors(ambassadorResult.data);
      else showNotification({ message: ambassadorResult.error ?? t.common.error, color: 'red' });
      if (inviteResult.success) setInvites(inviteResult.data);
      else showNotification({ message: inviteResult.error ?? t.common.error, color: 'red' });
    } catch (error) {
      console.error('Failed to fetch institution dashboard', error);
      showNotification({ message: t.common.error, color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const handleCreateInvite = useCallback(
    async (input?: { maxUses?: number; expiresAt?: string }) => {
      const result = await createInstitutionInvite(input ?? {});
      if (result.success) {
        showNotification({ message: t.toast.changesSaved, color: 'green' });
        void fetchDashboard();
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    },
    [fetchDashboard, t.toast.changesSaved],
  );

  const handleToggleInvite = useCallback(
    async (inviteId: string, isActive: boolean) => {
      const result = await toggleInstitutionInvite({ inviteId, isActive });
      if (result.success) {
        void fetchDashboard();
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    },
    [fetchDashboard],
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      const result = await removeInstitutionMember({ userId });
      if (result.success) {
        showNotification({ message: t.toast.deletedSuccessfully, color: 'green' });
        void fetchDashboard();
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    },
    [fetchDashboard, t.toast.deletedSuccessfully],
  );

  // Map InstitutionDashboardStats to AgentDashboardStats for WalletSection reuse
  const walletStats: AgentDashboardStats | null = stats
    ? {
        totalReferrals: stats.teamReferrals,
        paidReferrals: stats.paidConversions,
        totalEarned: stats.totalIncome,
        walletBalance: stats.walletBalance,
        pendingWithdrawals: stats.pendingWithdrawals,
      }
    : null;

  if (loading) {
    return (
      <Container size={900} py={60}>
        <Stack gap={24}>
          <Skeleton h={40} w={200} />
          <Skeleton h={100} />
          <Skeleton h={300} />
          <Skeleton h={200} />
          <Skeleton h={200} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size={900} py={60}>
      <Stack gap={24}>
        {!isMobile && (
          <Title order={2} fw={700}>
            {t.institution.title}
          </Title>
        )}

        <InstitutionKPICards stats={stats} loading={loading} />

        <AmbassadorTable ambassadors={ambassadors} onRemove={handleRemoveMember} />

        <InviteManager
          invites={invites}
          onCreateInvite={handleCreateInvite}
          onToggleInvite={handleToggleInvite}
        />

        <WalletSection stats={walletStats} onRefresh={fetchDashboard} />
      </Stack>
    </Container>
  );
}
