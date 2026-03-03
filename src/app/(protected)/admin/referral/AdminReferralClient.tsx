'use client';

import { Users } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import { Box, Group, ScrollArea, Tabs, Text } from '@mantine/core';
import { AdminContent } from '@/components/admin/AdminContent';
import { AgentApplicationsTab } from '@/components/admin/AgentApplicationsTab';
import { ReferralConfigTab } from '@/components/admin/ReferralConfigTab';
import { WithdrawalsTab } from '@/components/admin/WithdrawalsTab';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';

export function AdminReferralClient() {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const { t } = useLanguage();

  const headerNode = useMemo(
    () => (
      <Group gap={8} align="center" wrap="nowrap" px={isMobile ? 6 : 8} py={isMobile ? 4 : 6}>
        <Users size={isMobile ? 18 : 20} color="var(--mantine-color-indigo-5)" />
        <Text fw={650} size={isMobile ? 'md' : 'lg'}>
          {t.sidebar.referralAdmin}
        </Text>
      </Group>
    ),
    [isMobile, t],
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
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      {/* Main Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <AdminContent>
          <Tabs defaultValue="applications" variant="outline" radius="md">
            <Tabs.List mb="lg">
              <Tabs.Tab value="applications">{t.adminReferral.applications}</Tabs.Tab>
              <Tabs.Tab value="withdrawals">{t.adminReferral.withdrawals}</Tabs.Tab>
              <Tabs.Tab value="config">{t.adminReferral.config}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="applications">
              <AgentApplicationsTab />
            </Tabs.Panel>

            <Tabs.Panel value="withdrawals">
              <WithdrawalsTab />
            </Tabs.Panel>

            <Tabs.Panel value="config">
              <ReferralConfigTab />
            </Tabs.Panel>
          </Tabs>
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
