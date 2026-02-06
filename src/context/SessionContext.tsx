'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createChatSession, deleteChatSession, getChatSessions } from '@/app/actions/chat';
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getChatSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(); // Initial fetch

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchSessions();
      } else if (event === 'SIGNED_OUT') {
        setSessions([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSessions, supabase]);

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
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteChatSession(id);
    } catch (e) {
      console.error('Failed to delete', e);
    }
  }, []);

  const updateSessionLocal = useCallback(
    (updated: ChatSession) => {
      setSessions((prev) => {
        const list = prev.map((s) => (s.id === updated.id ? updated : s));
        return sortSessions(list);
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
