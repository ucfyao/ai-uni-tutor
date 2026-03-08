'use client';

import { CreditCard, Gift, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  CopyButton,
  Group,
  Loader,
  Paper,
  SimpleGrid,
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
import { AgentApplicationModal } from '@/components/referral/AgentApplicationModal';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type {
  ReferralCodeEntity,
  ReferralConfigMap,
  ReferralStats,
  ReferralWithReferee,
} from '@/types/referral';
import styles from './referral.module.css';

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

export default function ReferralPageClient() {
  const { t } = useLanguage();
  const { setHeaderContent } = useHeader();
  const isMobile = useIsMobile();

  const [codes, setCodes] = useState<ReferralCodeEntity[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralWithReferee[]>([]);
  const [config, setConfig] = useState<Pick<
    ReferralConfigMap,
    'user_reward_days' | 'referee_discount_percent'
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" truncate>
        {t.referral.title}
      </Text>
    ),
    [t.referral.title],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

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
      <Container size={900} py={60}>
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      </Container>
    );
  }

  return (
    <>
      <Container size={900} py={60}>
        <Stack gap={24}>
          {/* Title - hidden on mobile (shown in header instead) */}
          {!isMobile && (
            <Title order={2} fw={700}>
              {t.referral.title}
            </Title>
          )}

          {/* Hero area - indigo gradient */}
          <Paper withBorder p={0} radius="lg" style={{ overflow: 'hidden' }}>
            <Box
              p="xl"
              style={{
                background:
                  'linear-gradient(135deg, var(--mantine-color-indigo-7), var(--mantine-color-indigo-4))',
                position: 'relative',
              }}
            >
              {/* Floating gift decoration */}
              <Box
                className={styles.floatingGift}
                style={{
                  position: 'absolute',
                  right: 24,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.15,
                  pointerEvents: 'none',
                }}
              >
                <Gift size={80} color="white" />
              </Box>

              <Group gap="sm" align="flex-start" style={{ position: 'relative', zIndex: 1 }}>
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
                <Stack gap={4} style={{ flex: 1 }}>
                  <Title order={3} fw={700} c="white">
                    {t.referral.title}
                  </Title>
                  <Text fz="sm" c="white" style={{ opacity: 0.9 }}>
                    {t.referral.rewardExplanation}
                  </Text>
                </Stack>
              </Group>
            </Box>

            {/* Referral link section */}
            <Stack p="xl" gap="md">
              {referralLink ? (
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
              ) : (
                <Button
                  variant="light"
                  color="indigo"
                  onClick={handleGenerate}
                  loading={generating}
                >
                  {t.referral.generateCode}
                </Button>
              )}

              {/* Reward info */}
              <Group gap="lg">
                <Text fz="sm" fw={500}>
                  {t.referral.youGet.replace('{days}', String(config?.user_reward_days ?? 7))}
                </Text>
                <Text fz="sm" fw={500}>
                  {t.referral.friendGets.replace(
                    '{percent}',
                    String(config?.referee_discount_percent ?? 10),
                  )}
                </Text>
              </Group>
            </Stack>
          </Paper>

          {/* Stats cards - 3 columns */}
          {stats && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Paper withBorder p="md" radius="md">
                <Group gap="md" wrap="nowrap">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--mantine-color-blue-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Users size={20} color="var(--mantine-color-blue-6)" />
                  </Box>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t.referral.totalInvited}
                    </Text>
                    <Text size="xl" fw={700}>
                      {stats.totalReferrals}
                    </Text>
                  </Stack>
                </Group>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Group gap="md" wrap="nowrap">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--mantine-color-green-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CreditCard size={20} color="var(--mantine-color-green-6)" />
                  </Box>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t.referral.totalPaid}
                    </Text>
                    <Text size="xl" fw={700}>
                      {stats.paidReferrals}
                    </Text>
                  </Stack>
                </Group>
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Group gap="md" wrap="nowrap">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--mantine-color-indigo-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Gift size={20} color="var(--mantine-color-indigo-6)" />
                  </Box>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {t.referral.earned}
                    </Text>
                    <Text size="xl" fw={700}>
                      {t.referral.daysEarned.replace('{days}', String(stats.totalRewardDays))}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            </SimpleGrid>
          )}

          {/* Referral history */}
          <Paper withBorder p="xl" radius="lg">
            <Stack gap="md">
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
          </Paper>

          {/* CTA: Become campus agent */}
          <Paper
            withBorder
            p="xl"
            radius="lg"
            style={{ background: 'var(--mantine-color-indigo-0)' }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="md">
              <Stack gap={4} style={{ maxWidth: 400 }}>
                <Text fw={600} fz="lg">
                  {t.referral.becomeAgent}
                </Text>
                <Text fz="sm" c="dimmed">
                  {t.referral.rewardExplanation}
                </Text>
              </Stack>
              <Button color="indigo" onClick={() => setAgentModalOpen(true)}>
                {t.referral.becomeAgent}
              </Button>
            </Group>
          </Paper>
        </Stack>
      </Container>

      <AgentApplicationModal opened={agentModalOpen} onClose={() => setAgentModalOpen(false)} />
    </>
  );
}
