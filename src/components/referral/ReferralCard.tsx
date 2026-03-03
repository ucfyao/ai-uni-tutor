'use client';

import { Gift, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  CopyButton,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  generateReferralCode,
  getMyCodes,
  getMyReferrals,
  getReferralConfigPublic,
  getReferralStats,
} from '@/app/actions/referral-actions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type {
  ReferralCodeEntity,
  ReferralConfigMap,
  ReferralStats,
  ReferralWithReferee,
} from '@/types/referral';
import { AgentApplicationModal } from './AgentApplicationModal';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function statusBadge(
  status: string,
  t: ReturnType<typeof useLanguage>['t'],
): { label: string; color: string } {
  switch (status) {
    case 'registered':
      return { label: t.referral.statusRegistered, color: 'yellow' };
    case 'paid':
      return { label: t.referral.statusPaid, color: 'blue' };
    case 'rewarded':
      return { label: t.referral.statusRewarded, color: 'green' };
    default:
      return { label: status, color: 'gray' };
  }
}

export function ReferralCard() {
  const { t } = useLanguage();

  const [codes, setCodes] = useState<ReferralCodeEntity[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralWithReferee[]>([]);
  const [config, setConfig] = useState<ReferralConfigMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [codesRes, statsRes, referralsRes, configRes] = await Promise.all([
        getMyCodes(),
        getReferralStats(),
        getMyReferrals(),
        getReferralConfigPublic(),
      ]);
      if (codesRes.success) setCodes(codesRes.data);
      if (statsRes.success) setStats(statsRes.data);
      if (referralsRes.success) setReferrals(referralsRes.data);
      if (configRes.success) setConfig(configRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateReferralCode();
      if (result.success) {
        setCodes((prev) => [...prev, result.data]);
      } else {
        showNotification({ message: result.error, color: 'red' });
      }
    } finally {
      setGenerating(false);
    }
  };

  const activeCode = codes.find((c) => c.isActive);
  const referralLink = activeCode ? `${SITE_URL}/r/${activeCode.code}` : null;

  if (loading) {
    return (
      <Paper withBorder p="xl" radius="lg">
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      </Paper>
    );
  }

  return (
    <>
      <Paper withBorder p={0} radius="lg" style={{ overflow: 'hidden' }}>
        {/* Gradient header */}
        <Box
          p="xl"
          style={{
            background:
              'linear-gradient(135deg, var(--mantine-color-indigo-7), var(--mantine-color-indigo-4))',
          }}
        >
          <Group gap="sm" align="flex-start">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              mt={2}
            >
              <Gift size={20} color="white" />
            </Box>
            <Box style={{ flex: 1 }}>
              <Title order={3} fw={700} c="white">
                {t.referral.title}
              </Title>
            </Box>
          </Group>
        </Box>

        {/* Content */}
        <Stack p="xl" gap="lg">
          {/* Referral link section */}
          {referralLink ? (
            <Stack gap="xs">
              <Text fw={500} fz="sm">
                {t.referral.yourLink}
              </Text>
              <Group gap="xs">
                <Paper withBorder p="xs" radius="md" style={{ flex: 1, overflow: 'hidden' }}>
                  <Text fz="sm" c="dimmed" truncate>
                    {referralLink}
                  </Text>
                </Paper>
                <CopyButton value={referralLink}>
                  {({ copied, copy }) => (
                    <Button
                      size="sm"
                      variant={copied ? 'filled' : 'light'}
                      color={copied ? 'teal' : 'indigo'}
                      onClick={copy}
                    >
                      {copied ? t.referral.copied : t.referral.copy}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Stack>
          ) : (
            <Button variant="light" color="indigo" onClick={handleGenerate} loading={generating}>
              {t.referral.generateCode}
            </Button>
          )}

          {/* Reward explanation */}
          <Stack gap={4}>
            <Text fz="sm" c="dimmed">
              {t.referral.rewardExplanation}
            </Text>
            <Text fz="sm" fw={500}>
              {t.referral.youGet.replace('{days}', String(config?.user_reward_days ?? 7))}
            </Text>
            <Text fz="sm" fw={500}>
              {t.referral.friendGets.replace(
                '{percent}',
                String(config?.referee_discount_percent ?? 10),
              )}
            </Text>
          </Stack>

          {/* Stats summary */}
          {stats && (
            <Group grow>
              <Paper withBorder p="md" radius="md" ta="center">
                <Text fz="xl" fw={700} c="indigo">
                  {stats.totalReferrals}
                </Text>
                <Text fz="xs" c="dimmed">
                  {t.referral.totalInvited}
                </Text>
              </Paper>
              <Paper withBorder p="md" radius="md" ta="center">
                <Text fz="xl" fw={700} c="indigo">
                  {stats.paidReferrals}
                </Text>
                <Text fz="xs" c="dimmed">
                  {t.referral.totalPaid}
                </Text>
              </Paper>
              <Paper withBorder p="md" radius="md" ta="center">
                <Text fz="xl" fw={700} c="indigo">
                  {t.referral.daysEarned.replace('{days}', String(stats.totalRewardDays))}
                </Text>
                <Text fz="xs" c="dimmed">
                  {t.referral.earned}
                </Text>
              </Paper>
            </Group>
          )}

          {/* Referral history */}
          <Stack gap="xs">
            <Group gap="xs">
              <Users size={16} />
              <Text fw={600} fz="sm">
                {t.referral.myReferrals}
              </Text>
            </Group>

            {referrals.length === 0 ? (
              <Text fz="sm" c="dimmed" ta="center" py="md">
                {t.referral.noReferrals}
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={400}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <Text fz="xs" fw={600}>
                          {t.referral.user}
                        </Text>
                      </Table.Th>
                      <Table.Th>
                        <Text fz="xs" fw={600}>
                          {t.referral.status}
                        </Text>
                      </Table.Th>
                      <Table.Th>
                        <Text fz="xs" fw={600}>
                          {t.referral.date}
                        </Text>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {referrals.map((r) => {
                      const badge = statusBadge(r.status, t);
                      return (
                        <Table.Tr key={r.id}>
                          <Table.Td>
                            <Text fz="sm">{r.refereeName ?? r.refereeEmail ?? '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color={badge.color} size="sm">
                              {badge.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text fz="xs" c="dimmed">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>

          {/* CTA: Apply as Campus Agent */}
          <Button variant="subtle" color="indigo" onClick={() => setAgentModalOpen(true)}>
            {t.referral.becomeAgent}
          </Button>
        </Stack>
      </Paper>

      <AgentApplicationModal opened={agentModalOpen} onClose={() => setAgentModalOpen(false)} />
    </>
  );
}
