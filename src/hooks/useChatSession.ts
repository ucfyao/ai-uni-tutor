import { useCallback, useEffect, useRef, useState } from 'react';
import { chatCache } from '@/lib/chat-cache';
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

  // Sync with parent when initialSession changes (e.g. page loaded session, or navigated to different session)
  useEffect(() => {
    if (initialSession && initialSession.id !== sessionRef.current?.id) {
      sessionRef.current = initialSession;
      setSession(initialSession);
    }
  }, [initialSession, initialSession?.id]);

  // Debounced write to IndexedDB cache whenever messages change
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session?.id || session.messages.length === 0) return;

    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);

    debouncedSaveRef.current = setTimeout(() => {
      chatCache.saveMessages(session.id, session.messages);
    }, 500);

    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    };
  }, [session?.id, session?.messages]);

  // Update session and notify parent. Returns parent's promise so caller can await save.
  const updateSession = useCallback(
    (updatedSession: ChatSession, options?: SessionUpdateOptions): void | Promise<void> => {
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
