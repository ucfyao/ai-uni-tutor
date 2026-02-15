'use client';

import { Crown, Handshake, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { PageShell } from '@/components/PageShell';
import { FULL_NAME_MAX_LENGTH } from '@/constants/profile';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

export default function PersonalizationPage() {
  const { profile, loading, updateProfile } = useProfile();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      showNotification({
        title: t.settings.profileUpdated,
        message: t.settings.profileUpdatedMsg,
        color: 'green',
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showNotification({
        title: t.common.error,
        message,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return (
    <PageShell title={t.personalization.title} subtitle={t.personalization.subtitle}>
      {/* Account Overview */}
      <Paper withBorder p={32} radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.personalization.accountOverview}
          </Title>
          <SimpleGrid cols={2}>
            <Box>
              <Text size="sm" c="dimmed" mb={4}>
                {t.personalization.displayName}
              </Text>
              <Text fw={600}>{profile?.full_name || '—'}</Text>
            </Box>
            <Box>
              <Text size="sm" c="dimmed" mb={4}>
                {t.personalization.emailAddress}
              </Text>
              <Text fw={600}>{profile?.email || '—'}</Text>
            </Box>
            <Box>
              <Text size="sm" c="dimmed" mb={4}>
                {t.personalization.subscriptionStatus}
              </Text>
              {isPro ? (
                <Badge variant="filled" color="violet" size="lg" leftSection={<Crown size={14} />}>
                  Pro
                </Badge>
              ) : (
                <Badge variant="light" color="gray" size="lg">
                  Free
                </Badge>
              )}
            </Box>
            <Box>
              <Text size="sm" c="dimmed" mb={4}>
                {t.personalization.memberSince}
              </Text>
              <Text fw={600}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString(undefined, {
                      dateStyle: 'long',
                    })
                  : '—'}
              </Text>
            </Box>
          </SimpleGrid>
        </Stack>
      </Paper>

      {/* Profile Information */}
      <Paper withBorder p={32} radius="lg">
        <Stack gap="md">
          <Title order={3} fw={700}>
            {t.personalization.profileInfo}
          </Title>
          <Group align="flex-end">
            <TextInput
              label={t.personalization.displayName}
              description={`${t.personalization.displayNameDesc} (max ${FULL_NAME_MAX_LENGTH})`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={FULL_NAME_MAX_LENGTH}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <Button onClick={handleSaveProfile} loading={saving} variant="filled" color="dark">
              {t.personalization.saveChanges}
            </Button>
          </Group>

          <TextInput
            label={t.personalization.emailAddress}
            value={profile?.email || ''}
            disabled
            description={t.personalization.emailDesc}
            rightSection={<Lock size={16} color="var(--mantine-color-gray-5)" />}
          />
        </Stack>
      </Paper>

      {/* Partner Program — Coming Soon */}
      <Paper withBorder p={32} radius="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <Handshake size={22} color="var(--mantine-color-violet-6)" />
              <Title order={3} fw={700}>
                {t.personalization.partnerProgram}
              </Title>
            </Group>
            <Badge variant="light" color="gray" size="lg">
              {t.personalization.comingSoon}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t.personalization.partnerDesc}
          </Text>
        </Stack>
      </Paper>

      {/* Data & Privacy */}
      <Box>
        <Title order={3} fw={700} mb="md">
          {t.personalization.dataPrivacy}
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
                {t.personalization.deleteAccount}
              </Text>
              <Text size="sm" c="red.6">
                {t.personalization.deleteAccountDesc}
              </Text>
            </Box>
            <Button color="red" variant="light">
              {t.personalization.deleteAccount}
            </Button>
          </Group>
        </Paper>
      </Box>
    </PageShell>
  );
}
