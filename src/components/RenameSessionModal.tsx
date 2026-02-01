import React, { useEffect, useState } from 'react';
import { Button, Group, Modal, TextInput } from '@mantine/core';

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

  useEffect(() => {
    setEditTitle(currentTitle);
  }, [currentTitle, opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Rename Session" centered size="sm">
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
          placeholder="Enter session name"
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color="indigo">
            Save
          </Button>
        </Group>
      </form>
    </Modal>
  );
};

export default RenameSessionModal;
