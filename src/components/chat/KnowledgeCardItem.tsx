import { BookOpen, ChevronRight, Send, Trash2 } from 'lucide-react'; // Re-imported Send
import React, { memo } from 'react';
import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Loader,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage } from '@/types';
import MarkdownRenderer from '../MarkdownRenderer';

interface KnowledgeCardItemProps {
  card: KnowledgeCard;
  isActive: boolean;
  isExplaining: boolean;
  chats: ChatMessage[];
  isLoading: boolean;
  inputValue: string;
  onCardClick: (id: string | null) => void;
  onAsk: (card: KnowledgeCard, question: string) => void;
  onDelete: (cardId: string) => void;
  onInputChange: (cardId: string, value: string) => void;
  setRef: (element: HTMLDivElement | null) => void;
}

const KnowledgeCardItem = memo(
  ({
    card,
    isActive,
    isExplaining,
    chats,
    isLoading,
    inputValue,
    onCardClick,
    onAsk,
    onDelete,
    onInputChange,
    setRef,
  }: KnowledgeCardItemProps) => {
    const handleAsk = () => {
      const q = inputValue?.trim();
      if (!q) return;
      onAsk(card, q);
    };

    return (
      <Box
        ref={setRef}
        className="group"
        style={{
          background: isActive ? 'linear-gradient(135deg, #fefefe 0%, #f8faff 100%)' : '#fff',
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
              <BookOpen size={12} color={isActive ? '#6366f1' : '#9ca3af'} strokeWidth={2.5} />
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
              onDelete(card.id);
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
        <Collapse in={isActive} transitionDuration={100}>
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
                  {card.source?.kind === 'selection' && card.source.excerpt.trim().length > 0 && (
                    <Box
                      px={12}
                      py={10}
                      style={{
                        background: 'var(--mantine-color-gray-0)',
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-gray-2)',
                        borderLeft: '3px solid var(--mantine-color-indigo-4)',
                      }}
                    >
                      <Text size="xs" c="gray.7" style={{ whiteSpace: 'pre-wrap' }} lineClamp={6}>
                        {card.source.excerpt}
                      </Text>
                    </Box>
                  )}
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
                <>
                  {card.source?.kind === 'selection' && card.source.excerpt.trim().length > 0 && (
                    <Box
                      mb={10}
                      px={12}
                      py={10}
                      style={{
                        background: 'var(--mantine-color-gray-0)',
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-gray-2)',
                        borderLeft: '3px solid var(--mantine-color-indigo-4)',
                      }}
                    >
                      <Text size="xs" c="gray.7" style={{ whiteSpace: 'pre-wrap' }} lineClamp={8}>
                        {card.source.excerpt}
                      </Text>
                    </Box>
                  )}
                  {(!card.source ||
                    card.source.kind !== 'selection' ||
                    card.content.trim() !== card.source.excerpt.trim()) && (
                    <MarkdownRenderer content={card.content} compact />
                  )}
                </>
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
                      <MarkdownRenderer content={extractCards(m.content).cleanContent} compact />
                    )}
                  </Box>
                ))}
              </Stack>
            )}

            {isLoading && (
              <Group gap={8} mb={12}>
                <Loader size={14} color="indigo" />
                <Text size="xs" c="gray.5" fw={500}>
                  Thinking...
                </Text>
              </Group>
            )}

            <Box onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
              <TextInput
                placeholder={PLACEHOLDERS.ASK_FOLLOWUP}
                size="xs"
                radius="xl"
                value={inputValue}
                onChange={(e) => onInputChange(card.id, e.currentTarget.value)}
                disabled={isLoading || isExplaining}
                onKeyDown={(e) => {
                  if (!e.nativeEvent.isComposing && e.key === 'Enter') {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                styles={{
                  input: {
                    fontSize: 13,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    paddingLeft: 16,
                    paddingRight: 42,
                    height: 36,
                  },
                }}
                rightSection={
                  <ActionIcon
                    size={26}
                    radius="xl"
                    variant="filled"
                    color="indigo"
                    onClick={handleAsk}
                    disabled={!inputValue?.trim() || isLoading || isExplaining}
                    style={{
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 4px rgba(99, 102, 241, 0.25)',
                      opacity: !inputValue?.trim() ? 0.6 : 1,
                    }}
                    aria-label="Send follow-up question"
                  >
                    <Send size={14} strokeWidth={2.2} />
                  </ActionIcon>
                }
                rightSectionWidth={42}
              />
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  },
);

KnowledgeCardItem.displayName = 'KnowledgeCardItem';

export default KnowledgeCardItem;
