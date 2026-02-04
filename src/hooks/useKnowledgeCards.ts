import { useCallback, useEffect, useMemo, useState } from 'react';
import { explainConcept } from '@/app/actions/chat';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage } from '@/types';

interface UseKnowledgeCardsOptions {
  sessionId: string;
  messages: ChatMessage[];
  courseCode: string;
  enabled: boolean; // Only enable for Lecture Helper and Assignment Coach
}

export function useKnowledgeCards({
  sessionId,
  messages,
  courseCode,
  enabled,
}: UseKnowledgeCardsOptions) {
  // User-managed cards (persisted to localStorage)
  const [manualCards, setManualCards] = useState<KnowledgeCard[]>(() => {
    if (typeof window === 'undefined' || !enabled) return [];
    try {
      const stored = localStorage.getItem(`knowledge-cards-${sessionId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track deleted card IDs
  const [deletedCardIds, setDeletedCardIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !enabled) return new Set();
    try {
      const stored = localStorage.getItem(`deleted-cards-${sessionId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track cards being explained by AI
  const [explainingCardIds, setExplainingCardIds] = useState<Set<string>>(new Set());

  // Save to localStorage when cards change
  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;
    localStorage.setItem(`knowledge-cards-${sessionId}`, JSON.stringify(manualCards));
  }, [manualCards, sessionId, enabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;
    localStorage.setItem(`deleted-cards-${sessionId}`, JSON.stringify([...deletedCardIds]));
  }, [deletedCardIds, sessionId, enabled]);

  // Extract auto-generated cards from main chat messages
  const autoCards = useMemo(() => {
    if (!enabled) return [];

    const allCards: KnowledgeCard[] = [];
    // Only extract from main chat (not card-specific messages)
    messages.forEach((msg) => {
      if (msg.role === 'assistant' && !msg.cardId) {
        const { cards } = extractCards(msg.content);
        allCards.push(...cards);
      }
    });

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
    async (
      title: string,
      content: string,
    ): Promise<{ success: boolean; error?: string; cardId?: string }> => {
      if (!enabled) return { success: false, error: 'Knowledge cards not enabled for this mode' };

      const cardId = `manual-${Date.now()}`;
      const newCard: KnowledgeCard = {
        id: cardId,
        title: title.trim(),
        content: content.trim(),
      };

      // Add card immediately with original content
      setManualCards((prev) => [...prev, newCard]);

      // Mark as explaining
      setExplainingCardIds((prev) => new Set(prev).add(cardId));

      try {
        const result = await explainConcept(title.trim(), content.trim(), courseCode);

        if (result.success) {
          // Update card with AI explanation
          setManualCards((prev) =>
            prev.map((card) =>
              card.id === cardId ? { ...card, content: result.explanation } : card,
            ),
          );
          return { success: true, cardId };
        } else if (result.error?.includes('Daily limit reached')) {
          return { success: false, error: 'limit' };
        } else {
          // Keep original content on other errors (silent fail)
          return { success: true, cardId }; // Still considered success since card was added
        }
      } catch (e) {
        console.error('Failed to explain concept:', e);
        return { success: true, cardId }; // Still considered success since card was added
      } finally {
        setExplainingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }
    },
    [courseCode, enabled],
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
