'use client';

import { useEffect, useState } from 'react';
import { Container, Title, Text, Card, Button, Stack, Group, Badge, ThemeIcon, Skeleton, Paper, Divider, Box } from '@mantine/core';
import { Check, Crown, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { notifications } from '@mantine/notifications';
import { TextInput } from '@mantine/core';

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(data);
        if (data?.full_name) {
            setFullName(data.full_name);
        }
      }
      setLoading(false);
    }
    getProfile();
  }, [supabase]);

  const handleUpgrade = async () => {
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
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', profile.id);

        if (error) throw error;
        
        // Refresh local state
        setProfile({ ...profile, full_name: fullName });

        notifications.show({
            title: 'Saved',
            message: 'Profile updated successfully',
            color: 'green',
        });
    } catch (e: any) {
        notifications.show({
            title: 'Error',
            message: e.message,
            color: 'red',
        });
    } finally {
        setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Stack>
          <Skeleton h={40} w={200} />
          <Skeleton h={200} radius="md" />
        </Stack>
      </Container>
    );
  }

  const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
            <Title order={1} fz={32} fw={800} mb="xs">Settings</Title>
            <Text c="dimmed" fz="lg">Manage your account and subscription preferences</Text>
        </Box>

        {/* Profile Section */}
        <Paper withBorder p="xl" radius="lg">
            <Stack gap="md">
                <Title order={3} fw={700}>Profile Information</Title>
                <Group align="flex-end">
                    <TextInput 
                        label="Display Name" 
                        description="This name will be displayed in the sidebar and chat."
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <Button 
                        onClick={handleSaveProfile} 
                        loading={saving}
                        variant="filled"
                        color="dark"
                    >
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

        <Paper withBorder p={0} radius="lg" style={{ overflow: 'hidden', border: '1px solid var(--mantine-color-gray-2)' }}>
            <Box p="xl">
                <Group justify="space-between" mb="xs">
                    <Stack gap={4}>
                        <Title order={3} fw={700}>Plan & Billing</Title>
                        <Text size="sm" c="dimmed">Detailed overview of your current subscription</Text>
                    </Stack>
                    {isPro ? (
                        <Badge size="xl" variant="filled" color="violet" leftSection={<Crown size={14} />} h={32}>
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
                                <Text fw={700} fz="xl" mb={4}>Subscription Active</Text>
                                <Text size="sm" c="dimmed" lh={1.6}>
                                    Your Plus subscription is currently active. You have full access to all premium features including unlimited document uploads and priority AI processing.
                                </Text>
                                <Text size="sm" fw={600} mt="md" c="dark.3">
                                    Next invoice: {profile?.current_period_end ? new Date(profile.current_period_end).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                                </Text>
                            </Box>
                        </Group>
                        <Button variant="default" radius="md" size="md" w="fit-content" leftSection={<CreditCard size={18} />}>
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
                                    <Text size="sm" c="dimmed">You are currently on the free plan.</Text>
                                </Box>
                            </Group>
                            <Text size="sm" c="dimmed">
                                Upgrade to Pro to unlock unlimited uploads, advanced RAG features, and priority support.
                            </Text>
                            <Button 
                                variant="light" 
                                color="violet" 
                                radius="md" 
                                onClick={() => window.location.href = '/pricing'}
                            >
                                View Upgrade Options
                            </Button>
                        </Stack>
                    </Paper>
                )}
            </Box>
        </Paper>

        <Box>
            <Title order={3} mb="md">Data & Privacy</Title>
            <Paper withBorder p="xl" radius="lg">
                 <Group justify="space-between">
                    <Box>
                        <Text fw={600} c="red.7">Delete Account</Text>
                        <Text size="sm" c="dimmed">Permanently delete your account and all data.</Text>
                    </Box>
                    <Button color="red" variant="subtle">Delete Account</Button>
                </Group>
            </Paper>
        </Box>
      </Stack>
    </Container>
  );
}
