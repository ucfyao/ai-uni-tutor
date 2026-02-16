import { useCallback, useEffect, useState } from 'react';
import {
  createUserCard,
  deleteUserCard,
  fetchRelatedCards,
  fetchUserCards,
} from '@/app/actions/knowledge-cards';
import type { KnowledgeCardSummary } from '@/lib/domain/models/KnowledgeCard';
import type { UserCardEntity } from '@/lib/domain/models/UserCard';

interface UseKnowledgeCardsOptions {
  sessionId: string;
  enabled: boolean;
}

export function useKnowledgeCards({ sessionId, enabled }: UseKnowledgeCardsOptions) {
  const [officialCards, setOfficialCards] = useState<KnowledgeCardSummary[]>([]);
  const [userCards, setUserCards] = useState<UserCardEntity[]>([]);

  // Load user cards from DB on mount
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    (async () => {
      const result = await fetchUserCards(sessionId);
      if (!cancelled && result.success) {
        setUserCards(result.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, enabled]);

  // Load official (related) cards for a query
  const loadRelatedCards = useCallback(
    async (query: string) => {
      if (!enabled || !query.trim()) return;
      const result = await fetchRelatedCards(query);
      if (result.success) {
        setOfficialCards(result.data);
      }
    },
    [enabled],
  );

  // Create a user card via server action
  const addManualCard = useCallback(
    async (
      title: string,
      content: string,
      source?: { messageId?: string; role?: 'user' | 'assistant' },
    ): Promise<string | null> => {
      if (!enabled) return null;

      const result = await createUserCard({
        sessionId,
        title: title.trim(),
        sourceMessageId: source?.messageId,
        sourceRole: source?.role,
      });

      if (result.success) {
        setUserCards((prev) => [...prev, result.data]);
        return result.data.id;
      }
      return null;
    },
    [sessionId, enabled],
  );

  // Delete a user card via server action
  const deleteCard = useCallback(async (cardId: string) => {
    const result = await deleteUserCard(cardId);
    if (result.success) {
      setUserCards((prev) => prev.filter((c) => c.id !== cardId));
    }
  }, []);

  return {
    officialCards,
    userCards,
    loadRelatedCards,
    addManualCard,
    deleteCard,
  };
}
