import React, { useState } from 'react';
import { Stack, Paper, Text, ScrollArea, Box, Group, Transition, Title, Collapse, TextInput, Button, ThemeIcon, ActionIcon, Loader, Avatar, Modal } from '@mantine/core';
import { KnowledgeCard, extractCards } from '@/lib/contentParser';
import { Lightbulb, BookOpen, Send, Bot, Trash2, Check } from 'lucide-react';

import { ChatMessage } from '@/types';
import MarkdownRenderer from '../MarkdownRenderer';

interface KnowledgePanelProps {
  cards: KnowledgeCard[];
  visible: boolean;
  activeCardId: string | null;
  onCardClick: (id: string | null) => void;
  onAsk: (card: KnowledgeCard, question: string) => void;
  onDelete: (cardId: string) => void;
  cardRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  cardChats: Record<string, ChatMessage[]>;
  loadingCardId: string | null;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({ 
    cards, 
    visible, 
    activeCardId, 
    onCardClick, 
    onAsk,
    onDelete,
    cardRefs,
    cardChats,
    loadingCardId
}) => {
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  if (!visible) return null;

  const handleAsk = (card: KnowledgeCard) => {
    const question = inputs[card.id] || '';
    if (!question.trim()) return;
    
    onAsk(card, question);
    setInputs(prev => ({ ...prev, [card.id]: '' }));
  };

  return (
    <Box 
      h="100%" 
      w="35%"
      pt={60} // Clear global header
      bg="#F9FAFB" 
      className="border-l border-gray-200"
      style={{ 
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
        {/* Header - Unified Style */}
        <Box 
            h={60} 
            px="md" 
            bg="rgba(255, 255, 255, 0.7)"
            style={{ 
                borderBottom: '1px solid #e5e7eb', 
                display: 'flex', 
                alignItems: 'center',
                backdropFilter: 'blur(10px)',
                zIndex: 10
            }}
        >
            <Group gap="xs">
                <ThemeIcon variant="light" color="indigo" size="sm" radius="sm">
                    <BookOpen size={14} />
                </ThemeIcon>
                <Text fw={600} size="sm" c="dark.8">Knowledge Panel</Text>
            </Group>
        </Box>
        
        <ScrollArea flex={1} type="auto" offsetScrollbars>
            <Stack gap="sm" p="md" pb="xl">
                {cards.length === 0 && (
                    <Box 
                        mt="xl" 
                        p="xl" 
                        ta="center" 
                        style={{ opacity: 0.6, border: '1px dashed var(--mantine-color-gray-3)', borderRadius: '12px' }}
                    >
                        <Lightbulb size={32} className="text-gray-400 mx-auto mb-3" />
                        <Text size="sm" c="dimmed" fw={500}>
                            Waiting for concepts...
                        </Text>
                        <Text size="xs" c="dimmed" mt={4} maw={200} mx="auto" lh={1.4}>
                            Click highlighted terms in chat to view details here.
                        </Text>
                    </Box>
                )}

                {cards.map((card, index) => {
                    const isActive = activeCardId === card.id;

                    return (
                        <Paper 
                            key={card.id || index} 
                            ref={(el) => { cardRefs.current[card.id] = el; }}
                            radius="md" 
                            shadow={isActive ? 'md' : 'sm'}
                            withBorder
                            onClick={() => onCardClick(isActive ? null : card.id)}
                            className={`group animate-in slide-in-from-right-4 fade-in duration-100 transition-all cursor-pointer hover:border-indigo-300 ${isActive ? 'ring-2 ring-indigo-50 border-indigo-200' : ''}`}
                            style={{ 
                                animationDelay: `${index * 100}ms`,
                                borderColor: isActive ? 'var(--mantine-color-indigo-2)' : 'var(--mantine-color-gray-2)',
                                backgroundColor: isActive ? 'white' : 'var(--mantine-color-white)',
                            }}
                        >
                            <Box p="md">
                                <Group justify="space-between" align="center" mb={isActive ? "xs" : 0}>
                                    <Text fw={700} size="sm" c={isActive ? "indigo.7" : "dark.8"} lh={1.3} style={{ flex: 1 }}>
                                        {card.title}
                                    </Text>
                                    <Group gap={4}>
                                        <ThemeIcon variant="light" color={isActive ? "indigo" : "gray"} size="sm">
                                            <BookOpen size={14} />
                                        </ThemeIcon>

                                        <ActionIcon 
                                            variant="subtle" 
                                            color="gray" 
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteCardId(card.id);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </ActionIcon>
                                    </Group>
                                </Group>

                                <Collapse in={isActive}>
                                    <Stack gap="md" mt="xs">
                                        <Box style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--mantine-color-dark-6)' }}>
                                            <MarkdownRenderer content={card.content} compact />
                                        </Box>

                                        {/* Local Chat History */}
                                        {(cardChats[card.id] && cardChats[card.id].length > 0) || loadingCardId === card.id ? (
                                            <Stack gap="xs" mt="sm">
                                                {cardChats[card.id]?.map((msg) => (
                                                    <Box 
                                                        key={msg.id} 
                                                        bg={msg.role === 'user' ? 'indigo.0' : 'gray.0'} 
                                                        p="xs" 
                                                        style={{ 
                                                            borderRadius: '8px', 
                                                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                                            maxWidth: '90%'
                                                        }}
                                                    >
                                                        {msg.role === 'user' ? (
                                                            <Text size="xs" c="dark.8">{msg.content}</Text>
                                                        ) : (
                                                            <Box style={{ fontSize: '12px' }}>
                                                                <MarkdownRenderer content={extractCards(msg.content).cleanContent} compact />
                                                            </Box>
                                                        )}
                                                    </Box>
                                                ))}
                                                {loadingCardId === card.id && (
                                                    <Box 
                                                        bg="gray.0" 
                                                        p="xs" 
                                                        style={{ 
                                                            borderRadius: '8px', 
                                                            alignSelf: 'flex-start',
                                                            maxWidth: '90%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}
                                                    >
                                                        <Avatar size={16} radius="sm" bg="transparent">
                                                            <Bot size={14} className="text-indigo-600" />
                                                        </Avatar>
                                                        <Loader size={12} color="gray" type="dots" />
                                                    </Box>
                                                )}
                                            </Stack>
                                        ) : null}

                                        {/* Action Area */}
                                        <Box 
                                            pt="sm" 
                                            mt="sm" 
                                            style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}
                                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                                        >
                                            <Stack gap={8}>
                                                <Group gap={6}>
                                                    <Text size="xs" fw={500} c="indigo.9">Ask about this topic</Text>
                                                </Group>
                                                <Group gap={0} align="flex-start">
                                                    <TextInput 
                                                        placeholder="e.g. Example?"
                                                        size="xs"
                                                        radius="md"
                                                        value={inputs[card.id] || ''}
                                                        onChange={(e) => {
                                                            const value = e.currentTarget.value;
                                                            setInputs(prev => ({ ...prev, [card.id]: value }));
                                                        }}
                                                        disabled={loadingCardId === card.id}
                                                        onKeyDown={(e) => {
                                                            if (e.nativeEvent.isComposing) return;
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleAsk(card);
                                                            }
                                                        }}
                                                        style={{ flex: 1 }}
                                                        styles={{ input: { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
                                                    />
                                                    <Button 
                                                        size="xs" 
                                                        radius="md" 
                                                        variant="filled" 
                                                        color="indigo"
                                                        onClick={() => handleAsk(card)}
                                                        disabled={loadingCardId === card.id}
                                                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: 30 }}
                                                    >
                                                        <Send size={14} />
                                                    </Button>
                                                </Group>
                                            </Stack>
                                        </Box>
                                    </Stack>
                                </Collapse>
                            </Box>
                        </Paper>
                    );
                })}
            </Stack>
        </ScrollArea>
      {/* Delete Confirmation Modal */}
      <Modal 
        opened={!!deleteCardId} 
        onClose={() => setDeleteCardId(null)}
        title="Delete Knowledge Card"
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
            Are you sure you want to delete this card? The conversation history inside it will also be removed.
        </Text>
        <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteCardId(null)}>Cancel</Button>
            <Button 
                color="red" 
                onClick={() => {
                    if (deleteCardId) onDelete(deleteCardId);
                    setDeleteCardId(null);
                }}
            >
                Delete
            </Button>
        </Group>
      </Modal>
    </Box>
  );
};
