'use client';

import { Handshake } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
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

  return (
    <PageShell title={t.personalization.title} subtitle={t.personalization.subtitle}>
      {/* Profile Information */}
      <Paper withBorder p="xl" radius="lg">
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
          />
        </Stack>
      </Paper>

      {/* Partner Program — Coming Soon */}
      <Paper withBorder p="xl" radius="lg">
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
    </PageShell>
  );
}
