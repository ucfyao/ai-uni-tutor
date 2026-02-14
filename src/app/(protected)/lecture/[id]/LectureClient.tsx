'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import {
  getChatMessages,
  getChatSession,
  saveChatMessage,
  toggleSessionPin,
  updateChatSessionMode,
  updateChatSessionTitle,
} from '@/app/actions/chat';
import { ChatPageLayout } from '@/components/chat/ChatPageLayout';
import DeleteSessionModal from '@/components/DeleteSessionModal';
import { LectureHelper } from '@/components/modes/LectureHelper';
import RenameSessionModal from '@/components/RenameSessionModal';
import ShareModal from '@/components/ShareModal';
import { useSessions } from '@/context/SessionContext';
import { ChatSession } from '@/types';

interface LectureClientProps {
  id: string;
  initialSession: ChatSession;
}

export default function LectureClient({ id, initialSession }: LectureClientProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  const [session, setSession] = useState<ChatSession | null>(initialSession);
  const [loading, setLoading] = useState(false);

  // Track last saved message index to prevent duplicate saves (O(1) lookup)
  const lastSavedIndexRef = useRef(0);

  // Modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [knowledgeDrawerTrigger, setKnowledgeDrawerTrigger] = useState(0); // Increment to trigger drawer open

  const { removeSession, updateSessionLocal, sessions } = useSessions();
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Load session: use initialSession if matches id, otherwise use logic
  useEffect(() => {
    if (!id) return;

    // If initialSession matches the current id, we don't need to fetch
    if (initialSession && initialSession.id === id) {
      // Check if we need to update messages from sidebar list?
      // For now, assume initialSession is fresh from server.
      // But we still want to respect savedMsgIdsRef initialization
      lastSavedIndexRef.current = initialSession.messages.length;
      setSession(initialSession);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSession(null);
    lastSavedIndexRef.current = 0;

    // ... existing fetch logic for client-side navigation fallback ...
    let cancelled = false;

    (async () => {
      try {
        const fromList = sessionsRef.current.find((s) => s.id === id);
        if (fromList && fromList.mode === 'Lecture Helper') {
          const messages = await getChatMessages(id);
          if (cancelled) return;

          if (messages === null) {
            setLoading(false);
            routerRef.current.push('/study');
            return;
          }

          const data: ChatSession = { ...fromList, messages };
          lastSavedIndexRef.current = messages.length;
          setSession(data);
          setLoading(false);
          return;
        }

        const data = await getChatSession(id);
        if (cancelled) return;

        if (!data || (data.mode && data.mode !== 'Lecture Helper')) {
          setLoading(false);
          routerRef.current.push('/study');
          return;
        }

        lastSavedIndexRef.current = data.messages.length;
        setSession(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load lecture session', error);
        if (cancelled) return;
        setLoading(false);
        routerRef.current.push('/study');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, initialSession]);

  // Handle session updates (messages, mode changes, etc.)
  const handleUpdateSession = useCallback(
    async (updated: ChatSession, options?: { streamingMessageId?: string | null }) => {
      setSession(updated);

      // Save new messages that haven't been saved yet (slice from last saved index)
      const unsavedMessages = updated.messages.slice(lastSavedIndexRef.current);

      for (const msg of unsavedMessages) {
        if (!msg.content || msg.content.trim().length === 0) continue;

        // Don't persist the message that is still streaming; wait until stream completes (streamingMessageId null/undefined)
        if (options?.streamingMessageId != null && options.streamingMessageId === msg.id) continue;

        // Don't persist the "pending" user message until stream is accepted (avoids saving when quota/429)
        if (options?.streamingMessageId != null) {
          const streamIdx = updated.messages.findIndex((m) => m.id === options.streamingMessageId);
          if (streamIdx > 0 && updated.messages[streamIdx - 1].id === msg.id) continue;
        }

        try {
          await saveChatMessage(updated.id, msg);
          lastSavedIndexRef.current++;
        } catch (e) {
          console.error('Failed to save message:', e);
          break; // Stop saving on error to maintain consistency
        }
      }

      // Persist mode change
      if (session && updated.mode !== session.mode && updated.mode) {
        await updateChatSessionMode(updated.id, updated.mode).catch((e) => console.error(e));

        // Auto-rename if title still contains "New Session"
        if (session.title.includes('New Session')) {
          const newTitle = `${session.course.code} - ${updated.mode}`;

          await updateChatSessionTitle(updated.id, newTitle).catch((e) => console.error(e));

          // Update local page state
          const updatedWithTitle = { ...updated, title: newTitle };
          setSession(updatedWithTitle);

          // Update Sidebar Context immediately
          updateSessionLocal(updatedWithTitle);
        }
      }
    },
    [session, updateSessionLocal],
  );

  // Handle pin toggle
  const handleTogglePin = async () => {
    if (!session) return;

    const newPin = !session.isPinned;
    setSession({ ...session, isPinned: newPin });

    try {
      await toggleSessionPin(session.id, newPin);
      updateSessionLocal({ ...session, isPinned: newPin });
    } catch (e) {
      console.error('Failed to toggle pin:', e);
      // Revert on error
      setSession({ ...session, isPinned: !newPin });
    }
  };

  // Handle rename
  const handleRename = async (id: string, newTitle: string) => {
    if (!session) return;

    setSession({ ...session, title: newTitle });

    try {
      await updateChatSessionTitle(id, newTitle);
      updateSessionLocal({ ...session, title: newTitle });
    } catch (e) {
      console.error('Failed to rename:', e);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await removeSession(id);
      router.push('/study');
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  // Not found state
  if (!session) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md" ta="center">
          <Text size="xl" fw={700} c="dark.9">
            Session Not Found
          </Text>
          <Text c="dimmed">This lecture session could not be found.</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <ChatPageLayout
        session={session}
        onShare={() => setShareModalOpen(true)}
        onRename={() => setRenameModalOpen(true)}
        onPin={handleTogglePin}
        onDelete={() => setDeleteModalOpen(true)}
        showKnowledgePanel={true}
        onKnowledgePanelToggle={() => setKnowledgeDrawerTrigger((prev) => prev + 1)}
      >
        <LectureHelper
          key={session.id}
          session={session}
          onUpdateSession={handleUpdateSession}
          openDrawerTrigger={knowledgeDrawerTrigger}
        />
      </ChatPageLayout>

      <RenameSessionModal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        sessionId={session.id}
        currentTitle={session.title}
        onRename={handleRename}
      />

      <DeleteSessionModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        sessionId={session.id}
        onDelete={handleDelete}
      />

      <ShareModal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        session={session}
        onUpdateSession={(id, isShared) => {
          setSession((prev) => (prev ? { ...prev, isShared } : null));
        }}
      />
    </>
  );
}
