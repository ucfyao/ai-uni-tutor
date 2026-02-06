import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatSession } from '@/types';

export interface SessionUpdateOptions {
  /** When set, parent should not persist this message yet (streaming). Use null on stream complete to persist. */
  streamingMessageId?: string | null;
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
      messages[lastIndex] = { ...messages[lastIndex], content };

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
