'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Loader, Paper, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { getAgentConfig, getWithdrawalHistory } from '@/app/actions/agent-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AgentDashboardStats, WithdrawalRequestEntity } from '@/types/referral';
import { WithdrawalModal } from './WithdrawalModal';

interface WalletSectionProps {
  stats: AgentDashboardStats | null;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'blue',
  completed: 'green',
  rejected: 'red',
};

export function WalletSection({ stats, onRefresh }: WalletSectionProps) {
  const { t } = useLanguage();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [minWithdrawal, setMinWithdrawal] = useState(5000); // default 5000 cents = ¥50

  const statusLabels: Record<string, string> = {
    pending: t.agentDashboard.withdrawalPending,
    approved: t.agentDashboard.withdrawalApproved,
    completed: t.agentDashboard.withdrawalCompleted,
    rejected: t.agentDashboard.withdrawalRejected,
  };

  const fetchWithdrawals = useCallback(async () => {
    try {
      const [withdrawalResult, configResult] = await Promise.all([
        getWithdrawalHistory(),
        getAgentConfig(),
      ]);
      if (withdrawalResult.success) {
        setWithdrawals(withdrawalResult.data);
      }
      if (configResult.success) {
        setMinWithdrawal(configResult.data.minWithdrawalAmount);
      }
    } catch (error) {
      console.error('Failed to fetch withdrawals', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWithdrawals();
  }, [fetchWithdrawals]);

  const formatCNY = (cents: number) => `\u00a5${(cents / 100).toFixed(2)}`;

  const balance = stats?.walletBalance ?? 0;
  const totalEarned = stats?.totalEarned ?? 0;
  const totalWithdrawn = totalEarned - balance - (stats?.pendingWithdrawals ?? 0);

  const handleWithdrawalSuccess = () => {
    void fetchWithdrawals();
    onRefresh();
  };

  return (
    <>
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600} size="lg">
            {t.agentDashboard.wallet}
          </Text>

          {/* Balance hero */}
          <Paper withBorder p="lg" radius="md" style={{ textAlign: 'center' }}>
            <Text size="sm" c="dimmed" mb={4}>
              {t.agentDashboard.balance}
            </Text>
            <Text size="2rem" fw={700} c="indigo">
              {formatCNY(balance)}
            </Text>
            <Button
              size="sm"
              variant="light"
              color="indigo"
              mt="md"
              onClick={() => setModalOpened(true)}
            >
              {t.agentDashboard.withdraw}
            </Button>
          </Paper>

          {/* Earned / Withdrawn */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper withBorder p="sm" radius="md">
              <Text size="sm" c="dimmed">
                {t.agentDashboard.totalEarned}
              </Text>
              <Text size="xl" fw={700}>
                {formatCNY(totalEarned)}
              </Text>
            </Paper>
            <Paper withBorder p="sm" radius="md">
              <Text size="sm" c="dimmed">
                {t.agentDashboard.totalWithdrawn}
              </Text>
              <Text size="xl" fw={700}>
                {formatCNY(Math.max(0, totalWithdrawn))}
              </Text>
            </Paper>
          </SimpleGrid>

          <Text fw={500} size="md" mt="sm">
            {t.agentDashboard.withdrawalHistory}
          </Text>

          {loading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" />
            </Stack>
          ) : withdrawals.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl" size="sm">
              {t.agentDashboard.noWithdrawals}
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t.agentDashboard.amount}</Table.Th>
                  <Table.Th>{t.agentDashboard.method}</Table.Th>
                  <Table.Th>{t.agentDashboard.status}</Table.Th>
                  <Table.Th>{t.adminReferral.date}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {withdrawals.map((w) => {
                  const methodInfo = w.paymentMethod as { type?: string } | null;
                  const methodType = methodInfo?.type ?? '';
                  const methodLabel =
                    methodType === 'alipay'
                      ? t.agentDashboard.alipay
                      : methodType === 'wechat'
                        ? t.agentDashboard.wechatPay
                        : methodType === 'bank'
                          ? t.agentDashboard.bankTransfer
                          : methodType;
                  return (
                    <Table.Tr key={w.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {formatCNY(w.amount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{methodLabel}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color={STATUS_COLORS[w.status] ?? 'gray'}>
                          {statusLabels[w.status] ?? w.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      <WithdrawalModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        balance={balance}
        minWithdrawal={minWithdrawal}
        onSuccess={handleWithdrawalSuccess}
      />
    </>
  );
}
