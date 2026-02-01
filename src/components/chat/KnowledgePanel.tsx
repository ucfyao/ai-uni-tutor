import { BookOpen, ChevronRight, Send, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
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
  explainingCardIds?: Set<string>;
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
  loadingCardId,
  explainingCardIds = new Set(),
}) => {
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  if (!visible) return null;

  const handleAsk = (card: KnowledgeCard) => {
    const q = inputs[card.id]?.trim();
    if (!q) return;
    onAsk(card, q);
    setInputs((p) => ({ ...p, [card.id]: '' }));
  };

  return (
    <Box
      h="100%"
      w={{ base: '100%', md: 340 }}
      style={{
        borderLeft: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
      }}
    >
      {/* Header */}
      <Group gap={8} px="md" py="sm" style={{ borderBottom: '1px solid #eee' }}>
        <BookOpen size={15} color="#6366f1" />
        <Text size="sm" fw={600} c="gray.7">
          Knowledge Cards
        </Text>
        {cards.length > 0 && (
          <Box px={6} py={2} style={{ background: '#6366f1', borderRadius: 10 }}>
            <Text size="xs" fw={600} c="white" lh={1}>
              {cards.length}
            </Text>
          </Box>
        )}
      </Group>

      <ScrollArea flex={1} scrollbarSize={4}>
        <Stack gap={6} p="sm">
          {cards.length === 0 && (
            <Text size="sm" c="gray.4" ta="center" py="xl">
              Select text to add card
            </Text>
          )}

          {cards.map((card) => {
            const isActive = activeCardId === card.id;
            const isExplaining = explainingCardIds.has(card.id);
            const chats = cardChats[card.id] || [];

            return (
              <Box
                key={card.id}
                ref={(el) => {
                  cardRefs.current[card.id] = el;
                }}
                className="group"
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  border: `1px solid ${isExplaining ? '#a5b4fc' : isActive ? '#c7d2fe' : '#e5e5e5'}`,
                  animation: isExplaining ? 'pulse-border 1.5s ease-in-out infinite' : 'none',
                }}
              >
                {/* Card Header */}
                <Group
                  gap={8}
                  px={12}
                  py={10}
                  wrap="nowrap"
                  onClick={() => onCardClick(isActive ? null : card.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {isExplaining ? (
                    <Loader size={14} color="indigo" />
                  ) : (
                    <BookOpen size={14} color={isActive ? '#6366f1' : '#aaa'} />
                  )}
                  <Text size="sm" fw={500} c="gray.7" lineClamp={1} style={{ flex: 1 }}>
                    {card.title}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={20}
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCardId(card.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </ActionIcon>
                  <ChevronRight
                    size={14}
                    color="#aaa"
                    style={{
                      transform: isActive ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.1s',
                    }}
                  />
                </Group>

                {/* Content */}
                <Collapse in={isActive}>
                  <Box px={12} pb={12}>
                    <Box
                      p={10}
                      mb={10}
                      style={{
                        background: '#f5f5f5',
                        borderRadius: 6,
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: '#374151',
                      }}
                    >
                      {isExplaining ? (
                        <Stack gap={8}>
                          <Group gap={6}>
                            <Loader size={12} color="indigo" />
                            <Text size="xs" c="gray.5">
                              Generating explanation...
                            </Text>
                          </Group>
                          <Skeleton height={8} width="90%" radius={4} />
                          <Skeleton height={8} width="75%" radius={4} />
                          <Skeleton height={8} width="60%" radius={4} />
                        </Stack>
                      ) : (
                        <MarkdownRenderer content={card.content} compact />
                      )}
                    </Box>

                    {chats.length > 0 && (
                      <Stack gap={6} mb={10}>
                        {chats.map((m) => (
                          <Box
                            key={m.id}
                            px={10}
                            py={6}
                            style={{
                              background: m.role === 'user' ? '#eef2ff' : '#f5f5f5',
                              borderRadius: 6,
                              marginLeft: m.role === 'user' ? '15%' : 0,
                              fontSize: 13,
                              color: '#374151',
                            }}
                          >
                            {m.role === 'user' ? (
                              m.content
                            ) : (
                              <MarkdownRenderer
                                content={extractCards(m.content).cleanContent}
                                compact
                              />
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}

                    {loadingCardId === card.id && (
                      <Box mb={10}>
                        <Loader size={14} color="indigo" />
                      </Box>
                    )}

                    <Group gap={4} onClick={(e) => e.stopPropagation()}>
                      <TextInput
                        placeholder="Ask follow-up..."
                        size="xs"
                        radius={4}
                        value={inputs[card.id] || ''}
                        onChange={(e) => {
                          const v = e.currentTarget.value;
                          setInputs((p) => ({ ...p, [card.id]: v }));
                        }}
                        disabled={loadingCardId === card.id || isExplaining}
                        onKeyDown={(e) => {
                          if (!e.nativeEvent.isComposing && e.key === 'Enter') {
                            e.preventDefault();
                            handleAsk(card);
                          }
                        }}
                        style={{ flex: 1 }}
                        styles={{ input: { fontSize: 12 } }}
                      />
                      <ActionIcon
                        size={24}
                        radius={4}
                        variant="filled"
                        color="indigo"
                        onClick={() => handleAsk(card)}
                        disabled={
                          !inputs[card.id]?.trim() || loadingCardId === card.id || isExplaining
                        }
                      >
                        <Send size={10} />
                      </ActionIcon>
                    </Group>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>

      <Modal
        opened={!!deleteCardId}
        onClose={() => setDeleteCardId(null)}
        title="Delete Card"
        centered
        size="xs"
      >
        <Text size="xs" c="gray.6" mb="md">
          Are you sure you want to delete this card?
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={() => setDeleteCardId(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            size="xs"
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
