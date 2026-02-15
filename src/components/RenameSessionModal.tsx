import React, { useEffect, useState } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import { FullScreenModal } from '@/components/FullScreenModal';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { useLanguage } from '@/i18n/LanguageContext';

interface RenameSessionModalProps {
  opened: boolean;
  onClose: () => void;
  sessionId: string | null;
  currentTitle: string;
  onRename: (id: string, newTitle: string) => void;
}

const RenameSessionModal: React.FC<RenameSessionModalProps> = ({
  opened,
  onClose,
  sessionId,
  currentTitle,
  onRename,
}) => {
  const [editTitle, setEditTitle] = useState(currentTitle);
  const { t } = useLanguage();

  useEffect(() => {
    setEditTitle(currentTitle);
  }, [currentTitle, opened]);

  return (
    <FullScreenModal opened={opened} onClose={onClose} title={t.modals.renameSession} centered size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (sessionId) {
            onRename(sessionId, editTitle);
            onClose();
          }
        }}
      >
        <TextInput
          value={editTitle}
          onChange={(e) => setEditTitle(e.currentTarget.value)}
          data-autofocus
          placeholder={PLACEHOLDERS.SESSION_NAME}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t.modals.cancel}
          </Button>
          <Button type="submit" color="indigo">
            {t.modals.save}
          </Button>
        </Group>
      </form>
    </FullScreenModal>
  );
};

export default RenameSessionModal;
