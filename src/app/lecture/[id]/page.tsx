'use client';

import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { Center, Loader, Stack, Text } from '@mantine/core';
import {
  deleteChatSession,
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

interface LecturePageProps {
  params: Promise<{ id: string }>;
}

export default function LecturePage({ params }: LecturePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Track saved message IDs to prevent duplicate saves
  const savedMsgIdsRef = useRef<Set<string>>(new Set());

  // Modal state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [knowledgeDrawerTrigger, setKnowledgeDrawerTrigger] = useState(0); // Increment to trigger drawer open

  const { updateSessionLocal, sessions } = useSessions();
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Load session: use metadata from list when available, only fetch messages. Run once per id to avoid double load when sessions context updates.
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setSession(null);
    savedMsgIdsRef.current = new Set();

    const load = async () => {
      const fromList = sessionsRef.current.find((s) => s.id === id);
      if (fromList && fromList.mode === 'Lecture Helper') {
        const messages = await getChatMessages(id);
        if (messages === null) {
          router.push('/');
          return;
        }
        const data: ChatSession = { ...fromList, messages };
        savedMsgIdsRef.current = new Set(messages.map((m) => m.id));
        setSession(data);
        setLoading(false);
        return;
      }

      const data = await getChatSession(id);
      if (!data) {
        router.push('/');
        return;
      }
      if (data.mode && data.mode !== 'Lecture Helper') {
        router.push('/');
        return;
      }
      savedMsgIdsRef.current = new Set(data.messages.map((m) => m.id));
      setSession(data);
      setLoading(false);
    };

    load();
  }, [id, router]);

  // Handle session updates (messages, mode changes, etc.)
  const handleUpdateSession = useCallback(
    async (updated: ChatSession, options?: { streamingMessageId?: string | null }) => {
      setSession(updated);

      // Save new messages that haven't been saved yet
      for (const msg of updated.messages) {
        if (savedMsgIdsRef.current.has(msg.id)) continue;
        if (!msg.content || msg.content.trim().length === 0) continue;

        // Don't persist the message that is still streaming; wait until stream completes (streamingMessageId null/undefined)
        if (options?.streamingMessageId != null && options.streamingMessageId === msg.id) continue;

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
      await deleteChatSession(id);
      router.push('/');
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
