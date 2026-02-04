'use client';

import { CreditCard, Crown, ShieldCheck } from 'lucide-react';
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
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useProfile } from '@/context/ProfileContext';
import { showNotification } from '@/lib/notifications';
import type { AccessLimits } from '@/lib/services/QuotaService';

export default function SettingsPage() {
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const [limits, setLimits] = useState<AccessLimits | null>(null);
  const [usage, setUsage] = useState<number>(0);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize fullName from profile context
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch('/api/quota');
        if (!res.ok) {
          throw new Error('Failed to fetch quota information');
        }
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

  /* const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    } finally {
      setUpgrading(false);
    }
  }; */

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Update via Context (which handles DB update and state sync)
      await updateProfile({ full_name: fullName });

      showNotification({
        title: 'Saved',
        message: 'Profile updated successfully',
        color: 'green',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showNotification({
        title: 'Error',
        message,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <Container size="md" py="xl">
        <Stack>
          <Skeleton h={40} w={200} />
          <Skeleton h={200} radius="md" />
        </Stack>
      </Container>
    );
  }

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Title order={1} fz={32} fw={800} mb="xs">
            Settings
          </Title>
          <Text c="dimmed" fz="lg">
            Manage your account and subscription preferences
          </Text>
        </Box>

        {/* Profile Section */}
        <Paper withBorder p="xl" radius="lg">
          <Stack gap="md">
            <Title order={3} fw={700}>
              Profile Information
            </Title>
            <Group align="flex-end">
              <TextInput
                label="Display Name"
                description="This name will be displayed in the sidebar and chat."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={handleSaveProfile} loading={saving} variant="filled" color="dark">
                Save Changes
              </Button>
            </Group>

            <TextInput
              label="Email Address"
              value={profile?.email || ''}
              disabled
              description="Your email address cannot be changed."
            />
          </Stack>
        </Paper>

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
                  Plan & Billing
                </Title>
                <Text size="sm" c="dimmed">
                  Detailed overview of your current subscription
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
                  Plus Member
                </Badge>
              ) : (
                <Badge size="xl" variant="light" color="gray" h={32}>
                  Free Tier
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
                      Subscription Active
                    </Text>
                    <Text size="sm" c="dimmed" lh={1.6}>
                      Your Plus subscription is currently active. You have full access to all
                      premium features including unlimited document uploads and priority AI
                      processing.
                    </Text>
                    <Text size="sm" fw={600} mt="md" c="dark.3">
                      Next invoice:{' '}
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
                  Manage via Stripe
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
                      <Text fw={600}>Free Tier</Text>
                      <Text size="sm" c="dimmed">
                        You are currently on the free plan.
                      </Text>
                    </Box>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Upgrade to Pro to unlock unlimited uploads, advanced RAG features, and priority
                    support.
                  </Text>
                  <Button
                    variant="light"
                    color="violet"
                    radius="md"
                    onClick={() => (window.location.href = '/pricing')}
                  >
                    View Upgrade Options
                  </Button>
                </Stack>
              </Paper>
            )}
          </Box>
        </Paper>

        <Paper withBorder p="xl" radius="lg">
          <Stack gap="md">
            <Title order={3} fw={700}>
              Usage & Limits
            </Title>
            <Text size="sm" c="dimmed">
              Current usage for your {isPro ? 'Plus' : 'Free'} plan.
            </Text>

            <Stack>
              <Group justify="space-between" mb={5}>
                <Text fw={500}>Daily LLM Usage</Text>
                <Text
                  size="sm"
                  c={
                    usage >= (isPro ? limits?.dailyLimitPro || 100 : limits?.dailyLimitFree || 10)
                      ? 'red'
                      : 'dimmed'
                  }
                >
                  {usage} / {isPro ? limits?.dailyLimitPro || 100 : limits?.dailyLimitFree || 10}
                </Text>
              </Group>
              <Progress
                value={
                  (usage / (isPro ? limits?.dailyLimitPro || 100 : limits?.dailyLimitFree || 10)) *
                  100
                }
                color={
                  usage >= (isPro ? limits?.dailyLimitPro || 100 : limits?.dailyLimitFree || 10)
                    ? 'red'
                    : usage >=
                        (isPro ? limits?.dailyLimitPro || 100 : limits?.dailyLimitFree || 10) * 0.7
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
                <Text fw={500}>File Upload Size</Text>
                <Badge variant="light" color="blue">
                  {limits?.maxFileSizeMB || 5}MB per file
                </Badge>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text fw={500}>Document Storage</Text>
                <Badge variant="light" color={isPro ? 'green' : 'gray'}>
                  {isPro ? 'Unlimited' : 'Limited (Shared)'}
                </Badge>
              </Group>
            </Stack>
          </Stack>
        </Paper>

        <Box>
          <Title order={3} fw={700} mb="md">
            Data & Privacy
          </Title>
          <Paper
            withBorder
            p="xl"
            radius="lg"
            bg="red.0"
            style={{ borderColor: 'var(--mantine-color-red-2)' }}
          >
            <Group justify="space-between">
              <Box>
                <Text fw={600} c="red.7">
                  Delete Account
                </Text>
                <Text size="sm" c="red.6">
                  Permanently delete your account and all data.
                </Text>
              </Box>
              <Button color="red" variant="light">
                Delete Account
              </Button>
            </Group>
          </Paper>
        </Box>
      </Stack>
    </Container>
  );
}
