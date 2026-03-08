'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
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

/** Parse the motivation field to extract courses and notes */
function parseMotivation(motivation: string): { courses: string; notes: string } {
  const match = motivation.match(/^\[.*?:\s*(.+?)\]\n?([\s\S]*)$/);
  if (match) {
    return { courses: match[1].trim(), notes: match[2].trim() };
  }
  return { courses: '', notes: motivation };
}

export function AgentApplicationsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AgentApplicationEntity | null>(null);

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
          setSelected(null);
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

  const statusLabels: Record<string, string> = {
    pending: t.adminReferral.statusPending,
    approved: t.adminReferral.statusApproved,
    rejected: t.adminReferral.statusRejected,
  };

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  const parsed = selected ? parseMotivation(selected.motivation) : null;

  return (
    <>
      <Stack gap="md">
        <SegmentedControl
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          data={[
            { label: t.adminReferral.statusAll, value: 'all' },
            { label: t.adminReferral.statusPending, value: 'pending' },
            { label: t.adminReferral.statusApproved, value: 'approved' },
            { label: t.adminReferral.statusRejected, value: 'rejected' },
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
                  <Table.Th style={thStyle}>{t.adminReferral.status}</Table.Th>
                  <Table.Th style={thStyle}>{t.adminReferral.date}</Table.Th>
                  <Table.Th style={thStyle} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {applications.map((app: AgentApplicationEntity) => (
                  <Table.Tr
                    key={app.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(app)}
                  >
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
                        {statusLabels[app.status] ?? app.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {app.status === 'pending' && (
                        <Group gap={6} onClick={(e) => e.stopPropagation()}>
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

      {/* Detail drawer */}
      <Drawer
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={t.adminReferral.detail}
        position="right"
        size="md"
        styles={{
          title: { fontWeight: 700 },
        }}
      >
        {selected && parsed && (
          <Stack gap="lg">
            {/* Basic info */}
            <Stack gap="xs">
              <DetailRow label={t.adminReferral.applicant} value={selected.fullName} />
              <DetailRow label={t.adminReferral.university} value={selected.university} />
              <DetailRow
                label={t.adminReferral.contact}
                value={formatContact(selected.contactInfo)}
              />
              <DetailRow
                label={t.adminReferral.date}
                value={new Date(selected.createdAt).toLocaleString()}
              />
            </Stack>

            <Divider />

            {/* Courses & motivation */}
            <Stack gap="xs">
              {parsed.courses && (
                <DetailRow label={t.adminReferral.courses} value={parsed.courses} />
              )}
              {parsed.notes && (
                <Stack gap={4}>
                  <Text fz="xs" c="dimmed" fw={500}>
                    {t.adminReferral.motivation}
                  </Text>
                  <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {parsed.notes}
                  </Text>
                </Stack>
              )}
            </Stack>

            <Divider />

            {/* Status */}
            <Group gap="sm" align="center">
              <Text fz="xs" c="dimmed" fw={500}>
                {t.adminReferral.status}
              </Text>
              <Badge color={STATUS_COLORS[selected.status] || 'gray'} variant="light" size="sm">
                {statusLabels[selected.status] ?? selected.status}
              </Badge>
            </Group>

            {selected.reviewedAt && (
              <DetailRow
                label={t.adminReferral.reviewedAt}
                value={new Date(selected.reviewedAt).toLocaleString()}
              />
            )}

            {/* Actions for pending */}
            {selected.status === 'pending' && (
              <>
                <Divider />
                <Group gap="sm">
                  <Button
                    color="green"
                    variant="light"
                    loading={isPending}
                    onClick={() => handleReview(selected.id, 'approved')}
                    style={{ flex: 1 }}
                  >
                    {t.adminReferral.approve}
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    loading={isPending}
                    onClick={() => handleReview(selected.id, 'rejected')}
                    style={{ flex: 1 }}
                  >
                    {t.adminReferral.reject}
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        )}
      </Drawer>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Text fz="xs" c="dimmed" fw={500} miw={80} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text fz="sm">{value}</Text>
    </Group>
  );
}
