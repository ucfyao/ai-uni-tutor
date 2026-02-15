'use client';

import { Camera, Check, Crown, Gift, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { FullScreenModal } from '@/components/FullScreenModal';
import { FULL_NAME_MAX_LENGTH } from '@/constants/profile';
import { useHeader } from '@/context/HeaderContext';
import { useProfile } from '@/context/ProfileContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

export default function PersonalizationPage() {
  const { profile, loading, updateProfile } = useProfile();
  const { t } = useLanguage();
  const { setHeaderContent } = useHeader();
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const [fullName, setFullName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" truncate>
        {t.personalization.title}
      </Text>
    ),
    [t.personalization.title],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      setEditing(false);
      setSaved(true);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
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

  const showSkeleton = loading && !profile;
  const nameUnchanged = fullName.trim() === (profile?.full_name ?? '');

  return (
    <Container size={700} py={60}>
      <Stack gap={24}>
        {/* Profile */}
        <Paper withBorder p="xl" radius="lg">
          <Stack gap="md">
            <Title order={3} fw={700}>
              {t.personalization.profileInfo}
            </Title>

            {/* Avatar placeholder */}
            <Group justify="center">
              <Box
                w={80}
                h={80}
                style={{
                  borderRadius: '50%',
                  border: '2px dashed var(--mantine-color-gray-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Camera size={24} color="var(--mantine-color-gray-5)" />
              </Box>
            </Group>

            <Divider />

            {/* Display name */}
            {showSkeleton ? (
              <Group justify="space-between">
                <Skeleton h={16} w={80} />
                <Skeleton h={16} w={120} />
              </Group>
            ) : editing ? (
              <Group>
                <TextInput
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={FULL_NAME_MAX_LENGTH}
                  style={{ flex: 1 }}
                  disabled={loading}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setFullName(profile?.full_name ?? '');
                      setEditing(false);
                    }
                    if (e.key === 'Enter' && !nameUnchanged) {
                      handleSaveProfile();
                    }
                  }}
                />
                <ActionIcon
                  variant="filled"
                  color="green"
                  size="lg"
                  onClick={handleSaveProfile}
                  loading={saving}
                  disabled={nameUnchanged}
                >
                  <Check size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  onClick={() => {
                    setFullName(profile?.full_name ?? '');
                    setEditing(false);
                  }}
                >
                  <X size={16} />
                </ActionIcon>
              </Group>
            ) : (
              <Group justify="space-between">
                <Text fw={500}>{t.personalization.displayName}</Text>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    {profile?.full_name || '—'}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            )}

            <Divider />

            <Group justify="space-between">
              <Text fw={500}>{t.personalization.emailAddress}</Text>
              {showSkeleton ? (
                <Skeleton h={16} w={180} />
              ) : (
                <Text size="sm" c="dimmed">
                  {profile?.email || '—'}
                </Text>
              )}
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text fw={500}>{t.personalization.subscriptionStatus}</Text>
              {showSkeleton ? (
                <Skeleton h={20} w={50} radius="xl" />
              ) : isPro ? (
                <Badge variant="light" color="indigo" size="sm" leftSection={<Crown size={12} />}>
                  Pro
                </Badge>
              ) : (
                <Badge variant="light" color="gray" size="sm">
                  Free
                </Badge>
              )}
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text fw={500}>{t.personalization.memberSince}</Text>
              {showSkeleton ? (
                <Skeleton h={16} w={140} />
              ) : (
                <Text size="sm" c="dimmed">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(undefined, {
                        dateStyle: 'long',
                      })
                    : '—'}
                </Text>
              )}
            </Group>

            <Divider />

            <Group justify="flex-end">
              <Button
                color="red"
                variant="subtle"
                size="compact-sm"
                leftSection={<Trash2 size={14} />}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                {t.personalization.deleteAccount}
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Delete Account Confirmation Modal */}
        <FullScreenModal
          opened={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setDeleteInput('');
          }}
          title={t.personalization.deleteAccountTitle}
        >
          <Stack>
            <Text c="dimmed">{t.personalization.deleteConfirmMessage}</Text>
            <TextInput
              label={t.personalization.typeDelete}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.currentTarget.value)}
              placeholder="DELETE"
            />
            <Button
              color="red"
              disabled={deleteInput !== 'DELETE'}
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteInput('');
                showNotification({
                  message: t.toast.comingSoon,
                  color: 'gray',
                  autoClose: 3000,
                });
              }}
            >
              {t.personalization.confirmDelete}
            </Button>
          </Stack>
        </FullScreenModal>

        {/* Refer & Earn */}
        <Paper
          p="xl"
          radius="lg"
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
              <Group gap="xs" align="center">
                <Title order={3} fw={700} c="white">
                  {t.personalization.partnerProgram}
                </Title>
                <Badge variant="white" color="dark" size="sm">
                  {t.personalization.comingSoon}
                </Badge>
              </Group>
              <Text size="sm" c="rgba(255,255,255,0.8)" mt={4}>
                {t.personalization.partnerDesc}
              </Text>
            </Box>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
