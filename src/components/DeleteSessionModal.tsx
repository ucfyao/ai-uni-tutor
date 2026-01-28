import React from 'react';
import { Modal, Text, Group, Button } from '@mantine/core';

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
    onDelete 
}) => {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Delete Chat?"
            centered
            size="sm"
        >
            <Text size="sm" mb="lg">
                This will permanently delete the chat session. This action cannot be undone.
            </Text>
            <Group justify="flex-end">
                <Button variant="default" onClick={onClose}>Cancel</Button>
                <Button 
                    color="red" 
                    onClick={() => {
                        if (sessionId) {
                            onDelete(sessionId);
                            onClose();
                        }
                    }}
                >
                    Delete
                </Button>
            </Group>
        </Modal>
    );
};

export default DeleteSessionModal;
