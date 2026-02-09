import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage } from '@/types';
import type { KnowledgeCardSource } from '@/types/knowledge';

interface UseKnowledgeCardsOptions {
  sessionId: string;
  messages: ChatMessage[];
  courseCode: string;
  enabled: boolean; // Only enable for Lecture Helper and Assignment Coach
}

export function useKnowledgeCards({
  sessionId,
  messages,
  courseCode: _courseCode,
  enabled,
}: UseKnowledgeCardsOptions) {
  // User-managed cards (persisted to localStorage)
  const [manualCards, setManualCards] = useState<KnowledgeCard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load manual cards from local storage after mount
  useEffect(() => {
    if (!enabled) return;
    try {
      const stored = localStorage.getItem(`knowledge-cards-${sessionId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as KnowledgeCard[];
        setManualCards(parsed.map((c) => ({ ...c, origin: c.origin ?? 'user' })));
      }
    } catch (e) {
      console.error('Failed to load manual cards', e);
    } finally {
      setIsLoaded(true);
    }
  }, [sessionId, enabled]);

  // Track deleted card IDs
  const [deletedCardIds, setDeletedCardIds] = useState<Set<string>>(new Set());

  // Load deleted card IDs from local storage after mount
  useEffect(() => {
    if (!enabled) return;
    try {
      const stored = localStorage.getItem(`deleted-cards-${sessionId}`);
      if (stored) {
        setDeletedCardIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error('Failed to load deleted cards', e);
    }
  }, [sessionId, enabled]);

  // Track cards being explained by AI (reserved for future use)
  const [explainingCardIds] = useState<Set<string>>(new Set());

  // Save to localStorage when cards change
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled || !isLoaded) return;
    // Ensure we persist user-created cards with the right origin marker.
    localStorage.setItem(
      `knowledge-cards-${sessionId}`,
      JSON.stringify(manualCards.map((c) => ({ ...c, origin: c.origin ?? 'user' }))),
    );
  }, [manualCards, sessionId, enabled, isLoaded]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;
    localStorage.setItem(`deleted-cards-${sessionId}`, JSON.stringify([...deletedCardIds]));
  }, [deletedCardIds, sessionId, enabled]);

  const autoCards = useMemo(() => {
    if (!enabled) return [];

    const allCards: KnowledgeCard[] = [];

    // Only extract from main chat (not card-specific messages)
    const assistantMessages = messages.filter(
      (msg) => msg.role === 'assistant' && !msg.cardId && msg.content,
    );

    for (const msg of assistantMessages) {
      const { cards } = extractCards(msg.content);
      allCards.push(...cards.map((c) => ({ ...c, origin: c.origin ?? 'official' })));
    }

    // Deduplicate by title
    return Array.from(new Map(allCards.map((c) => [c.title, c])).values());
  }, [messages, enabled]);

  // Combine auto + manual - deleted
  const knowledgeCards = useMemo(() => {
    if (!enabled) return [];

    const combinedCards = [...autoCards, ...manualCards].filter(
      (card) => !deletedCardIds.has(card.id),
    );

    // Deduplicate by ID
    return Array.from(new Map(combinedCards.map((c) => [c.id, c])).values());
  }, [autoCards, manualCards, deletedCardIds, enabled]);

  // Add manual card with AI explanation
  const addManualCard = useCallback(
    (title: string, content: string, source?: KnowledgeCardSource): string => {
      if (!enabled) {
        return '';
      }

      const cardId = `manual-${Date.now()}`;
      const newCard: KnowledgeCard = {
        id: cardId,
        title: title.trim(),
        content: content.trim(),
        source,
        origin: 'user',
      };

      setManualCards((prev) => [...prev, newCard]);
      return cardId;
    },
    [enabled],
  );

  // Delete card
  const deleteCard = useCallback((cardId: string) => {
    setDeletedCardIds((prev) => new Set(prev).add(cardId));
  }, []);

  // Restore deleted card
  const restoreCard = useCallback((cardId: string) => {
    setDeletedCardIds((prev) => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  return {
    knowledgeCards,
    explainingCardIds,
    addManualCard,
    deleteCard,
    restoreCard,
  };
}
