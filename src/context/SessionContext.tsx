'use client';

import type { AuthChangeEvent } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createChatSession, deleteChatSession, getChatSessions } from '@/app/actions/chat';
import { showNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';
import { ChatSession, Course, TutoringMode } from '@/types/index';

interface SessionContextType {
  sessions: ChatSession[];
  addSession: (course: Course, mode: TutoringMode | null) => Promise<string | null>;
  removeSession: (id: string) => Promise<void>;
  updateSessionLocal: (session: ChatSession) => void;
  refreshSessions: () => Promise<void>;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({
  children,
  initialSessions = [],
}: {
  children: React.ReactNode;
  initialSessions?: ChatSession[];
}) {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);

  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const fetchInFlightRef = useRef<Promise<void> | null>(null);

  const fetchSessions = useCallback((): Promise<void> => {
    if (fetchInFlightRef.current) return fetchInFlightRef.current;

    fetchInFlightRef.current = (async () => {
      try {
        const data = await getChatSessions();
        setSessions(data);
      } catch (error) {
        console.error('Failed to fetch sessions', error);
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      fetchInFlightRef.current = null;
    });

    return fetchInFlightRef.current;
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchSessions();
      } else if (event === 'SIGNED_OUT') {
        setSessions([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // supabase is referentially stable (useMemo), so omitted from deps to avoid redundant effect runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSessions]);

  // Sort Helper
  const sortSessions = useCallback((list: ChatSession[]) => {
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.lastUpdated - a.lastUpdated;
    });
  }, []);

  const addSession = useCallback(
    async (course: Course, mode: TutoringMode | null): Promise<string | null> => {
      const tempId = `temp_${Date.now()}`;
      const title = mode ? `${course.code} - ${mode}` : `${course.code} - New Session`;
      const newSessionPayload: ChatSession = {
        id: tempId,
        course,
        mode,
        title,
        messages: [],
        lastUpdated: Date.now(),
        isPinned: false,
      };

      // Optimistic
      setSessions((prev) => sortSessions([newSessionPayload, ...prev]));

      try {
        const created = await createChatSession(newSessionPayload);
        setSessions((prev) => {
          const replaced = prev.map((s) => (s.id === tempId ? created : s));
          return sortSessions(replaced);
        });
        return created.id;
      } catch (e) {
        console.error('Failed to create session', e);
        // Revert
        setSessions((prev) => prev.filter((s) => s.id !== tempId));
        return null;
      }
    },
    [sortSessions],
  );

  const removeSession = useCallback(async (id: string) => {
    let previousSessions: ChatSession[] | null = null;
    setSessions((prev) => {
      previousSessions = prev;
      return prev.filter((s) => s.id !== id);
    });
    try {
      await deleteChatSession(id);
    } catch (e) {
      console.error('Failed to delete', e);
      if (previousSessions) {
        setSessions(previousSessions);
      }
      showNotification({
        title: 'Delete failed',
        message: 'Could not delete the chat session. Please try again.',
        color: 'red',
      });
    }
  }, []);

  const updateSessionLocal = useCallback(
    (updated: ChatSession) => {
      setSessions((prev) => {
        const prevSession = prev.find((s) => s.id === updated.id);
        const list = prev.map((s) => (s.id === updated.id ? updated : s));
        const orderChanged =
          prevSession &&
          (prevSession.isPinned !== updated.isPinned ||
            prevSession.lastUpdated !== updated.lastUpdated);
        return orderChanged ? sortSessions(list) : list;
      });
    },
    [sortSessions],
  );

  const refreshSessions = useCallback(async () => {
    await fetchSessions();
  }, [fetchSessions]);

  return (
    <SessionContext.Provider
      value={{ sessions, addSession, removeSession, updateSessionLocal, refreshSessions, loading }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessions() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessions must be used within a SessionProvider');
  }
  return context;
}
