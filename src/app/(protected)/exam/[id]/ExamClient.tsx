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
import { ExamPrep } from '@/components/modes/ExamPrep';
import RenameSessionModal from '@/components/RenameSessionModal';
import ShareModal from '@/components/ShareModal';
import { useSessions } from '@/context/SessionContext';
import { ChatSession } from '@/types';

interface ExamClientProps {
  id: string;
}

export default function ExamClient({ id }: ExamClientProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Track saved message IDs to prevent duplicate saves
  const savedMsgIdsRef = useRef<Set<string>>(new Set());

  // Modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { removeSession, updateSessionLocal, sessions } = useSessions();
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Load session: use metadata from list when available, only fetch messages. Run once per id to avoid double load when sessions context updates.
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setSession(null);
    savedMsgIdsRef.current = new Set();

    let cancelled = false;

    (async () => {
      try {
        const fromList = sessionsRef.current.find((s) => s.id === id);
        if (fromList && fromList.mode === 'Exam Prep') {
          const messages = await getChatMessages(id);
          if (cancelled) return;

          if (messages === null) {
            setLoading(false);
            routerRef.current.push('/study');
            return;
          }

          const data: ChatSession = { ...fromList, messages };
          savedMsgIdsRef.current = new Set(messages.map((m) => m.id));
          setSession(data);
          setLoading(false);
          return;
        }

        const data = await getChatSession(id);
        if (cancelled) return;

        if (!data || (data.mode && data.mode !== 'Exam Prep')) {
          setLoading(false);
          routerRef.current.push('/study');
          return;
        }

        savedMsgIdsRef.current = new Set(data.messages.map((m) => m.id));
        setSession(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load exam session', error);
        if (cancelled) return;
        setLoading(false);
        routerRef.current.push('/study');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Handle session updates
  const handleUpdateSession = useCallback(
    async (updated: ChatSession, options?: { streamingMessageId?: string | null }) => {
      setSession(updated);

      for (const msg of updated.messages) {
        if (savedMsgIdsRef.current.has(msg.id)) continue;
        if (!msg.content || msg.content.trim().length === 0) continue;
        if (options?.streamingMessageId != null && options.streamingMessageId === msg.id) continue;

        if (options?.streamingMessageId != null) {
          const streamIdx = updated.messages.findIndex((m) => m.id === options.streamingMessageId);
          if (streamIdx > 0 && updated.messages[streamIdx - 1].id === msg.id) continue;
        }

        savedMsgIdsRef.current.add(msg.id);

        try {
          await saveChatMessage(updated.id, msg);
        } catch (e) {
          savedMsgIdsRef.current.delete(msg.id);
          console.error('Failed to save message:', e);
        }
      }

      // Persist mode change
      if (session && updated.mode !== session.mode && updated.mode) {
        await updateChatSessionMode(updated.id, updated.mode).catch((e) => console.error(e));

        if (session.title.includes('New Session')) {
          const newTitle = `${session.course.code} - ${updated.mode}`;
          await updateChatSessionTitle(updated.id, newTitle).catch((e) => console.error(e));

          const updatedWithTitle = { ...updated, title: newTitle };
          setSession(updatedWithTitle);
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

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  if (!session) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md" ta="center">
          <Text size="xl" fw={700} c="dark.9">
            Session Not Found
          </Text>
          <Text c="dimmed">This exam prep session could not be found.</Text>
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
        showKnowledgePanel={false} // Exam Prep does NOT have knowledge panel
      >
        <ExamPrep session={session} onUpdateSession={handleUpdateSession} />
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
