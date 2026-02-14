import clsx from 'clsx';
import { BookOpen, ChevronRight, Send, Trash2 } from 'lucide-react'; // Re-imported Send
import dynamic from 'next/dynamic';
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
  type MantineColor,
} from '@mantine/core';
import { PLACEHOLDERS } from '@/constants/placeholders';
import { useLanguage } from '@/i18n/LanguageContext';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage } from '@/types';

const MarkdownRenderer = dynamic(() => import('../MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

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
    const { t } = useLanguage();
    const accentColor: MantineColor = card.origin === 'user' ? 'violet' : 'indigo';
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
        className={clsx(
          'knowledge-card group',
          isActive && 'knowledge-card--active',
          isExplaining && 'knowledge-card--explaining',
        )}
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
            {isExplaining ? (
              <Loader size={16} color={accentColor} />
            ) : (
              <BookOpen
                size={16}
                style={{
                  color: isActive ? 'var(--kc-accent)' : 'var(--mantine-color-gray-5)',
                  transition: 'color 0.2s ease',
                }}
                strokeWidth={2}
              />
            )}
          </Box>
          <Text
            size="sm"
            fw={isActive ? 600 : 500}
            c={isActive ? 'dark.9' : 'gray.7'}
            lineClamp={1}
            style={{
              flex: 1,
              transition: 'color 0.2s ease',
            }}
          >
            {card.title}
          </Text>
          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
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
                fontSize: 14, // Slightly larger base text
                lineHeight: 1.6,
                color: 'var(--mantine-color-gray-7)',
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {isExplaining ? (
                <Stack gap={10}>
                  {card.source?.kind === 'selection' && card.source.excerpt.trim().length > 0 && (
                    <Box
                      px={10}
                      py={9}
                      style={{
                        background: 'var(--mantine-color-gray-0)',
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-gray-2)',
                        borderLeft: '3px solid var(--kc-accent)',
                      }}
                    >
                      <Text size="xs" c="gray.7" style={{ whiteSpace: 'pre-wrap' }} lineClamp={6}>
                        {card.source.excerpt}
                      </Text>
                    </Box>
                  )}
                  <Group gap={8}>
                    <Loader size={12} color={accentColor} />
                    <Text size="xs" c="gray.5" fw={500}>
                      {t.chat.generatingExplanation}
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
                      px={10}
                      py={9}
                      style={{
                        background: 'var(--mantine-color-gray-0)',
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-gray-2)',
                        borderLeft: '3px solid var(--kc-accent)',
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
              <Stack gap={8} mb={10} align="stretch">
                {chats.map((m) => (
                  <Box
                    key={m.id}
                    px={10}
                    py={7}
                    style={{
                      background:
                        m.role === 'user' ? 'var(--kc-accent-soft)' : 'var(--mantine-color-gray-0)',
                      borderRadius: 8,
                      width: 'fit-content',
                      maxWidth: '100%',
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: 'var(--mantine-color-gray-7)',
                      border: '1px solid var(--mantine-color-gray-2)',
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
                <Loader size={14} color={accentColor} />
                <Text size="xs" c="gray.5" fw={500}>
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
                disabled={isLoading || isExplaining}
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
                    disabled={!inputValue?.trim() || isLoading || isExplaining}
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
