import { Check, Copy, Globe } from 'lucide-react';
import React, { useState } from 'react';
import {
  ActionIcon,
  Box,
  CopyButton,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { toggleSessionShare } from '@/app/actions/chat';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChatSession } from '../types/index';

interface ShareModalProps {
  opened: boolean;
  onClose: () => void;
  session: ChatSession | null;
  onUpdateSession: (id: string, isShared: boolean) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ opened, onClose, session, onUpdateSession }) => {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  if (!session) return null;

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/share/${session.id}` : '';

  const handleToggleShare = async (checked: boolean) => {
    setLoading(true);
    try {
      // Optimistic update
      onUpdateSession(session.id, checked);
      await toggleSessionShare(session.id, checked);
    } catch (error) {
      console.error('Failed to toggle share', error);
      onUpdateSession(session.id, !checked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t.modals.shareChat} centered size="md">
      <Stack gap="lg">
        <Group justify="space-between" align="start">
          <Box style={{ flex: 1 }}>
            <Group gap="xs" mb={4}>
              <Globe size={18} className="text-indigo-600" />
              <Text fw={600}>{t.modals.shareToWeb}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t.modals.shareDesc}
            </Text>
            <Text size="xs" c="orange.7" mt={4} fw={500}>
              {t.modals.shareExpiry}
            </Text>
          </Box>
          <Switch
            size="md"
            color="indigo"
            checked={session.isShared || false}
            onChange={(event) => handleToggleShare(event.currentTarget.checked)}
            disabled={loading}
          />
        </Group>

        {session.isShared && (
          <Box>
            <Text size="xs" fw={700} mb={4} ml={2} c="dimmed" tt="uppercase">
              {t.modals.publicLink}
            </Text>
            <Group gap="xs">
              <TextInput
                value={shareUrl}
                readOnly
                style={{ flex: 1 }}
                rightSection={
                  <CopyButton value={shareUrl} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip
                        label={copied ? t.modals.copied : t.modals.copy}
                        withArrow
                        position="right"
                      >
                        <ActionIcon
                          color={copied ? 'teal' : 'gray'}
                          variant="subtle"
                          onClick={copy}
                        >
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                }
              />
            </Group>
          </Box>
        )}
      </Stack>
    </Modal>
  );
};

export default ShareModal;
