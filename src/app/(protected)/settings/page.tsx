'use client';

import { BarChart3, CreditCard, Crown, Settings2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Progress,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Language } from '@/i18n/translations';
import { showNotification } from '@/lib/notifications';
import type { AccessLimits } from '@/lib/services/QuotaService';

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const { t, language, setLanguage } = useLanguage();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [limits, setLimits] = useState<AccessLimits | null>(null);
  const [usage, setUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch('/api/quota');
        if (!res.ok) throw new Error('Failed to fetch quota information');
        const data: { status: { usage: number }; limits: AccessLimits } = await res.json();
        setLimits(data.limits);
        setUsage(data.status.usage);
      } catch (e) {
        console.error('Failed to fetch access limits', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLimits();
  }, []);

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create portal session');
      const data: { url: string } = await res.json();
      window.location.href = data.url;
    } catch (e) {
      console.error('Failed to open Stripe portal', e);
      showNotification({
        title: t.common.error,
        message: e instanceof Error ? e.message : 'Failed to open billing portal',
        color: 'red',
      });
      setPortalLoading(false);
    }
  }, [t.common.error]);

  if (loading || profileLoading) {
    return (
      <Container size={700} py={60}>
        <Stack gap={40}>
          <Box>
            <Skeleton h={28} w={200} mb="xs" />
            <Skeleton h={16} w={350} />
          </Box>
          <Skeleton h={200} radius="lg" />
          <Skeleton h={220} radius="lg" />
          <Skeleton h={200} radius="lg" />
        </Stack>
      </Container>
    );
  }

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
  const dailyLimit = isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3;
  const usagePercent = (usage / dailyLimit) * 100;
  const progressColor = usagePercent >= 100 ? 'red' : usagePercent >= 70 ? 'yellow' : 'indigo';

  return (
    <PageShell title={t.settings.title} subtitle={t.settings.subtitle}>
      {/* ── Preferences ── */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" size="lg" radius="md">
              <Settings2 size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} fw={700}>
                {t.settings.preferences}
              </Title>
              <Text size="xs" c="dimmed">
                {t.settings.subtitle}
              </Text>
            </Box>
          </Group>

          <Divider />

          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.theme}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.themeDesc}
              </Text>
            </Box>
            <Switch
              size="md"
              checked={computedColorScheme === 'dark'}
              onChange={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
            />
          </Group>

          <Divider />

          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.language}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.languageDesc}
              </Text>
            </Box>
            <Select
              w={140}
              value={language}
              onChange={(val) => {
                if (val === 'en' || val === 'zh') setLanguage(val as Language);
              }}
              data={[
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
            />
          </Group>

          <Divider />

          {/* TODO: Wire notification preferences to backend when email service is integrated */}
          <Group justify="space-between">
            <Box>
              <Text fw={500}>{t.settings.notifications}</Text>
              <Text size="sm" c="dimmed">
                {t.settings.notificationsDesc}
              </Text>
            </Box>
            <Switch defaultChecked size="md" />
          </Group>
        </Stack>
      </Paper>

      {/* ── Plan & Billing ── */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon variant="light" color="violet" size="lg" radius="md">
                <CreditCard size={20} />
              </ThemeIcon>
              <Box>
                <Title order={4} fw={700}>
                  {t.settings.planBilling}
                </Title>
                <Text size="xs" c="dimmed">
                  {t.settings.planBillingDesc}
                </Text>
              </Box>
            </Group>
            {isPro ? (
              <Badge size="lg" variant="filled" color="violet" leftSection={<Crown size={14} />}>
                {t.settings.plusMember}
              </Badge>
            ) : (
              <Badge size="lg" variant="light" color="gray">
                {t.settings.freeTier}
              </Badge>
            )}
          </Group>

          <Divider />

          {isPro ? (
            <Stack gap="md">
              <Group gap="md">
                <ThemeIcon color="green.1" c="green.7" variant="filled" size={48} radius="md">
                  <ShieldCheck size={28} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text fw={700} fz="lg">
                    {t.settings.subscriptionActive}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t.settings.subscriptionActiveDesc}
                  </Text>
                  <Text size="sm" fw={600} mt="xs" c="dimmed">
                    {t.settings.nextInvoice}{' '}
                    {profile?.current_period_end
                      ? new Date(profile.current_period_end).toLocaleDateString(undefined, {
                          dateStyle: 'long',
                        })
                      : 'N/A'}
                  </Text>
                </Box>
              </Group>
              <Button
                variant="default"
                radius="md"
                size="md"
                w="fit-content"
                leftSection={<CreditCard size={18} />}
                onClick={handleManageSubscription}
                loading={portalLoading}
              >
                {t.settings.manageViaStripe}
              </Button>
            </Stack>
          ) : (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t.settings.freeTierDesc} {t.settings.freeTierUpgrade}
              </Text>
              <Button
                variant="light"
                color="violet"
                radius="md"
                w="fit-content"
                onClick={() => router.push('/pricing')}
              >
                {t.settings.viewUpgradeOptions}
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* ── Usage & Limits ── */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="blue" size="lg" radius="md">
              <BarChart3 size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} fw={700}>
                {t.settings.usageLimits}
              </Title>
              <Text size="xs" c="dimmed">
                {t.settings.usageLimitsDesc}
              </Text>
            </Box>
          </Group>

          <Divider />

          <Box>
            <Group justify="space-between" mb={6}>
              <Text fw={500}>{t.settings.dailyLLMUsage}</Text>
              <Text size="sm" c={usagePercent >= 100 ? 'red' : 'dimmed'}>
                {usage} / {dailyLimit}
              </Text>
            </Group>
            <Progress
              value={Math.min(usagePercent, 100)}
              color={progressColor}
              size="md"
              radius="xl"
              animated
            />
          </Box>

          <Divider />

          <Group justify="space-between">
            <Text fw={500}>{t.settings.fileUploadSize}</Text>
            <Badge variant="light" color="blue">
              {limits?.maxFileSizeMB || 5}MB {t.settings.perFile}
            </Badge>
          </Group>

          <Divider />

          <Group justify="space-between">
            <Text fw={500}>{t.settings.documentStorage}</Text>
            <Badge variant="light" color={isPro ? 'green' : 'gray'}>
              {isPro ? t.settings.unlimited : t.settings.limited}
            </Badge>
          </Group>
        </Stack>
      </Paper>
    </PageShell>
  );
}
