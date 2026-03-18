import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatSession } from '@/types';

interface SessionUpdateOptions {
  /** When set, parent should not persist this message yet (streaming). Use null on stream complete to persist. */
  streamingMessageId?: string | null;
  /** When set, parent resets its saved-message index to this value (used after edit/branch-switch replaces messages). */
  resetSavedIndex?: number;
}

interface UseChatSessionOptions {
  initialSession?: ChatSession | null;
  onSessionUpdate?: (session: ChatSession, options?: SessionUpdateOptions) => void | Promise<void>;
}

export function useChatSession({ initialSession, onSessionUpdate }: UseChatSessionOptions = {}) {
  const [session, setSession] = useState<ChatSession | null>(initialSession || null);
  const sessionRef = useRef<ChatSession | null>(initialSession || null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Sync with parent when initialSession changes (e.g. page loaded session, server fetch returned messages)
  useEffect(() => {
    if (!initialSession) return;

    const current = sessionRef.current;

    // Different session ID — always sync
    if (initialSession.id !== current?.id) {
      sessionRef.current = initialSession;
      setSession(initialSession);
      return;
    }

    // Same session — sync when parent has more messages (e.g. server fetch returned)
    if (current && initialSession.messages.length > current.messages.length) {
      sessionRef.current = initialSession;
      setSession(initialSession);
    }
  }, [initialSession, initialSession?.id, initialSession?.messages.length]);

  // Update session and notify parent. Keeps allMessages in sync with messages.
  const updateSession = useCallback(
    (updatedSession: ChatSession, options?: SessionUpdateOptions): void | Promise<void> => {
      // Merge messages into allMessages so branch switching stays up-to-date.
      // Must also update existing entries (e.g. streamed assistant messages whose
      // content was empty when first added but now has final content).
      if (updatedSession.allMessages) {
        const activeMsgMap = new Map(updatedSession.messages.map((m) => [m.id, m]));
        const existingIds = new Set(updatedSession.allMessages.map((m) => m.id));
        const newMsgs = updatedSession.messages.filter((m) => !existingIds.has(m.id));
        // Check if any existing entry needs updating (content changed)
        const hasUpdates = updatedSession.allMessages.some((m) => {
          const active = activeMsgMap.get(m.id);
          return active && active.content !== m.content;
        });
        if (newMsgs.length > 0 || hasUpdates) {
          const merged = updatedSession.allMessages.map((m) => activeMsgMap.get(m.id) ?? m);
          updatedSession = {
            ...updatedSession,
            allMessages: newMsgs.length > 0 ? [...merged, ...newMsgs] : merged,
          };
        }
      }
      sessionRef.current = updatedSession;
      setSession(updatedSession);
      return onSessionUpdate?.(updatedSession, options);
    },
    [onSessionUpdate],
  );

  // Add message to session
  const addMessage = useCallback(
    (message: ChatMessage) => {
      const current = sessionRef.current;
      if (!current) return;
      const updatedSession = {
        ...current,
        messages: [...current.messages, message],
        lastUpdated: Date.now(),
      };
      updateSession(updatedSession);
    },
    [updateSession],
  );

  // Update last message (for streaming). Uses sessionRef so streaming callbacks see the latest session (e.g. after setSession added user+assistant messages) before React has re-rendered.
  const updateLastMessage = useCallback(
    (content: string, streamingMessageId?: string | null): void | Promise<void> => {
      const current = sessionRef.current;
      if (!current || current.messages.length === 0) return;
      const messages = [...current.messages];
      const lastIndex = messages.length - 1;
      // When stream completes (streamingMessageId === null), stamp the real finish time
      // so the assistant message gets a later created_at than the user message in the DB.
      const timestamp = streamingMessageId === null ? Date.now() : messages[lastIndex].timestamp;
      messages[lastIndex] = { ...messages[lastIndex], content, timestamp };

      const updatedSession = {
        ...current,
        messages,
        lastUpdated: Date.now(),
      };
      return updateSession(updatedSession, { streamingMessageId });
    },
    [updateSession],
  );

  // Remove last N messages (for retry or error handling)
  const removeMessages = useCallback(
    (count: number = 1) => {
      const current = sessionRef.current;
      if (!current || current.messages.length === 0) return;
      const updatedSession = {
        ...current,
        messages: current.messages.slice(0, -count),
        lastUpdated: Date.now(),
      };
      updateSession(updatedSession);
    },
    [updateSession],
  );

  // Remove last message (convenience wrapper)
  const removeLastMessage = useCallback(() => removeMessages(1), [removeMessages]);

  // Update session metadata
  const updateMetadata = useCallback(
    (updates: Partial<Pick<ChatSession, 'title' | 'mode' | 'isPinned' | 'isShared'>>) => {
      const current = sessionRef.current;
      if (!current) return;
      const updatedSession = {
        ...current,
        ...updates,
        lastUpdated: Date.now(),
      };
      updateSession(updatedSession);
    },
    [updateSession],
  );

  return {
    session,
    setSession: updateSession,
    addMessage,
    updateLastMessage,
    removeLastMessage,
    removeMessages,
    updateMetadata,
  };
}
