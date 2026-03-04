'use client';

import { Badge, Button, Loader, Paper, Stack, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AmbassadorStats } from '@/types/institution';

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  suspended: 'yellow',
  removed: 'red',
};

interface AmbassadorTableProps {
  ambassadors: AmbassadorStats[];
  onRemove: (userId: string) => void;
  loading?: boolean;
}

export function AmbassadorTable({ ambassadors, onRemove, loading }: AmbassadorTableProps) {
  const { t } = useLanguage();

  const statusLabels: Record<string, string> = {
    active: t.institution.active,
    suspended: t.institution.suspended,
    removed: t.institution.removed,
  };

  const handleRemove = (ambassador: AmbassadorStats) => {
    modals.openConfirmModal({
      title: t.institution.remove,
      children: <Text size="sm">{t.institution.removeConfirm}</Text>,
      labels: { confirm: t.common.confirm, cancel: t.common.cancel },
      confirmProps: { color: 'red' },
      onConfirm: () => onRemove(ambassador.userId),
    });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Text fw={600} size="lg">
          {t.institution.ambassadors}
        </Text>

        {loading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
          </Stack>
        ) : ambassadors.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {t.institution.noMembers}
          </Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.institution.name}</Table.Th>
                <Table.Th>{t.institution.email}</Table.Th>
                <Table.Th>{t.institution.referrals}</Table.Th>
                <Table.Th>{t.institution.paidCount}</Table.Th>
                <Table.Th>{t.institution.status}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ambassadors.map((ambassador) => (
                <Table.Tr key={ambassador.userId}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {ambassador.fullName ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {ambassador.email ?? '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{ambassador.referralCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{ambassador.paidCount}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      variant="light"
                      color={STATUS_COLORS[ambassador.status] ?? 'gray'}
                    >
                      {statusLabels[ambassador.status] ?? ambassador.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {ambassador.status === 'active' && (
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => handleRemove(ambassador)}
                      >
                        {t.institution.remove}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}
