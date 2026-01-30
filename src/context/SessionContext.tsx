'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ChatSession, Course, TutoringMode } from '@/types/index';
import { getChatSessions, createChatSession, deleteChatSession, updateChatSessionTitle, toggleSessionPin } from '@/app/actions/chat';
import { useRouter } from 'next/navigation';

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
    const router = useRouter();

    const fetchSessions = useCallback(async () => {
        try {
            const data = await getChatSessions();
            setSessions(data);
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Sort Helper
    const sortSessions = (list: ChatSession[]) => {
        return [...list].sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.lastUpdated - a.lastUpdated;
        });
    };

    const addSession = async (course: Course, mode: TutoringMode | null): Promise<string | null> => {
        const tempId = `temp_${Date.now()}`;
        const title = mode ? `${course.code} - ${mode}` : `${course.code} - New Session`;
        const newSessionPayload: ChatSession = {
            id: tempId,
            course,
            mode,
            title,
            messages: [],
            lastUpdated: Date.now(),
            isPinned: false
        };

        // Optimistic
        setSessions(prev => sortSessions([newSessionPayload, ...prev]));

        try {
            const created = await createChatSession(newSessionPayload);
            setSessions(prev => {
                const replaced = prev.map(s => s.id === tempId ? created : s);
                return sortSessions(replaced);
            });
            return created.id;
        } catch (e) {
            console.error("Failed to create session", e);
            // Revert
            setSessions(prev => prev.filter(s => s.id !== tempId));
            return null;
        }
    };

    const removeSession = async (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
        try {
            await deleteChatSession(id);
        } catch (e) {
            console.error("Failed to delete", e);
        }
    };

    const updateSessionLocal = (updated: ChatSession) => {
        setSessions(prev => {
             const list = prev.map(s => s.id === updated.id ? updated : s);
             return sortSessions(list);
        });
    };

    const refreshSessions = async () => {
        await fetchSessions();
    };

    return (
        <SessionContext.Provider value={{ sessions, addSession, removeSession, updateSessionLocal, refreshSessions, loading }}>
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
