'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Center, Loader } from '@mantine/core';
import {
  deleteChatSession,
  getChatSession,
  saveChatMessage,
  toggleSessionPin,
  updateChatSessionMode,
  updateChatSessionTitle,
} from '@/app/actions/chat';
import ChatInterface from '@/components/ChatInterface';
import DeleteSessionModal from '@/components/DeleteSessionModal';
import RenameSessionModal from '@/components/RenameSessionModal';
import ShareModal from '@/components/ShareModal';
import { useSessions } from '@/context/SessionContext';
import { ChatSession } from '@/types/index';

export default function ChatPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Local Modal State (since ChatInterface props require callbacks that might trigger these)
  // Actually, ChatInterface just calls callbacks. We can implement them here.
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const data = await getChatSession(id);
      if (!data) {
        // Handle 404
        router.push('/');
        return;
      }
      setSession(data);
      setLoading(false);
    };
    load();
  }, [id, router]);

  const { updateSessionLocal } = useSessions();

  const handleUpdateSession = async (updated: ChatSession) => {
    setSession(updated);

    // Identify new message(s) to save
    if (session && updated.messages.length > session.messages.length) {
      const newMsgs = updated.messages.slice(session.messages.length);
      for (const msg of newMsgs) {
        await saveChatMessage(updated.id, msg).catch((e) => console.error(e));
      }
    }

    // Persist mode change
    if (session && updated.mode !== session.mode && updated.mode) {
      await updateChatSessionMode(updated.id, updated.mode).catch((e) => console.error(e));

      // Auto-rename
      // Check if title contains "New Session" (robust to dash/spaces) or is new
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
  };

  if (loading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (!session) return <Center>Session not found</Center>;

  // Mode-specific styling or components could go here.
  // User asked "Different mode should enter different page. Their styles are different."
  // For now, we use ChatInterface for all, but we can wrap it or pass different props based on `session.mode`.
  // Example: <Box className={session.mode === 'Assignment Coach' ? 'assignment-theme' : ''}> ...

  return (
    <>
      <ChatInterface
        session={session}
        onUpdateSession={handleUpdateSession}
        onRenameSession={() => setRenameModalOpen(true)}
        onDeleteSession={() => setDeleteModalOpen(true)}
        onShareSession={() => setShareModalOpen(true)}
        onTogglePin={async () => {
          const newPin = !session.isPinned;
          setSession({ ...session, isPinned: newPin });
          await toggleSessionPin(session.id, newPin);
        }}
      />

      <RenameSessionModal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        sessionId={session.id}
        currentTitle={session.title}
        onRename={async (id, newTitle) => {
          setSession((prev) => (prev ? { ...prev, title: newTitle } : null));
          await updateChatSessionTitle(id, newTitle);
        }}
      />

      <DeleteSessionModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        sessionId={session.id}
        onDelete={async (id) => {
          await deleteChatSession(id);
          router.push('/');
        }}
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
