import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconArrowRight, IconBook2 } from '@tabler/icons-react';
import { fetchCardConversations } from '@/app/actions/knowledge-cards';
import type { CardConversationEntity } from '@/lib/domain/models/CardConversation';
import type { KnowledgeCardSummary } from '@/lib/domain/models/KnowledgeCard';
import type { UserCardEntity } from '@/lib/domain/models/UserCard';
import { useLanguage } from '@/i18n/LanguageContext';
import KnowledgeCardItem from './KnowledgeCardItem';

export type PanelCard =
  | { type: 'knowledge'; data: KnowledgeCardSummary }
  | { type: 'user'; data: UserCardEntity };

interface KnowledgePanelProps {
  officialCards: KnowledgeCardSummary[];
  userCards: UserCardEntity[];
  visible: boolean;
  activeCardId: string | null;
  onCardClick: (id: string | null) => void;
  onAsk: (
    card: { id: string; title: string },
    question: string,
    cardType: 'knowledge' | 'user',
  ) => void;
  onDelete: (cardId: string) => void;
  loadingCardId: string | null;
  onClose?: () => void;
  scrollToCardId?: string | null;
  scrollTrigger?: number;
  onScrolledToCard?: () => void;
  prefillInput?: { cardId: string; text: string } | null;
  onPrefillConsumed?: () => void;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  officialCards,
  userCards,
  visible,
  activeCardId,
  onCardClick,
  onAsk,
  onDelete,
  loadingCardId,
  onClose,
  scrollToCardId,
  scrollTrigger,
  onScrolledToCard,
  prefillInput,
  onPrefillConsumed,
}) => {
  const { t } = useLanguage();
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [cardChats, setCardChats] = useState<Record<string, CardConversationEntity[]>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const totalCards = officialCards.length + userCards.length;
  const [openedSections, setOpenedSections] = useState<string[]>(() => {
    if (officialCards.length > 0) return ['official'];
    if (userCards.length > 0) return ['mine'];
    return [];
  });

  // Keep opened sections valid when card categories appear/disappear
  useEffect(() => {
    setOpenedSections((prev) =>
      prev.filter((v) => (v === 'official' ? officialCards.length > 0 : userCards.length > 0)),
    );
  }, [officialCards.length, userCards.length]);

  // If cards load after mount and nothing is open, open the most relevant section
  const prevCardsCountRef = useRef(totalCards);
  useEffect(() => {
    const prev = prevCardsCountRef.current;
    prevCardsCountRef.current = totalCards;

    if (prev === 0 && totalCards > 0 && openedSections.length === 0) {
      if (officialCards.length > 0) setOpenedSections(['official']);
      else if (userCards.length > 0) setOpenedSections(['mine']);
    }
  }, [totalCards, openedSections.length, officialCards.length, userCards.length]);

  // Load card conversations when a card is expanded
  useEffect(() => {
    if (!activeCardId) return;
    if (cardChats[activeCardId]) return; // already loaded

    const isOfficial = officialCards.some((c) => c.id === activeCardId);
    const cardType = isOfficial ? 'knowledge' : 'user';

    (async () => {
      const result = await fetchCardConversations(activeCardId, cardType as 'knowledge' | 'user');
      if (result.success) {
        setCardChats((prev) => ({ ...prev, [activeCardId]: result.data }));
      }
    })();
  }, [activeCardId, officialCards, cardChats]);

  // Pre-fill card input when requested (e.g. after Explain selection)
  useEffect(() => {
    if (prefillInput) {
      setInputs((p) => ({ ...p, [prefillInput.cardId]: prefillInput.text }));
      onPrefillConsumed?.();
    }
  }, [prefillInput, onPrefillConsumed]);

  // Memoize input change handler
  const handleInputChange = useCallback((cardId: string, value: string) => {
    setInputs((p) => ({ ...p, [cardId]: value }));
  }, []);

  // Use a ref to store per-card ref callbacks to ensure they are stable identity
  const refCallbacks = useRef<Record<string, (el: HTMLDivElement | null) => void>>({});

  const getRefCallback = (id: string) => {
    if (!refCallbacks.current[id]) {
      refCallbacks.current[id] = (el) => {
        cardRefs.current[id] = el;
      };
    }
    return refCallbacks.current[id];
  };

  // Encapsulated: scroll to card using manual scroll calculation
  useEffect(() => {
    if (!scrollToCardId || !onScrolledToCard) return;

    const targetSection = (() => {
      if (userCards.some((c) => c.id === scrollToCardId)) return 'mine';
      if (officialCards.some((c) => c.id === scrollToCardId)) return 'official';
      return null;
    })();

    if (targetSection) {
      // UX: when focusing a user-created card, collapse official to reduce distraction.
      setOpenedSections((prev) => {
        if (targetSection === 'mine') return ['mine'];
        return prev.includes(targetSection) ? prev : [...prev, targetSection];
      });
    }

    let attempts = 0;
    const maxAttempts = 30; // Try for ~1.5s max
    let hasScrolled = false;

    const tryScroll = () => {
      if (hasScrolled) return; // Prevent duplicate scrolls

      const el = cardRefs.current[scrollToCardId];
      const viewport = viewportRef.current;

      if (!el || !viewport) {
        // Element not ready yet, retry
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryScroll, 50);
        } else {
          console.warn('[KnowledgePanel] Max scroll attempts reached, giving up');
          onScrolledToCard(); // Still clear the pending state
        }
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      if (viewportRect.width <= 0 || viewportRect.height <= 0) {
        onScrolledToCard();
        return;
      }

      // Check if element has valid dimensions
      const elRect = el.getBoundingClientRect();
      if (elRect.width <= 0 || elRect.height <= 0) {
        // Element not fully rendered yet, retry
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryScroll, 50);
        } else {
          console.warn('[KnowledgePanel] Element not fully rendered, giving up');
          onScrolledToCard();
        }
        return;
      }

      // Robust: compute offset via bounding rects (works through Accordions / nested containers)
      const targetScroll = Math.max(0, viewport.scrollTop + (elRect.top - viewportRect.top) - 8);

      hasScrolled = true;
      viewport.scrollTo({ top: targetScroll, behavior: 'smooth' });
      onScrolledToCard();
    };

    // Start trying after a small delay to allow React to render
    const timeoutId = setTimeout(() => {
      tryScroll();
    }, 180); // Allow accordion/card expansion layout to settle

    return () => {
      clearTimeout(timeoutId);
    };
  }, [scrollToCardId, scrollTrigger, onScrolledToCard, officialCards, userCards]);

  // When a card finishes thinking/loading, clear its input
  useEffect(() => {
    // Intentionally left as a placeholder: input is cleared on send via handleAskWrapper.
  }, []);

  const handleAskOfficial = useCallback(
    (card: { id: string; title: string }, question: string) => {
      onAsk(card, question, 'knowledge');
      setInputs((prev) => ({ ...prev, [card.id]: '' }));
    },
    [onAsk],
  );

  const handleAskUser = useCallback(
    (card: { id: string; title: string }, question: string) => {
      onAsk(card, question, 'user');
      setInputs((prev) => ({ ...prev, [card.id]: '' }));
    },
    [onAsk],
  );

  if (!visible) return null;

  return (
    <Box
      h="100%"
      w="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
        background: 'var(--mantine-color-default-hover)',
      }}
    >
      {/* Drawer close button — only shown inside mobile/tablet drawer */}
      {onClose && (
        <CloseButton
          onClick={onClose}
          size="sm"
          variant="subtle"
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
        />
      )}

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ScrollArea
          viewportRef={viewportRef}
          h="100%"
          scrollbarSize={6}
          type="auto"
          flex={1}
          style={{ minHeight: 0 }}
          styles={{
            root: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
            viewport: { height: '100%', minHeight: 0 },
          }}
        >
          <Stack gap={10} p="md">
            {totalCards === 0 && (
              <Stack align="center" gap="md" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconBook2 size={24} />
                </ThemeIcon>
                <Text ta="center" c="dimmed" fz="sm">
                  {t.chat.noKnowledgeFound}
                </Text>
                <Button
                  component={Link}
                  href="/knowledge"
                  variant="subtle"
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                >
                  {t.chat.uploadDocuments}
                </Button>
              </Stack>
            )}

            {(officialCards.length > 0 || userCards.length > 0) && (
              <Accordion
                multiple
                value={openedSections}
                onChange={setOpenedSections}
                variant="separated"
                radius="md"
                chevron={<ChevronDown size={14} />}
                chevronPosition="right"
                classNames={{ control: 'knowledge-accordion__control' }}
                styles={{
                  root: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  },
                  item: {
                    backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 74%, transparent)',
                    WebkitBackdropFilter: 'blur(10px) saturate(1.05)',
                    backdropFilter: 'blur(10px) saturate(1.05)',
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    margin: 0,
                    boxShadow:
                      '0 10px 24px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)',
                  },
                  control: {
                    backgroundColor: 'transparent',
                    padding: '10px 12px',
                    minHeight: 44,
                    borderRadius: 14,
                  },
                  label: { padding: 0 },
                  chevron: {
                    color: 'var(--mantine-color-gray-5)',
                  },
                  panel: {
                    backgroundColor: 'transparent',
                    padding: '4px 12px 12px 12px',
                  },
                  // Flatten Mantine's `.mantine-Accordion-content` wrapper
                  // (the div is still in the DOM, but it does not create a box).
                  content: {
                    display: 'contents',
                  },
                }}
              >
                {officialCards.length > 0 && (
                  <Accordion.Item value="official">
                    <Accordion.Control>
                      <Group gap={8} wrap="nowrap" justify="space-between" w="100%">
                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            w={6}
                            h={6}
                            style={{
                              borderRadius: 99,
                              background: 'var(--mantine-color-indigo-6)',
                              boxShadow: '0 0 0 2px rgba(79, 70, 229, 0.12)',
                              flexShrink: 0,
                            }}
                          />
                          <Text size="sm" fw={600} lineClamp={1}>
                            {t.chat.officialCards}
                          </Text>
                        </Group>
                        <Badge
                          color="indigo"
                          variant="light"
                          size="xs"
                          radius="xl"
                          style={{ flexShrink: 0 }}
                          styles={{ root: { height: 16, padding: '0 6px', fontSize: 9 } }}
                        >
                          {officialCards.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={12} pt={10}>
                        {officialCards.map((card) => (
                          <KnowledgeCardItem
                            key={card.id}
                            card={{ id: card.id, title: card.title, content: card.definition, keyConcepts: card.keyConcepts }}
                            cardType="knowledge"
                            isActive={activeCardId === card.id}
                            chats={cardChats[card.id] || []}
                            isLoading={loadingCardId === card.id}
                            inputValue={inputs[card.id] || ''}
                            onCardClick={onCardClick}
                            onAsk={handleAskOfficial}
                            onDelete={setDeleteCardId}
                            onInputChange={handleInputChange}
                            setRef={getRefCallback(card.id)}
                          />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                )}

                {userCards.length > 0 && (
                  <Accordion.Item value="mine">
                    <Accordion.Control>
                      <Group
                        gap={8}
                        wrap="nowrap"
                        justify="space-between"
                        w="100%"
                        style={{ minWidth: 0 }}
                      >
                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            w={6}
                            h={6}
                            style={{
                              borderRadius: 99,
                              background: 'var(--mantine-color-indigo-4)',
                              boxShadow: '0 0 0 2px rgba(79, 70, 229, 0.12)',
                              flexShrink: 0,
                            }}
                          />
                          <Text size="sm" fw={600} lineClamp={1}>
                            {t.chat.myCards}
                          </Text>
                        </Group>
                        <Badge
                          color="indigo"
                          variant="light"
                          size="xs"
                          radius="xl"
                          style={{ flexShrink: 0 }}
                          styles={{ root: { height: 16, padding: '0 6px', fontSize: 9 } }}
                        >
                          {userCards.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={12} pt={10}>
                        {userCards.map((card) => (
                          <KnowledgeCardItem
                            key={card.id}
                            card={{ id: card.id, title: card.title, content: card.content, excerpt: card.excerpt }}
                            cardType="user"
                            isActive={activeCardId === card.id}
                            chats={cardChats[card.id] || []}
                            isLoading={loadingCardId === card.id}
                            inputValue={inputs[card.id] || ''}
                            onCardClick={onCardClick}
                            onAsk={handleAskUser}
                            onDelete={setDeleteCardId}
                            onInputChange={handleInputChange}
                            setRef={getRefCallback(card.id)}
                          />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                )}
              </Accordion>
            )}
          </Stack>
        </ScrollArea>
      </Box>

      <Modal
        opened={!!deleteCardId}
        onClose={() => setDeleteCardId(null)}
        title={t.chat.deleteCard}
        centered
        size="xs"
      >
        <Text size="xs" c="dimmed" mb="md">
          {t.chat.deleteCardConfirm}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={() => setDeleteCardId(null)}>
            {t.chat.cancel}
          </Button>
          <Button
            color="red"
            size="xs"
            onClick={() => {
              if (deleteCardId) onDelete(deleteCardId);
              setDeleteCardId(null);
            }}
          >
            {t.chat.delete}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
};
