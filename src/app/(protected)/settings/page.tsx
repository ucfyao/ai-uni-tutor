'use client';

import { CreditCard, Crown, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import type { AccessLimits } from '@/lib/services/QuotaService';

export default function SettingsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const { t } = useLanguage();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [limits, setLimits] = useState<AccessLimits | null>(null);
  const [usage, setUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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

  if (loading || profileLoading) {
    return (
      <Container size={700} py={60}>
        <Stack gap={40}>
          <Box>
            <Skeleton h={28} w={200} mb="xs" />
            <Skeleton h={16} w={350} />
          </Box>
          <Skeleton h={180} radius="lg" />
          <Skeleton h={280} radius="lg" />
          <Skeleton h={200} radius="lg" />
          <Skeleton h={80} radius="lg" />
        </Stack>
      </Container>
    );
  }

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return (
    <PageShell title={t.settings.title} subtitle={t.settings.subtitle}>
      {/* Preferences */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.settings.preferences}
          </Title>

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
              defaultValue="en"
              data={[
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
            />
          </Group>

          <Divider />

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

      {/* Plan & Billing */}
      <Paper
        withBorder
        p={0}
        radius="lg"
        style={{ overflow: 'hidden', border: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Box p="xl">
          <Group justify="space-between" mb="xs">
            <Stack gap={4}>
              <Title order={3} fw={700}>
                {t.settings.planBilling}
              </Title>
              <Text size="sm" c="dimmed">
                {t.settings.planBillingDesc}
              </Text>
            </Stack>
            {isPro ? (
              <Badge
                size="xl"
                variant="filled"
                color="violet"
                leftSection={<Crown size={14} />}
                h={32}
              >
                {t.settings.plusMember}
              </Badge>
            ) : (
              <Badge size="xl" variant="light" color="gray" h={32}>
                {t.settings.freeTier}
              </Badge>
            )}
          </Group>
        </Box>

        <Divider color="gray.1" />

        <Box p="xl">
          {isPro ? (
            <Stack gap="xl">
              <Group align="flex-start" gap="xl">
                <ThemeIcon color="green.1" c="green.7" variant="filled" size={54} radius="md">
                  <ShieldCheck size={32} />
                </ThemeIcon>
                <Box style={{ flex: 1 }}>
                  <Text fw={700} fz="xl" mb={4}>
                    {t.settings.subscriptionActive}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {t.settings.subscriptionActiveDesc}
                  </Text>
                  <Text size="sm" fw={600} mt="md" c="dark.3">
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
              >
                {t.settings.manageViaStripe}
              </Button>
            </Stack>
          ) : (
            <Paper withBorder p="xl" radius="md" bg="gray.0">
              <Stack gap="md">
                <Group>
                  <ThemeIcon size="lg" radius="md" variant="white" color="gray">
                    <CreditCard size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={600}>{t.settings.freeTierLabel}</Text>
                    <Text size="sm" c="dimmed">
                      {t.settings.freeTierDesc}
                    </Text>
                  </Box>
                </Group>
                <Text size="sm" c="dimmed">
                  {t.settings.freeTierUpgrade}
                </Text>
                <Button
                  variant="light"
                  color="violet"
                  radius="md"
                  onClick={() => router.push('/pricing')}
                >
                  {t.settings.viewUpgradeOptions}
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      </Paper>

      {/* Usage & Limits */}
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.settings.usageLimits}
          </Title>
          <Text size="sm" c="dimmed">
            {t.settings.usageLimitsDesc}
          </Text>

          <Stack>
            <Group justify="space-between" mb={5}>
              <Text fw={500}>{t.settings.dailyLLMUsage}</Text>
              <Text
                size="sm"
                c={
                  usage >= (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)
                    ? 'red'
                    : 'dimmed'
                }
              >
                {usage} / {isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3}
              </Text>
            </Group>
            <Progress
              value={
                (usage / (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)) * 100
              }
              color={
                usage >= (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3)
                  ? 'red'
                  : usage >=
                      (isPro ? limits?.dailyLimitPro || 30 : limits?.dailyLimitFree || 3) * 0.7
                    ? 'yellow'
                    : 'indigo'
              }
              size="md"
              radius="xl"
              mb="sm"
              animated
            />

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
        </Stack>
      </Paper>
    </PageShell>
  );
}
