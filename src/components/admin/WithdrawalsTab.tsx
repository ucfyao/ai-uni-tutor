'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  approveWithdrawal,
  completeWithdrawal,
  listWithdrawalRequests,
  rejectWithdrawal,
} from '@/app/actions/admin/referral-admin-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { WithdrawalRequestEntity } from '@/types/referral';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'completed';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'blue',
  rejected: 'red',
  completed: 'green',
};

export function WithdrawalsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isPending, startTransition] = useTransition();

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ['admin-withdrawals', statusFilter],
    queryFn: async () => {
      const input = statusFilter === 'all' ? {} : { status: statusFilter };
      const result = await listWithdrawalRequests(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
  }, [queryClient]);

  const handleApprove = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await approveWithdrawal({ id });
        if (result.success) {
          showNotification({ message: t.adminReferral.approve, color: 'green' });
          invalidate();
        } else {
          showNotification({ message: result.error, color: 'red' });
        }
      });
    },
    [t, invalidate],
  );

  const handleReject = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await rejectWithdrawal({ id });
        if (result.success) {
          showNotification({ message: t.adminReferral.reject, color: 'green' });
          invalidate();
        } else {
          showNotification({ message: result.error, color: 'red' });
        }
      });
    },
    [t, invalidate],
  );

  const handleComplete = useCallback(
    (id: string) => {
      startTransition(async () => {
        const result = await completeWithdrawal({ id });
        if (result.success) {
          showNotification({ message: t.adminReferral.markComplete, color: 'green' });
          invalidate();
        } else {
          showNotification({ message: result.error, color: 'red' });
        }
      });
    },
    [t, invalidate],
  );

  const formatAmount = (cents: number) => {
    return `¥${(cents / 100).toFixed(2)}`;
  };

  const formatPaymentMethod = (method: Record<string, unknown>) => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(method)) {
      if (value) parts.push(`${key}: ${String(value)}`);
    }
    return parts.join(', ') || '—';
  };

  const thStyle: React.CSSProperties = {
    color: 'var(--mantine-color-gray-5)',
    fontWeight: 500,
    fontSize: 'var(--mantine-font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <SegmentedControl
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as StatusFilter)}
        data={[
          { label: 'All', value: 'all' },
          { label: 'Pending', value: 'pending' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'Completed', value: 'completed' },
        ]}
        size="sm"
      />

      {withdrawals.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl" size="sm">
          {t.adminReferral.noWithdrawals}
        </Text>
      ) : (
        <Card
          withBorder
          radius="lg"
          p={0}
          style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)', overflow: 'auto' }}
        >
          <Table
            verticalSpacing="sm"
            highlightOnHover
            highlightOnHoverColor="var(--mantine-color-gray-0)"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={thStyle}>User</Table.Th>
                <Table.Th style={thStyle}>{t.agentDashboard.amount}</Table.Th>
                <Table.Th style={thStyle}>{t.agentDashboard.method}</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>{t.adminReferral.date}</Table.Th>
                <Table.Th style={thStyle} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {withdrawals.map((w: WithdrawalRequestEntity) => (
                <Table.Tr key={w.id}>
                  <Table.Td>
                    <Text size="sm" c="dimmed" truncate style={{ maxWidth: 160 }}>
                      {w.userId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatAmount(w.amount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ maxWidth: 200 }} truncate>
                      {formatPaymentMethod(w.paymentMethod)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[w.status] || 'gray'} variant="light" size="sm">
                      {w.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(w.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {w.status === 'pending' && (
                      <Group gap={6}>
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          loading={isPending}
                          onClick={() => handleApprove(w.id)}
                        >
                          {t.adminReferral.approve}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          loading={isPending}
                          onClick={() => handleReject(w.id)}
                        >
                          {t.adminReferral.reject}
                        </Button>
                      </Group>
                    )}
                    {w.status === 'approved' && (
                      <Button
                        size="xs"
                        color="teal"
                        variant="light"
                        loading={isPending}
                        onClick={() => handleComplete(w.id)}
                      >
                        {t.adminReferral.markComplete}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
