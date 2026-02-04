'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';

interface UsageLimitModalProps {
  opened: boolean;
  onClose: () => void;
  message?: string;
}

export function UsageLimitModal({ opened, onClose, message }: UsageLimitModalProps) {
  const router = useRouter();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Daily Limit Reached"
      centered
      size="md"
      padding="xl"
      radius="md"
    >
      <Stack align="center" gap="md">
        <ThemeIcon size={80} radius="100%" variant="light" color="orange">
          <Sparkles size={40} />
        </ThemeIcon>
        <Stack gap="xs" align="center">
          <Text fw={600} size="lg" ta="center">
            You&apos;ve reached your daily limit
          </Text>
          <Text ta="center" c="dimmed" size="sm" maw={400}>
            {message ||
              'Upgrade to Pro to get more messages, unlimited knowledge cards, and advanced features.'}
          </Text>
        </Stack>
        <Group w="100%" grow mt="sm">
          <Button variant="default" onClick={onClose} radius="md">
            Not now
          </Button>
          <Button
            onClick={() => {
              onClose();
              router.push('/pricing');
            }}
            color="black"
            radius="md"
            leftSection={<Sparkles size={16} />}
          >
            Upgrade Plan
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
