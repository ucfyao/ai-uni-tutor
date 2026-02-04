'use client';

import { ArrowUp, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Box, Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';

interface UsageLimitModalProps {
  opened: boolean;
  onClose: () => void;
  message?: string;
}

export function UsageLimitModal({ opened, onClose }: UsageLimitModalProps) {
  const router = useRouter();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Sparkles size={20} className="text-violet-600" />
          <Text fw={700} c="violet.7" size="lg">
            Unlock Unlimited AI
          </Text>
        </Group>
      }
      centered
      radius="lg"
      padding="xl"
      zIndex={1001}
    >
      <Stack align="center" ta="center" gap="lg">
        <Box p="md" bg="violet.0" style={{ borderRadius: '50%' }}>
          <ThemeIcon
            size={48}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo' }}
          >
            <Sparkles size={26} />
          </ThemeIcon>
        </Box>

        <Box>
          <Text size="xl" fw={800} mb="xs">
            Daily Usage Limit Reached
          </Text>
          <Text c="dimmed" lh={1.5}>
            You&apos;ve hit your daily message limit on the Free tier. Upgrade to{' '}
            <span className="font-semibold text-violet-700">Pro</span> to remove limits and help us
            maintain the service.
          </Text>
        </Box>

        <Group w="100%" justify="center">
          <Button variant="default" onClick={onClose} radius="md">
            Maybe Later
          </Button>
          <Button
            variant="gradient"
            gradient={{ from: 'violet', to: 'indigo' }}
            radius="md"
            onClick={() => {
              onClose();
              router.push('/pricing');
            }}
            rightSection={<ArrowUp size={16} className="rotate-45" />}
          >
            Upgrade Now
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
