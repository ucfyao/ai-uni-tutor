import { useCallback, useEffect, useRef, useState } from 'react';
import { createUserCard, deleteUserCard } from '@/app/actions/knowledge-cards';
import type { UserCardEntity } from '@/types/user-card';

interface UseKnowledgeCardsOptions {
  initialUserCards?: UserCardEntity[];
}

export function useKnowledgeCards({ initialUserCards }: UseKnowledgeCardsOptions = {}) {
  const [userCards, setUserCards] = useState<UserCardEntity[]>(initialUserCards ?? []);

  // Sync when parent provides cards (initialUserCards: undefined → [] or [...])
  const hasReceivedCards = useRef(initialUserCards !== undefined);
  useEffect(() => {
    if (initialUserCards === undefined || hasReceivedCards.current) return;
    hasReceivedCards.current = true;
    setUserCards(initialUserCards);
  }, [initialUserCards]);

  // Map temp IDs to promises that resolve with real IDs
  const pendingCardsRef = useRef<Map<string, Promise<string | null>>>(new Map());

  // Allow parent to set cards (e.g. from combined server fetch)
  const setInitialCards = useCallback((cards: UserCardEntity[]) => {
    setUserCards(cards);
  }, []);

  // Create a user card with optimistic update — returns temp ID immediately
  const addManualCard = useCallback(
    (
      title: string,
      content: string,
      sessionId: string,
      source?: { messageId?: string; role?: 'user' | 'assistant' },
    ): string | null => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const optimisticCard: UserCardEntity = {
        id: tempId,
        userId: '',
        sessionId,
        title: title.trim(),
        content: '',
        excerpt: content,
        sourceMessageId: source?.messageId ?? null,
        sourceRole: source?.role ?? null,
        createdAt: new Date(),
      };

      // Immediately add to list
      setUserCards((prev) => [...prev, optimisticCard]);

      // Persist in background, replace temp card with real data
      const pendingPromise = createUserCard({
        sessionId,
        title: title.trim(),
        excerpt: content,
        sourceMessageId: source?.messageId,
        sourceRole: source?.role,
      }).then((result) => {
        pendingCardsRef.current.delete(tempId);
        if (result.success) {
          setUserCards((prev) => prev.map((c) => (c.id === tempId ? result.data : c)));
          return result.data.id;
        } else {
          // Remove optimistic card on failure
          setUserCards((prev) => prev.filter((c) => c.id !== tempId));
          return null;
        }
      });

      pendingCardsRef.current.set(tempId, pendingPromise);
      return tempId;
    },
    [],
  );

  // Resolve a card ID — if it's a temp ID, wait for the real ID
  const resolveCardId = useCallback(async (cardId: string): Promise<string | null> => {
    if (!cardId.startsWith('temp_')) return cardId;
    const pending = pendingCardsRef.current.get(cardId);
    if (pending) return pending;
    return null;
  }, []);

  // Delete a user card via server action
  const deleteCard = useCallback(async (cardId: string) => {
    if (cardId.startsWith('temp_')) {
      setUserCards((prev) => prev.filter((c) => c.id !== cardId));
      return;
    }
    const result = await deleteUserCard(cardId);
    if (result.success) {
      setUserCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  }, []);

  return {
    userCards,
    setInitialCards,
    addManualCard,
    resolveCardId,
    deleteCard,
  };
}
