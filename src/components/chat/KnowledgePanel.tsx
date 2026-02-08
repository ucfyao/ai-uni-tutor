import { BookOpen } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage } from '@/types';
import KnowledgeCardItem from './KnowledgeCardItem';

interface KnowledgePanelProps {
  cards: KnowledgeCard[];
  visible: boolean;
  activeCardId: string | null;
  onCardClick: (id: string | null) => void;
  onAsk: (card: KnowledgeCard, question: string) => void;
  onDelete: (cardId: string) => void;
  cardChats: Record<string, ChatMessage[]>;
  loadingCardId: string | null;
  explainingCardIds?: Set<string>;
  onClose?: () => void; // For drawer close button
  /** When set, panel scrolls to this card (e.g. after add); cleared via onScrolledToCard */
  scrollToCardId?: string | null;
  /** Incrementing counter to force scroll even when scrollToCardId is the same */
  scrollTrigger?: number;
  onScrolledToCard?: () => void;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  cards,
  visible,
  activeCardId,
  onCardClick,
  onAsk,
  onDelete,
  cardChats,
  loadingCardId,
  explainingCardIds = new Set(),
  onClose,
  scrollToCardId,
  scrollTrigger,
  onScrolledToCard,
}) => {
  const [inputs, setInputs] = useState<{ [key: string]: string }>({});
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const officialCards = React.useMemo(
    () => cards.filter((c) => (c.origin ?? 'official') !== 'user'),
    [cards],
  );
  const userCards = React.useMemo(() => cards.filter((c) => c.origin === 'user'), [cards]);
  const [openedSections, setOpenedSections] = useState<string[]>(() => {
    if (officialCards.length > 0) return ['official'];
    if (userCards.length > 0) return ['mine'];
    return [];
  });

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
  // Uses offsetTop for reliable positioning within nested scroll containers
  useEffect(() => {
    if (!scrollToCardId || !onScrolledToCard) return;

    const targetSection = (() => {
      const card = cards.find((c) => c.id === scrollToCardId);
      if (!card) return null;
      return (card.origin ?? 'official') === 'user' ? 'mine' : 'official';
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
  }, [scrollToCardId, scrollTrigger, onScrolledToCard, cards]); // removed cardRefs from dep array as it is a ref

  // When a card finishes thinking/loading, clear its input
  useEffect(() => {
    // We can't easily track "finished" here without previous state,
    // but we can clear input when loading starts? No, probably want to clear after send.
    // The previous implementation cleared input inside handleAsk which is fine.
    // But if we want to clear input from parent when response comes back, we'd need more logic.
    // Current logic in KnowledgeCardItem clears on ask.
    // Wait, let's check legacy handleAsk:
    // const handleAsk = (card) => { onAsk(card, q); setInputs(p => ({...p, [card.id]: ''})); }
    // In KnowledgeCardItem I used: handleAsk calls onAsk. But I didn't clear input!
    // I need to intercept onAsk in the KnowledgeCardItem props?
    // Or simpler: handleAsk in KnowledgeCardItem calls onInputChange(id, '')
  }, []);

  // FIX: The previous handleAsk wrapper cleared the input.
  // I must replicate this behavior.
  // I will pass a wrapped onAsk to KnowledgeCardItem or handle it inside KnowledgeCardItem.
  // In KnowledgeCardItem I implemented:
  // const handleAsk = () => { onAsk(card, q); }
  // It does NOT clear input.
  // I should update KnowledgeCardItem to clear input, OR pass a wrapper.
  // Passing a wrapper is better to keep logic here?
  // Wrapper: (card, q) => { onAsk(card, q); setInputs(prev => ({...prev, [card.id]: ''})); }
  // THIS wrapper is what I should pass as 'onAsk' to KnowledgeCardItem.
  // BUT KnowledgeCardItem takes `onAsk: (card, question) => void`.
  // So yes.

  const handleAskWrapper = useCallback(
    (card: KnowledgeCard, question: string) => {
      onAsk(card, question);
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
        background: '#fff',
      }}
    >
      {/* Header */}
      <Group
        gap={8}
        px="lg"
        py="md"
        justify="space-between"
        style={{
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Group gap={8}>
          <ThemeIcon size="md" radius="md" variant="light" color="indigo">
            <BookOpen size={16} />
          </ThemeIcon>
          <Text size="sm" fw={600} c="gray.8">
            Knowledge Cards
          </Text>
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
          <Stack gap={6} p="lg">
            {cards.length === 0 && (
              <Paper withBorder radius="md" p="lg" bg="gray.0">
                <Center>
                  <Stack gap="sm" align="center">
                    <ThemeIcon size={56} radius="md" variant="light" color="indigo">
                      <BookOpen size={24} strokeWidth={1.5} />
                    </ThemeIcon>
                    <Text size="sm" fw={600} c="gray.7" ta="center">
                      No cards yet
                    </Text>
                  </Stack>
                </Center>
              </Paper>
            )}

            {(officialCards.length > 0 || userCards.length > 0) && (
              <Accordion
                multiple
                value={openedSections}
                onChange={setOpenedSections}
                variant="separated"
                radius="md"
              >
                {officialCards.length > 0 && (
                  <Accordion.Item value="official">
                    <Accordion.Control>
                      <Group gap={10} wrap="nowrap">
                        <Text size="sm" fw={700} c="gray.7">
                          Official cards
                        </Text>
                        <Badge color="indigo" variant="light" size="sm" radius="xl">
                          {officialCards.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={6}>
                        {officialCards.map((card) => (
                          <KnowledgeCardItem
                            key={card.id}
                            card={card}
                            isActive={activeCardId === card.id}
                            isExplaining={explainingCardIds.has(card.id)}
                            chats={cardChats[card.id] || []}
                            isLoading={loadingCardId === card.id}
                            inputValue={inputs[card.id] || ''}
                            onCardClick={onCardClick}
                            onAsk={handleAskWrapper}
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
                      <Group gap={10} wrap="nowrap">
                        <Text size="sm" fw={700} c="gray.7">
                          My cards
                        </Text>
                        <Badge color="violet" variant="light" size="sm" radius="xl">
                          {userCards.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={6}>
                        {userCards.map((card) => (
                          <KnowledgeCardItem
                            key={card.id}
                            card={card}
                            isActive={activeCardId === card.id}
                            isExplaining={explainingCardIds.has(card.id)}
                            chats={cardChats[card.id] || []}
                            isLoading={loadingCardId === card.id}
                            inputValue={inputs[card.id] || ''}
                            onCardClick={onCardClick}
                            onAsk={handleAskWrapper}
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
