'use client';

import { ArrowUp, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Box, Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

interface UsageLimitModalProps {
  opened: boolean;
  onClose: () => void;
  message?: string;
}

export function UsageLimitModal({ opened, onClose }: UsageLimitModalProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Sparkles size={20} className="text-indigo-600" />
          <Text fw={700} c="indigo.7" size="lg">
            {t.modals.unlockUnlimited}
          </Text>
        </Group>
      }
      centered
      radius="lg"
      padding="xl"
      zIndex={1001}
    >
      <Stack align="center" ta="center" gap="lg">
        <Box p="md" bg="indigo.0" style={{ borderRadius: '50%' }}>
          <ThemeIcon
            size={48}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo.3', to: 'indigo.7' }}
          >
            <Sparkles size={26} />
          </ThemeIcon>
        </Box>

        <Box>
          <Text size="xl" fw={800} mb="xs">
            {t.modals.dailyLimitReached}
          </Text>
          <Text c="dimmed" lh={1.5}>
            {t.modals.dailyLimitDesc}
          </Text>
        </Box>

        <Group w="100%" justify="center">
          <Button variant="default" onClick={onClose} radius="md">
            {t.modals.maybeLater}
          </Button>
          <Button
            variant="gradient"
            gradient={{ from: 'indigo.3', to: 'indigo.7' }}
            radius="md"
            onClick={() => {
              onClose();
              router.push('/pricing');
            }}
            rightSection={<ArrowUp size={16} className="rotate-45" />}
          >
            {t.modals.upgradeNow}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
