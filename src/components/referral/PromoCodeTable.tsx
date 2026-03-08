'use client';

import { useCallback, useEffect, useState } from 'react';
import {
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
} from '@mantine/core';
import { generateAgentCode, toggleReferralCode } from '@/app/actions/agent-actions';
import { getMyCodes } from '@/app/actions/referral-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { ReferralCodeEntity } from '@/types/referral';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export function PromoCodeTable() {
  const { t } = useLanguage();
  const [codes, setCodes] = useState<ReferralCodeEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchCodes = useCallback(async () => {
    try {
      const result = await getMyCodes();
      if (result.success) {
        setCodes(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch codes', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCodes();
  }, [fetchCodes]);

  const handleNewCode = async () => {
    setCreating(true);
    try {
      const result = await generateAgentCode();
      if (result.success) {
        setCodes((prev) => [result.data, ...prev]);
        showNotification({ message: t.agentDashboard.newCode, color: 'green' });
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    } catch (error) {
      console.error('Failed to generate code', error);
      showNotification({ message: t.common.error, color: 'red' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (codeId: string, isActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(codeId));
    try {
      const result = await toggleReferralCode({ codeId, isActive });
      if (result.success) {
        setCodes((prev) => prev.map((c) => (c.id === codeId ? { ...c, isActive } : c)));
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    } catch (error) {
      console.error('Failed to toggle code', error);
      showNotification({ message: t.common.error, color: 'red' });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(codeId);
        return next;
      });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">
            {t.agentDashboard.promoCodes}
          </Text>
          <Button size="xs" variant="light" onClick={handleNewCode} loading={creating}>
            {t.agentDashboard.newCode}
          </Button>
        </Group>

        {loading ? (
          <Stack align="center" py="xl">
            <Loader size="sm" />
          </Stack>
        ) : codes.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {t.agentDashboard.noCodes}
          </Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t.agentDashboard.code}</Table.Th>
                <Table.Th>{t.agentDashboard.referralLink}</Table.Th>
                <Table.Th>{t.agentDashboard.status}</Table.Th>
                <Table.Th>{t.adminReferral.date}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {codes.map((code) => (
                <Table.Tr key={code.id}>
                  <Table.Td>
                    <Text size="sm" fw={500} ff="monospace">
                      {code.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed" truncate style={{ maxWidth: 180 }}>
                        {`${SITE_URL}/r/${code.code}`}
                      </Text>
                      <CopyButton value={`${SITE_URL}/r/${code.code}`}>
                        {({ copied, copy }) => (
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color={copied ? 'teal' : 'gray'}
                            onClick={copy}
                          >
                            {copied ? t.agentDashboard.linkCopied : t.agentDashboard.copyLink}
                          </Button>
                        )}
                      </CopyButton>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Switch
                        size="sm"
                        checked={code.isActive}
                        disabled={togglingIds.has(code.id)}
                        onChange={() => handleToggle(code.id, !code.isActive)}
                      />
                      <Badge size="sm" variant="light" color={code.isActive ? 'green' : 'gray'}>
                        {code.isActive ? t.agentDashboard.active : t.agentDashboard.inactive}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </Text>
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
