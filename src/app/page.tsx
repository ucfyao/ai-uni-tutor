'use client';

import React, { useState, useEffect } from 'react';
import { AppShell, Stack, Center, Text, Button, ThemeIcon, Box, Title, Container, Tooltip, ActionIcon, Transition, Paper } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import Sidebar from '../components/Sidebar';
import NewSessionModal from '../components/NewSessionModal';
import ChatInterface from '../components/ChatInterface';
import RenameSessionModal from '../components/RenameSessionModal';
import DeleteSessionModal from '../components/DeleteSessionModal';
import ShareModal from '../components/ShareModal';
import { ChatSession, Course, TutoringMode } from '../types/index';
import { GraduationCap, Plus, PanelLeftOpen } from 'lucide-react';
import { getChatSessions, createChatSession, saveChatMessage, toggleSessionPin, updateChatSessionTitle, deleteChatSession, updateChatSessionMode } from './actions/chat';

export default function Page() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 48em)');

  // Shared Modal State
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const toggleSidebar = () => {
    if (isMobile) {
      toggleMobile();
    } else {
      toggleDesktop();
    }
  };

  useEffect(() => {
    const loadSessions = async () => {
        const dbSessions = await getChatSessions();
        setSessions(dbSessions);
        // If there are sessions, select the first one? Or none?
        // Default to none to show the "Ready to Learn?" screen, unless user was active?
        // Let's leave activeSessionId null initially.
    };
    loadSessions();
  }, []);

  // Helper Sort Function
  const sortSessions = (list: ChatSession[]) => {
      return [...list].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.lastUpdated - a.lastUpdated;
      });
  };

  const handleStartSession = async (course: Course, mode: TutoringMode | null) => {
    const tempId = `temp_${Date.now()}`;
    const title = mode ? `${course.code} - ${mode}` : `${course.code} - New Session`;
    const newSessionPayload: ChatSession = {
        id: tempId, // Temporary ID until confirmed by DB
        course,
        mode,
        title: title,
        messages: [],
        lastUpdated: Date.now(),
        isPinned: false
    };
    
    // Optimistic update with correct sort
    setSessions(prev => sortSessions([newSessionPayload, ...prev]));
    setActiveSessionId(tempId);
    closeModal();

    try {
        const createdSession = await createChatSession(newSessionPayload);
        setSessions(prev => prev.map(s => s.id === tempId ? createdSession : s));
        setActiveSessionId(createdSession.id);
    } catch (e) {
        console.error("Failed to create session", e);
        // Revert?
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    // Optimistic update & sort
    setSessions(prev => {
        const updated = prev.map(s => s.id === id ? { ...s, isPinned } : s);
        return sortSessions(updated);
    });
    
    try {
        await toggleSessionPin(id, isPinned);
    } catch (e) {
        console.error("Failed to toggle pin", e);
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    try {
        await updateChatSessionTitle(id, newTitle);
    } catch (e) {
        console.error("Failed to rename session", e);
    }
  };

  const handleDeleteSession = async (id: string) => {
    // Optimistic update
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
        setActiveSessionId(null);
    }
    
    try {
        await deleteChatSession(id);
    } catch (e) {
        console.error("Failed to delete session", e);
    }
  };

  const handleShareSession = (id: string) => {
    // For now, simulate copying a link. In production, this would copy the actual unique URL.
    // Since we don't have public routes for sessions yet, we'll just show a notification.
    const url = `${window.location.origin}/chat/${id}`; // Example URL structure
    navigator.clipboard.writeText(url).then(() => {
        notifications.show({
            title: 'Link copied!',
            message: 'Share link has been copied to clipboard.',
            color: 'teal',
        });
    });
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <>
      <AppShell
        navbar={{ width: desktopOpened ? 260 : 60, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
        padding={0}
      >
        <AppShell.Navbar>
          <Sidebar 
            sessions={sessions} 
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setActiveSessionId(id);
              if (isMobile) toggleMobile(); // Close on selection on mobile
            }}
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
            onUpdateSession={(id, isShared) => {
                // Keep this for optimistic updates from sidebar if needed, 
                // but main toggle is now in ShareModal. 
                // However, Sidebar might still use this specific callback if we kept it compliant.
                // Actually Sidebar calls onUpdateSession logic itself for the toggle in ShareModal? 
                // Wait, Sidebar doesn't need to pass onUpdateSession anymore if we moved ShareModal up.
                // But let's keep it simplest: Sidebar asks to open modal.
            }}
            onShareSession={(id) => {
                setShareId(id);
                setShareModalOpen(true);
            }}
            onGoHome={() => setActiveSessionId(null)}
            opened={isMobile ? true : desktopOpened}
          />
        </AppShell.Navbar>

        <AppShell.Main h="100dvh" bg="gray.0" pt={0} pb={0}>
          {activeSession ? (
            <ChatInterface 
              session={activeSession} 
              onUpdateSession={async (updated) => {
                  setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
                  
                  // Identify new message(s) to save
                  const original = sessions.find(s => s.id === updated.id);
                  if (original && updated.messages.length > original.messages.length) {
                      const newMsgs = updated.messages.slice(original.messages.length);
                      for (const msg of newMsgs) {
                          await saveChatMessage(updated.id, msg).catch(e => console.error(e));
                      }
                  }
                  
                  // Persist mode change if it happened
                  if (original && updated.mode !== original.mode && updated.mode) {
                      await updateChatSessionMode(updated.id, updated.mode).catch(e => console.error(e));

                      // Auto-rename if title is default
                      if (original.title.endsWith(' - New Session')) {
                          const newTitle = `${original.course.code} - ${updated.mode}`;
                          setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, title: newTitle } : s));
                          await updateChatSessionTitle(updated.id, newTitle).catch(e => console.error(e));
                      }
                  }
              }}
              onRenameSession={() => {
                  setRenameId(activeSession.id);
                  setRenameModalOpen(true);
              }}
              onDeleteSession={() => {
                  setDeleteId(activeSession.id);
                  setDeleteModalOpen(true);
              }}
              onShareSession={() => {
                  setShareId(activeSession.id);
                  setShareModalOpen(true);
              }}
              onTogglePin={() => handleTogglePin(activeSession.id, !activeSession.isPinned)}
            />
          ) : (
            <Center h="100%">
              <Container size="xs" w="100%">
                  <Stack align="center" gap={0} ta="center">
                    
                    <Box mb={24} className="animate-in fade-in zoom-in duration-700 ease-out">
                       <img 
                          src="/assets/logo.png" 
                          alt="AI Uni Tutor" 
                          width={120} 
                          height={120}
                       />
                    </Box>

                    <Stack gap={12} align="center" mb={40}>
                      <Title order={1} fw={800} c="dark.9" style={{ fontSize: '36px', letterSpacing: '-1.5px' }}>
                        AI Uni Tutor
                      </Title>
                      <Text c="dark.5" size="lg" fw={500}>
                        Your personalized academic copilot.
                      </Text>
                    </Stack>

                    <Button 
                      size="xl" 
                      radius="xl"
                      onClick={openModal} 
                      variant="gradient"
                      gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }}
                      leftSection={<Plus size={24} strokeWidth={3} />}
                      className="transition-all hover:translate-y-[-3px] hover:shadow-2xl hover:scale-[1.02]"
                      px={48}
                      styles={{ 
                        root: { 
                            boxShadow: '0 10px 30px rgba(79, 70, 229, 0.25)',
                            height: '60px',
                            fontSize: '18px'
                        } 
                      }}
                    >
                      Start Learning
                    </Button>
                  </Stack>
              </Container>
            </Center>
          )}
        </AppShell.Main>
      </AppShell>

      <NewSessionModal 
        opened={modalOpened}
        onClose={closeModal}
        onStart={handleStartSession}
      />

      <RenameSessionModal
        opened={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        sessionId={renameId}
        currentTitle={sessions.find(s => s.id === renameId)?.title || ''}
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
        session={sessions.find(s => s.id === shareId) || null}
        onUpdateSession={(id, isShared) => {
            setSessions(prev => prev.map(s => s.id === id ? { ...s, isShared } : s));
        }}
      />
    </>
  );
}
