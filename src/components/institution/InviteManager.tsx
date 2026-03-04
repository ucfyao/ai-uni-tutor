'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Loader,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { InstitutionInviteEntity } from '@/types/institution';

interface InviteManagerProps {
  invites: InstitutionInviteEntity[];
  onCreateInvite: (options?: { maxUses?: number; expiresAt?: string }) => Promise<void>;
  onToggleInvite: (inviteId: string, isActive: boolean) => void;
  loading?: boolean;
}

export function InviteManager({
  invites,
  onCreateInvite,
  onToggleInvite,
  loading,
}: InviteManagerProps) {
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateInvite();
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = (inviteId: string, isActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(inviteId));
    try {
      onToggleInvite(inviteId, isActive);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(inviteId);
        return next;
      });
    }
  };

  const getInviteLink = (code: string) => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/join/${code}`;
  };

  const formatExpiry = (expiresAt: Date | null) => {
    if (!expiresAt) return t.institution.noExpiry;
    return new Date(expiresAt).toLocaleDateString();
  };

  const formatMaxUses = (maxUses: number | null) => {
    if (maxUses === null) return t.institution.unlimited;
    return String(maxUses);
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">
            {t.institution.invites}
          </Text>
          <Button size="xs" variant="light" onClick={handleCreate} loading={creating}>
            {t.institution.createInvite}
          </Button>
        </Group>

        {loading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
          </Stack>
        ) : invites.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {t.institution.noInvites}
          </Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.institution.inviteLink}</Table.Th>
                <Table.Th>{t.institution.usedCount}</Table.Th>
                <Table.Th>{t.institution.expiresAt}</Table.Th>
                <Table.Th>{t.institution.status}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invites.map((invite) => (
                <Table.Tr key={invite.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500} ff="monospace">
                        {invite.inviteCode}
                      </Text>
                      <CopyButton value={getInviteLink(invite.inviteCode)} timeout={2000}>
                        {({ copied, copy }) => (
                          <Tooltip
                            label={copied ? t.institution.copied : t.institution.inviteLink}
                            withArrow
                          >
                            <ActionIcon
                              size="sm"
                              color={copied ? 'teal' : 'gray'}
                              variant="subtle"
                              onClick={copy}
                            >
                              {copied ? <Check size={14} /> : <Copy size={14} />}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {invite.usedCount} / {formatMaxUses(invite.maxUses)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatExpiry(invite.expiresAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Switch
                        size="sm"
                        checked={invite.isActive}
                        disabled={togglingIds.has(invite.id)}
                        onChange={() => handleToggle(invite.id, !invite.isActive)}
                      />
                      <Badge size="sm" variant="light" color={invite.isActive ? 'green' : 'gray'}>
                        {invite.isActive ? t.institution.active : t.institution.removed}
                      </Badge>
                    </Group>
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
