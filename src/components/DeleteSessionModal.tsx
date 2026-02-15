import React from 'react';
import { Button, Group, Text } from '@mantine/core';
import { FullScreenModal } from '@/components/FullScreenModal';
import { useLanguage } from '@/i18n/LanguageContext';

interface DeleteSessionModalProps {
  opened: boolean;
  onClose: () => void;
  sessionId: string | null;
  onDelete: (id: string) => void;
}

const DeleteSessionModal: React.FC<DeleteSessionModalProps> = ({
  opened,
  onClose,
  sessionId,
  onDelete,
}) => {
  const { t } = useLanguage();

  return (
    <FullScreenModal opened={opened} onClose={onClose} title={t.modals.deleteChat} centered size="sm">
      <Text size="sm" mb="lg">
        {t.modals.deleteConfirm}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {t.modals.cancel}
        </Button>
        <Button
          color="red"
          onClick={() => {
            if (sessionId) {
              onDelete(sessionId);
              onClose();
            }
          }}
        >
          {t.modals.delete}
        </Button>
      </Group>
    </FullScreenModal>
  );
};

export default DeleteSessionModal;
