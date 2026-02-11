'use client';

import type { AuthChangeEvent } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { createChatSession, deleteChatSession, getChatSessions } from '@/app/actions/chat';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
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

function sortSessions(list: ChatSession[]) {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.lastUpdated - a.lastUpdated;
  });
}

export function SessionProvider({
  children,
  initialSessions = [],
}: {
  children: React.ReactNode;
  initialSessions?: ChatSession[];
}) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  // useQuery replaces manual fetch + dedup logic
  const { data: sessions = initialSessions, isLoading } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: getChatSessions,
    initialData: initialSessions,
  });

  // Refetch sessions on auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      } else if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(queryKeys.sessions.all, []);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase & queryClient are stable
  }, []);

  // Create session mutation with optimistic update
  const createMutation = useMutation({
    mutationFn: (payload: ChatSession) => createChatSession(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions.all });
      const previous = queryClient.getQueryData<ChatSession[]>(queryKeys.sessions.all);
      queryClient.setQueryData<ChatSession[]>(queryKeys.sessions.all, (old) =>
        sortSessions([payload, ...(old ?? [])]),
      );
      return { previous, tempId: payload.id };
    },
    onSuccess: (created, _payload, context) => {
      queryClient.setQueryData<ChatSession[]>(queryKeys.sessions.all, (old) =>
        sortSessions((old ?? []).map((s) => (s.id === context?.tempId ? created : s))),
      );
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.sessions.all, context.previous);
      }
    },
  });

  // Delete session mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChatSession(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.sessions.all });
      const previous = queryClient.getQueryData<ChatSession[]>(queryKeys.sessions.all);
      queryClient.setQueryData<ChatSession[]>(queryKeys.sessions.all, (old) =>
        old?.filter((s) => s.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.sessions.all, context.previous);
      }
      showNotification({
        title: 'Delete failed',
        message: 'Could not delete the chat session. Please try again.',
        color: 'red',
      });
    },
  });

  const addSession = useCallback(
    async (course: Course, mode: TutoringMode | null): Promise<string | null> => {
      const tempId = `temp_${Date.now()}`;
      const title = mode ? `${course.code} - ${mode}` : `${course.code} - New Session`;
      const payload: ChatSession = {
        id: tempId,
        course,
        mode,
        title,
        messages: [],
        lastUpdated: Date.now(),
        isPinned: false,
      };

      try {
        const created = await createMutation.mutateAsync(payload);
        return created.id;
      } catch (e) {
        console.error('Failed to create session', e);
        return null;
      }
    },
    [createMutation],
  );

  const removeSession = useCallback(
    async (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const updateSessionLocal = useCallback(
    (updated: ChatSession) => {
      queryClient.setQueryData<ChatSession[]>(queryKeys.sessions.all, (prev) => {
        if (!prev) return prev;
        const prevSession = prev.find((s) => s.id === updated.id);
        const list = prev.map((s) => (s.id === updated.id ? updated : s));
        const orderChanged =
          prevSession &&
          (prevSession.isPinned !== updated.isPinned ||
            prevSession.lastUpdated !== updated.lastUpdated);
        return orderChanged ? sortSessions(list) : list;
      });
    },
    [queryClient],
  );

  const refreshSessions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
  }, [queryClient]);

  return (
    <SessionContext.Provider
      value={{
        sessions: sortSessions(sessions),
        addSession,
        removeSession,
        updateSessionLocal,
        refreshSessions,
        loading: isLoading,
      }}
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
