'use client';

import { Bell, Globe, Moon, Sun, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { FULL_NAME_MAX_LENGTH } from '@/constants/profile';
import { useProfile } from '@/context/ProfileContext';
import { showNotification } from '@/lib/notifications';

export default function PersonalizationPage() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [opened, { open, close }] = useDisclosure(false);
  const { profile, loading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      showNotification({
        title: 'Success',
        message: 'Profile updated successfully',
        color: 'green',
      });
      close();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      showNotification({
        title: 'Error',
        message,
        color: 'red',
      });
    }
    setSaving(false);
  };

  return (
    <>
      <Modal opened={opened} onClose={close} title="Edit Profile" centered>
        <Stack>
          <TextInput
            label="Full Name"
            placeholder={PLACEHOLDERS.ENTER_NAME}
            description={`Max ${FULL_NAME_MAX_LENGTH} characters`}
            value={fullName}
            onChange={(event) => setFullName(event.currentTarget.value)}
            maxLength={FULL_NAME_MAX_LENGTH}
          />
          {/* Future: Avatar Upload */}
          <Button onClick={handleSaveProfile} loading={saving} color="violet" fullWidth>
            Save Changes
          </Button>
        </Stack>
      </Modal>
      <Container size={700} py={60}>
        <Stack gap={40}>
          <Box>
            <Title order={1} fz={32} fw={800} mb="xs">
              Personalization
            </Title>
            <Text c="dimmed" fz="lg">
              Customize your AI Tutor experience
            </Text>
          </Box>

          <Paper withBorder p="xl" radius="lg">
            <Stack gap="lg">
              <Group justify="space-between">
                <Group gap="md">
                  <Avatar color="violet" radius="md">
                    <User size={20} />
                  </Avatar>
                  <Box>
                    <Text fw={600}>Profile Information</Text>
                    <Text size="sm" c="dimmed">
                      {loading
                        ? 'Loading...'
                        : profile?.full_name || profile?.email || 'Update your personal details'}
                    </Text>
                  </Box>
                </Group>
                <Button variant="light" color="violet" onClick={open} loading={loading}>
                  Edit Profile
                </Button>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Group gap="md">
                  <Avatar color="blue" radius="md">
                    <Globe size={20} />
                  </Avatar>
                  <Box>
                    <Text fw={600}>Language</Text>
                    <Text size="sm" c="dimmed">
                      Preferred language for AI responses
                    </Text>
                  </Box>
                </Group>
                <Select
                  w={140}
                  defaultValue="en"
                  data={[
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Spanish' },
                    { value: 'fr', label: 'French' },
                    { value: 'zh', label: 'Chinese' },
                  ]}
                />
              </Group>

              <Divider />

              <Group justify="space-between">
                <Group gap="md">
                  <Avatar color="dark" radius="md">
                    {computedColorScheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                  </Avatar>
                  <Box>
                    <Text fw={600}>Theme</Text>
                    <Text size="sm" c="dimmed">
                      Toggle dark mode
                    </Text>
                  </Box>
                </Group>
                <Switch
                  size="md"
                  onLabel="ON"
                  offLabel="OFF"
                  checked={computedColorScheme === 'dark'}
                  onChange={() =>
                    setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')
                  }
                />
              </Group>

              <Divider />

              <Group justify="space-between">
                <Group gap="md">
                  <Avatar color="orange" radius="md">
                    <Bell size={20} />
                  </Avatar>
                  <Box>
                    <Text fw={600}>Notifications</Text>
                    <Text size="sm" c="dimmed">
                      Receive email updates
                    </Text>
                  </Box>
                </Group>
                <Switch defaultChecked size="md" color="violet" />
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </>
  );
}
