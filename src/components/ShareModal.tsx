import React, { useState } from 'react';
import { Modal, Stack, Text, Switch, TextInput, Group, Box, CopyButton, ActionIcon, Tooltip } from '@mantine/core';
import { Copy, Check, Globe } from 'lucide-react';
import { ChatSession } from '../types/index';
import { toggleSessionShare } from '@/app/actions/chat';

interface ShareModalProps {
    opened: boolean;
    onClose: () => void;
    session: ChatSession | null;
    onUpdateSession: (id: string, isShared: boolean) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ opened, onClose, session, onUpdateSession }) => {
    const [loading, setLoading] = useState(false);

    if (!session) return null;

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/${session.id}` : '';

    const handleToggleShare = async (checked: boolean) => {
        setLoading(true);
        try {
            // Optimistic update
            onUpdateSession(session.id, checked);
            await toggleSessionShare(session.id, checked);
        } catch (error) {
            console.error('Failed to toggle share', error);
            // Revert on error? For now assume success or user sees visual feedback of failure if we had toast
            onUpdateSession(session.id, !checked); 
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal 
            opened={opened} 
            onClose={onClose} 
            title="Share Chat" 
            centered
            size="md"
        >
            <Stack gap="lg">
                <Group justify="space-between" align="start">
                    <Box style={{ flex: 1 }}>
                        <Group gap="xs" mb={4}>
                            <Globe size={18} className="text-indigo-600" />
                            <Text fw={600}>Share to Web</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                            Publish this chat session to a public URL. Anyone with the link can view the conversation.
                        </Text>
                        <Text size="xs" c="orange.7" mt={4} fw={500}>
                            Links automatically expire after 1 hour.
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
                        <Text size="xs" fw={700} mb={4} ml={2} c="dimmed" tt="uppercase">Public Link</Text>
                        <Group gap="xs">
                            <TextInput 
                                value={shareUrl}
                                readOnly
                                style={{ flex: 1 }}
                                rightSection={
                                    <CopyButton value={shareUrl} timeout={2000}>
                                        {({ copied, copy }) => (
                                            <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
                                                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
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
