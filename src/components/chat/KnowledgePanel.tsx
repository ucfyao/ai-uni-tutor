import { BookOpen, ChevronRight, Send, Sparkles, Trash2 } from 'lucide-react';
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
import { PLACEHOLDERS } from '@/constants/placeholders';
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
  onClose?: () => void; // For drawer close button
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
  onClose,
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
      w="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      {/* Header */}
      <Group
        gap={8}
        px="md"
        py={10}
        justify="space-between"
        style={{
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Group gap={8}>
          <BookOpen size={16} color="#6366f1" />
          <Text size="sm" fw={600} c="gray.8">
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
        {onClose && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </ActionIcon>
        )}
      </Group>

      <ScrollArea flex={1} scrollbarSize={4}>
        <Stack gap={6} p="sm">
          {cards.length === 0 && (
            <Stack gap="sm" py="48px" px="lg" align="center">
              {/* Icon */}
              <Box
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #f3f4ff 0%, #e8e4ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen size={24} color="#6366f1" strokeWidth={1.5} />
              </Box>

              {/* Text */}
              <Text size="sm" fw={600} c="gray.7" ta="center">
                No cards yet
              </Text>

              {/* Yellow Tip Box */}
              <Box
                px="md"
                py={8}
                style={{
                  background: '#fffbeb',
                  borderRadius: 8,
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Sparkles size={14} color="#f59e0b" strokeWidth={2} />
                  <Text size="xs" c="gray.6" fw={500}>
                    Select text to explain
                  </Text>
                </Group>
              </Box>
            </Stack>
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
                  background: isActive
                    ? 'linear-gradient(135deg, #fefefe 0%, #f8faff 100%)'
                    : '#fff',
                  borderRadius: 10,
                  border: `1px solid ${isExplaining ? '#a5b4fc' : isActive ? '#818cf8' : '#e2e8f0'}`,
                  boxShadow: isActive
                    ? '0 4px 12px rgba(99, 102, 241, 0.12), 0 1px 3px rgba(0,0,0,0.04)'
                    : '0 1px 2px rgba(0,0,0,0.04)',
                  animation: isExplaining ? 'pulse-border 1.5s ease-in-out infinite' : 'none',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.boxShadow =
                      '0 4px 12px rgba(99, 102, 241, 0.1), 0 1px 3px rgba(0,0,0,0.04)';
                    e.currentTarget.style.borderColor = '#c7d2fe';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {/* Card Header */}
                <Group
                  gap={8}
                  px={14}
                  py={12}
                  wrap="nowrap"
                  onClick={() => onCardClick(isActive ? null : card.id)}
                  role="button"
                  aria-expanded={isActive}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCardClick(isActive ? null : card.id);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    borderRadius: isActive ? '10px 10px 0 0' : 10,
                  }}
                >
                  {isExplaining ? (
                    <Loader size={14} color="indigo" />
                  ) : (
                    <Box
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: isActive
                          ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
                          : '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <BookOpen
                        size={12}
                        color={isActive ? '#6366f1' : '#9ca3af'}
                        strokeWidth={2.5}
                      />
                    </Box>
                  )}
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 500}
                    c={isActive ? 'gray.9' : 'gray.7'}
                    lineClamp={1}
                    style={{
                      flex: 1,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {card.title}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size={24}
                    radius={6}
                    className="opacity-0 group-hover:opacity-100"
                    style={{ transition: 'opacity 0.15s ease' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteCardId(card.id);
                    }}
                    aria-label={`Delete ${card.title}`}
                  >
                    <Trash2 size={13} />
                  </ActionIcon>
                  <ChevronRight
                    size={14}
                    color={isActive ? '#6366f1' : '#9ca3af'}
                    style={{
                      transform: isActive ? 'rotate(90deg)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                </Group>

                {/* Content */}
                <Collapse in={isActive} transitionDuration={200}>
                  <Box px={14} pb={14}>
                    <Box
                      p={12}
                      mb={12}
                      style={{
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: '#374151',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {isExplaining ? (
                        <Stack gap={10}>
                          <Group gap={8}>
                            <Loader size={12} color="indigo" />
                            <Text size="xs" c="gray.5" fw={500}>
                              Generating explanation...
                            </Text>
                          </Group>
                          <Skeleton height={8} width="90%" radius={4} animate />
                          <Skeleton height={8} width="75%" radius={4} animate />
                          <Skeleton height={8} width="60%" radius={4} animate />
                        </Stack>
                      ) : (
                        <MarkdownRenderer content={card.content} compact />
                      )}
                    </Box>

                    {chats.length > 0 && (
                      <Stack gap={8} mb={12}>
                        {chats.map((m) => (
                          <Box
                            key={m.id}
                            px={12}
                            py={8}
                            style={{
                              background:
                                m.role === 'user'
                                  ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
                                  : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                              borderRadius: 8,
                              marginLeft: m.role === 'user' ? '12%' : 0,
                              marginRight: m.role === 'user' ? 0 : '12%',
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: '#374151',
                              border: `1px solid ${m.role === 'user' ? '#c7d2fe' : '#e2e8f0'}`,
                            }}
                          >
                            {m.role === 'user' ? (
                              <Text size="sm" fw={500}>
                                {m.content}
                              </Text>
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
                      <Group gap={8} mb={12}>
                        <Loader size={14} color="indigo" />
                        <Text size="xs" c="gray.5" fw={500}>
                          Thinking...
                        </Text>
                      </Group>
                    )}

                    <Group gap={6} onClick={(e) => e.stopPropagation()}>
                      <TextInput
                        placeholder={PLACEHOLDERS.ASK_FOLLOWUP}
                        size="xs"
                        radius={8}
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
                        styles={{
                          input: {
                            fontSize: 12,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.2s ease',
                          },
                        }}
                      />
                      <ActionIcon
                        size={28}
                        radius={8}
                        variant="filled"
                        color="indigo"
                        onClick={() => handleAsk(card)}
                        disabled={
                          !inputs[card.id]?.trim() || loadingCardId === card.id || isExplaining
                        }
                        style={{
                          transition: 'all 0.15s ease',
                          boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)',
                        }}
                        aria-label="Send follow-up question"
                      >
                        <Send size={12} />
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
