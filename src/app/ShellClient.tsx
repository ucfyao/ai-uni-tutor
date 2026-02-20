'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AppShell, Box, Burger, Drawer, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { toggleSessionPin, updateChatSessionTitle } from '@/app/actions/chat';
import { getMockExamIdBySessionId } from '@/app/actions/mock-exams';
import DeleteSessionModal from '@/components/DeleteSessionModal';
import { Logo } from '@/components/Logo';
import MockExamModal from '@/components/MockExamModal';
import NewSessionModal from '@/components/NewSessionModal';
import RenameSessionModal from '@/components/RenameSessionModal';
import ShareModal from '@/components/ShareModal';
import Sidebar from '@/components/Sidebar';
import { MODES_METADATA } from '@/constants/modes';
import { useHeader } from '@/context/HeaderContext';
import { useSessions } from '@/context/SessionContext';
import { useSidebar } from '@/context/SidebarContext';
import { showNotification } from '@/lib/notifications';
import { TutoringMode } from '@/types/index';

export default function ShellClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { sessions, addSession, removeSession, updateSessionLocal } = useSessions();
  const { mobileOpened, toggleMobile } = useSidebar();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  useEffect(() => {
    const id =
      pathname?.match(/^\/(lecture|assignment)\/([^/]+)/)?.[2] ??
      pathname?.match(/^\/exam\/mock\/([^/]+)/)?.[1] ??
      null;
    setActiveSessionId(id);
  }, [pathname]);

  const { headerContent } = useHeader();

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [mockExamOpened, { open: openMockExam, close: closeMockExam }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const isMobile = useIsMobile();

  // Shared Modal State
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const toggleSidebar = () => (isMobile ? toggleMobile() : toggleDesktop());

  // Pre-selected mode for NewSessionModal (set by sidebar module [+] buttons)
  const [preSelectedMode, setPreSelectedMode] = useState<TutoringMode | null>(null);

  const openModalForMode = (mode: TutoringMode) => {
    if (mode === 'Mock Exam') {
      openMockExam();
      return;
    }
    setPreSelectedMode(mode);
    openModal();
  };

  const handleStartSession = async (courseId: string, mode: TutoringMode) => {
    closeModal();
    const newId = await addSession(courseId, mode);
    if (!newId) {
      showNotification({ title: 'Error', message: 'Failed to create session', color: 'red' });
      return;
    }

    // Chat modes: navigate to chat page
    const modeRoute = MODES_METADATA[mode].id;
    const targetPath = `/${modeRoute}/${newId}`;
    setActiveSessionId(newId);
    window.history.pushState(null, '', targetPath);
    router.push(targetPath);
  };

  const handleSelectSession = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session?.mode) {
      router.push(`/`);
      if (isMobile) toggleMobile();
      return;
    }

    if (session.mode === 'Mock Exam') {
      // Look up the mock exam ID linked to this session
      const mockId = await getMockExamIdBySessionId(id);
      if (mockId) {
        router.push(`/exam/mock/${mockId}`);
      } else {
        router.push('/exam');
      }
    } else {
      const modeRoute = MODES_METADATA[session.mode].id;
      router.push(`/${modeRoute}/${id}`);
    }
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
      router.push('/study');
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
          collapsed: { mobile: true }, // Always collapse navbar on mobile, use Drawer instead
        }}
        header={{ height: 52, collapsed: !isMobile }} // Enable header only on mobile
        padding={0}
      >
        <AppShell.Header
          hiddenFrom="sm"
          px="md"
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
        >
          <Group h="100%" align="center">
            <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
            {headerContent ? (
              <Box flex={1} style={{ overflow: 'hidden' }}>
                {headerContent}
              </Box>
            ) : (
              <Group gap={8} align="center">
                <Logo size={24} alt="Logo" />
                <Text fw={600} size="md">
                  AI Tutor
                </Text>
              </Group>
            )}
          </Group>
        </AppShell.Header>

        {/* Desktop Sidebar - Navbar */}
        <AppShell.Navbar bg="transparent" hiddenFrom="base" visibleFrom="sm">
          <Sidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={openModalForMode}
            onToggleSidebar={toggleDesktop}
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
            onGoHome={() => router.push('/study')}
            opened={desktopOpened}
          />
        </AppShell.Navbar>

        <AppShell.Main h="100dvh" pt={isMobile ? 52 : 0} pb={0}>
          {children}
        </AppShell.Main>
      </AppShell>

      {/* Mobile Sidebar - Drawer with swipe support */}
      <Drawer
        opened={mobileOpened}
        onClose={toggleMobile}
        size={260}
        padding={0}
        withCloseButton={false}
        hiddenFrom="sm"
        styles={{
          body: { padding: 0, height: '100%' },
          content: { height: '100%' },
        }}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={(mode: TutoringMode) => {
            openModalForMode(mode);
            toggleMobile();
          }}
          onToggleSidebar={toggleMobile}
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
          onGoHome={() => {
            router.push('/study');
            toggleMobile(); // Close sidebar on mobile after navigation
          }}
          opened={true}
        />
      </Drawer>

      <NewSessionModal
        opened={modalOpened}
        onClose={() => {
          closeModal();
          setPreSelectedMode(null);
        }}
        onStart={handleStartSession}
        preSelectedMode={preSelectedMode}
      />

      <MockExamModal opened={mockExamOpened} onClose={closeMockExam} />

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
