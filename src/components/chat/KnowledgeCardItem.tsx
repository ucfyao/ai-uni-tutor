import clsx from 'clsx';
import { BookOpen, ChevronRight, Send, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { memo } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Collapse,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  type MantineColor,
} from '@mantine/core';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { useLanguage } from '@/i18n/LanguageContext';
import type { CardConversationEntity } from '@/lib/domain/models/CardConversation';

const MarkdownRenderer = dynamic(() => import('../MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

interface CardItemData {
  id: string;
  title: string;
  content: string;
  keyConcepts?: string[];
  excerpt?: string;
}

interface KnowledgeCardItemProps {
  card: CardItemData;
  cardType: 'knowledge' | 'user';
  isActive: boolean;
  chats: CardConversationEntity[];
  isLoading: boolean;
  inputValue: string;
  onCardClick: (id: string | null) => void;
  onAsk: (card: { id: string; title: string }, question: string) => void;
  onDelete: (cardId: string) => void;
  onInputChange: (cardId: string, value: string) => void;
  setRef: (element: HTMLDivElement | null) => void;
}

const KnowledgeCardItem = memo(
  ({
    card,
    cardType,
    isActive,
    chats,
    isLoading,
    inputValue,
    onCardClick,
    onAsk,
    onDelete,
    onInputChange,
    setRef,
  }: KnowledgeCardItemProps) => {
    const { t } = useLanguage();
    const accentColor: MantineColor = cardType === 'user' ? 'violet' : 'indigo';
    const panelId = `kc-panel-${card.id}`;

    const handleAsk = () => {
      const q = inputValue?.trim();
      if (!q) return;
      onAsk(card, q);
    };

    return (
      <Box
        ref={setRef}
        style={
          {
            '--kc-accent': `var(--mantine-color-${accentColor}-6)`,
            '--kc-accent-soft': `var(--mantine-color-${accentColor}-0)`,
          } as React.CSSProperties
        }
        className={clsx('knowledge-card group', isActive && 'knowledge-card--active')}
      >
        <Box className="knowledge-card__active-bar" aria-hidden />
        <Group
          gap={8}
          wrap="nowrap"
          onClick={() => onCardClick(isActive ? null : card.id)}
          role="button"
          aria-expanded={isActive}
          aria-controls={panelId}
          tabIndex={0}
          className="knowledge-card__header"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCardClick(isActive ? null : card.id);
            }
          }}
        >
          <Box className="knowledge-card__icon" style={{ flexShrink: 0 }}>
            <BookOpen
              size={16}
              style={{
                color: isActive ? 'var(--kc-accent)' : 'var(--mantine-color-gray-5)',
                transition: 'color 0.2s ease',
              }}
              strokeWidth={2}
            />
          </Box>
          <Text
            size="sm"
            fw={isActive ? 600 : 500}
            c={isActive ? undefined : 'dimmed'}
            lineClamp={1}
            style={{
              flex: 1,
              transition: 'color 0.2s ease',
            }}
          >
            {card.title}
          </Text>
          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
            {cardType === 'user' && (
              <ActionIcon
                variant="subtle"
                color="red"
                size={26}
                radius="md"
                className="knowledge-card__delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.id);
                }}
                aria-label={`Delete ${card.title}`}
              >
                <Trash2 size={14} />
              </ActionIcon>
            )}
            <ChevronRight
              size={16}
              aria-hidden
              style={{
                color: isActive ? 'var(--kc-accent)' : 'var(--mantine-color-gray-4)',
                transform: isActive ? 'rotate(90deg)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
              }}
            />
          </Group>
        </Group>

        {/* Content */}
        <Collapse in={isActive} transitionDuration={200} animateOpacity>
          <Box id={panelId} px={12} pt={10} pb={12}>
            <Box
              mx={0}
              mt={0}
              p={0}
              mb={0}
              style={{
                background: 'transparent',
                borderRadius: '0 0 12px 12px',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--mantine-color-gray-7)',
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {/* Key concepts tags for official cards */}
              {cardType === 'knowledge' && card.keyConcepts && card.keyConcepts.length > 0 && (
                <Group gap={6} mb={10} wrap="wrap">
                  {card.keyConcepts.map((concept) => (
                    <Badge key={concept} size="xs" variant="light" color="indigo" radius="sm">
                      {concept}
                    </Badge>
                  ))}
                </Group>
              )}

              {/* Excerpt for user cards */}
              {cardType === 'user' && card.excerpt && card.excerpt.trim().length > 0 && (
                <Box
                  mb={10}
                  px={10}
                  py={9}
                  style={{
                    background: 'var(--mantine-color-default-hover)',
                    borderRadius: 8,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderLeft: '3px solid var(--kc-accent)',
                  }}
                >
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }} lineClamp={8}>
                    {card.excerpt}
                  </Text>
                </Box>
              )}

              {/* Main content (definition for official, content for user) */}
              {card.content && <MarkdownRenderer content={card.content} compact />}
            </Box>

            {chats.length > 0 && (
              <Stack gap={8} mb={10} align="stretch">
                {chats.map((m) => (
                  <Box
                    key={m.id}
                    px={10}
                    py={7}
                    style={{
                      background:
                        m.role === 'user'
                          ? 'var(--kc-accent-soft)'
                          : 'var(--mantine-color-default-hover)',
                      borderRadius: 8,
                      width: 'fit-content',
                      maxWidth: '100%',
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: 'var(--mantine-color-text)',
                      border: '1px solid var(--mantine-color-default-border)',
                    }}
                  >
                    {m.role === 'user' ? (
                      <Text size="sm" fw={500}>
                        {m.content}
                      </Text>
                    ) : (
                      <MarkdownRenderer content={m.content} compact />
                    )}
                  </Box>
                ))}
              </Stack>
            )}

            {isLoading && (
              <Group gap={8} mb={12}>
                <Loader size={14} color={accentColor} />
                <Text size="xs" c="dimmed" fw={500}>
                  {t.chat.thinking}
                </Text>
              </Group>
            )}

            <Box
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'relative', width: '100%' }}
            >
              <TextInput
                placeholder={PLACEHOLDERS.ASK_FOLLOWUP}
                size="xs"
                radius="xl"
                value={inputValue}
                onChange={(e) => onInputChange(card.id, e.currentTarget.value)}
                disabled={isLoading}
                classNames={{ input: 'knowledge-card__input' }}
                onKeyDown={(e) => {
                  if (!e.nativeEvent.isComposing && e.key === 'Enter') {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                styles={{
                  input: {
                    fontSize: 13,
                    paddingLeft: 16,
                    paddingRight: 40,
                    height: 34,
                  },
                }}
                rightSection={
                  <ActionIcon
                    size={24}
                    radius="xl"
                    variant="filled"
                    color={accentColor}
                    onClick={handleAsk}
                    disabled={!inputValue?.trim() || isLoading}
                    style={{
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)',
                      opacity: !inputValue?.trim() ? 0.6 : 1,
                    }}
                    aria-label="Send follow-up question"
                  >
                    <Send size={13} strokeWidth={2.2} />
                  </ActionIcon>
                }
                rightSectionWidth={40}
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
