'use client';

import Image from 'next/image';
import { useParams, usePathname, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { AppShell, Box, Burger, Group, Text } from '@mantine/core'; // Added Burger, Group, Text
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
// import { getChatSessions, createChatSession, toggleSessionPin, updateChatSessionTitle, deleteChatSession } from '@/app/actions/chat'; // Moved to Context
import { toggleSessionPin, updateChatSessionTitle } from '@/app/actions/chat'; // Actually toggle/update/delete are still used here for async calls, but Context handles state.
import DeleteSessionModal from '@/components/DeleteSessionModal';
import NewSessionModal from '@/components/NewSessionModal';
import RenameSessionModal from '@/components/RenameSessionModal';
import ShareModal from '@/components/ShareModal';
import Sidebar from '@/components/Sidebar';
import { useHeader } from '@/context/HeaderContext';
// Wait, I updated Shell to call asyncs directly?
// Yes: `try { await toggleSessionPin(id, isPinned); }`
// So I need to keep those imports. But `getChatSessions` and `createChatSession` are removed.
import { useSessions } from '@/context/SessionContext';
import { useSidebar } from '@/context/SidebarContext';
import { showNotification } from '@/lib/notifications';
import { Course, TutoringMode } from '@/types/index';

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  // Extract active ID from URL if present
  const activeSessionId = (params?.id as string) || null;

  const { sessions, addSession, removeSession, updateSessionLocal } = useSessions();
  const { mobileOpened, toggleMobile } = useSidebar();
  const { headerContent } = useHeader();

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const isMobile = useMediaQuery('(max-width: 48em)');

  // Shared Modal State
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const toggleSidebar = () => (isMobile ? toggleMobile() : toggleDesktop());
  const isChatRoute = pathname?.startsWith('/chat/');

  const handleStartSession = async (course: Course, mode: TutoringMode | null) => {
    closeModal();
    const newId = await addSession(course, mode);
    if (newId) {
      router.push(`/chat/${newId}`);
    } else {
      showNotification({ title: 'Error', message: 'Failed to create session', color: 'red' });
    }
  };

  const handleSelectSession = (id: string) => {
    router.push(`/chat/${id}`);
    if (isMobile) toggleMobile();
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    // Optimistic provided by Context? No, context exposes updateSessionLocal.
    const session = sessions.find((s) => s.id === id);
    if (session) {
      updateSessionLocal({ ...session, isPinned });
    }
    try {
      await toggleSessionPin(id, isPinned);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      updateSessionLocal({ ...session, title: newTitle });
    }
    try {
      await updateChatSessionTitle(id, newTitle);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (id: string) => {
    // Optimistic provided by Context removeSession
    await removeSession(id);
    if (activeSessionId === id || pathname.includes(id)) {
      router.push('/');
    }
  };

  const handleShareSession = (id: string) => {
    setShareId(id);
    setShareModalOpen(true);
  };

  return (
    <>
      <AppShell
        navbar={{
          width: desktopOpened ? 260 : 60,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened },
        }}
        header={{ height: 50, collapsed: !isMobile }} // Enable header only on mobile
        padding={0}
        bg="gray.0"
      >
        <AppShell.Header
          hiddenFrom="sm"
          px="md"
          bg="white"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
        >
          <Group h="100%" align="center">
            <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
            {headerContent ? (
              <Box flex={1} style={{ overflow: 'hidden' }}>
                {headerContent}
              </Box>
            ) : (
              <Group gap={8} align="center">
                <Image src="/assets/logo.png" alt="Logo" width={24} height={24} />
                <Text fw={600} size="md">
                  AI Tutor
                </Text>
              </Group>
            )}
          </Group>
        </AppShell.Header>

        <AppShell.Navbar bg="transparent">
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={() => {
              openModal();
              if (isMobile) toggleMobile();
            }}
            onToggleSidebar={toggleSidebar}
            onTogglePin={handleTogglePin}
            onRenameSession={(id) => {
              setRenameId(id);
              setRenameModalOpen(true);
            }}
            onDeleteSession={(id) => {
              setDeleteId(id);
              setDeleteModalOpen(true);
            }}
            onShareSession={handleShareSession}
            onGoHome={() => router.push('/')}
            opened={isMobile ? true : desktopOpened}
          />
        </AppShell.Navbar>

        <AppShell.Main h="100dvh" bg="white" pt={isMobile && !isChatRoute ? 50 : 0} pb={0}>
          {children}
        </AppShell.Main>
      </AppShell>

      <NewSessionModal opened={modalOpened} onClose={closeModal} onStart={handleStartSession} />

      <RenameSessionModal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        sessionId={renameId}
        currentTitle={sessions.find((s) => s.id === renameId)?.title || ''}
        onRename={handleRenameSession}
      />

      <DeleteSessionModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        sessionId={deleteId}
        onDelete={handleDeleteSession}
      />

      <ShareModal
        opened={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        session={sessions.find((s) => s.id === shareId) || null}
        onUpdateSession={(id, isShared) => {
          const session = sessions.find((s) => s.id === id);
          if (session) updateSessionLocal({ ...session, isShared });
        }}
      />
    </>
  );
}
