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
  listAgentApplications,
  reviewAgentApplication,
} from '@/app/actions/admin/referral-admin-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { AgentApplicationEntity } from '@/types/referral';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

export function AgentApplicationsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isPending, startTransition] = useTransition();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admin-agent-applications', statusFilter],
    queryFn: async () => {
      const input = statusFilter === 'all' ? {} : { status: statusFilter };
      const result = await listAgentApplications(input);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-agent-applications'] });
  }, [queryClient]);

  const handleReview = useCallback(
    (id: string, decision: 'approved' | 'rejected') => {
      startTransition(async () => {
        const result = await reviewAgentApplication({ id, decision });
        if (result.success) {
          showNotification({
            message: decision === 'approved' ? t.adminReferral.approve : t.adminReferral.reject,
            color: 'green',
          });
          invalidate();
        } else {
          showNotification({ message: result.error, color: 'red' });
        }
      });
    },
    [t, invalidate],
  );

  const formatContact = (contactInfo: Record<string, unknown>) => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(contactInfo)) {
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
        ]}
        size="sm"
      />

      {applications.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl" size="sm">
          {t.adminReferral.noApplications}
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
                <Table.Th style={thStyle}>{t.adminReferral.applicant}</Table.Th>
                <Table.Th style={thStyle}>{t.adminReferral.university}</Table.Th>
                <Table.Th style={thStyle}>{t.adminReferral.contact}</Table.Th>
                <Table.Th style={thStyle}>Status</Table.Th>
                <Table.Th style={thStyle}>{t.adminReferral.date}</Table.Th>
                <Table.Th style={thStyle} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {applications.map((app: AgentApplicationEntity) => (
                <Table.Tr key={app.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {app.fullName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {app.university}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ maxWidth: 200 }} truncate>
                      {formatContact(app.contactInfo)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[app.status] || 'gray'} variant="light" size="sm">
                      {app.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {app.status === 'pending' && (
                      <Group gap={6}>
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          loading={isPending}
                          onClick={() => handleReview(app.id, 'approved')}
                        >
                          {t.adminReferral.approve}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          loading={isPending}
                          onClick={() => handleReview(app.id, 'rejected')}
                        >
                          {t.adminReferral.reject}
                        </Button>
                      </Group>
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
