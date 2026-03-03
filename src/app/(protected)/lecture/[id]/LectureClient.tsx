'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Anchor, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import {
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
import { chatCache } from '@/lib/chat-cache';
import { handleKnowledgePanelToggle } from '@/lib/knowledge-panel-toggle';
import { ChatSession } from '@/types';

interface LectureClientProps {
  id: string;
  initialSession: ChatSession | null;
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
  const [desktopPanelCollapsed, setDesktopPanelCollapsed] = useState(false);

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

    // Server already determined session doesn't exist
    if (!initialSession) {
      setSession(null);
      setLoading(false);
      return;
    }

    // If initialSession matches the current id, we don't need to fetch
    if (initialSession.id === id) {
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
          // 1. Try IndexedDB cache first for instant display
          const cached = await chatCache.getMessages(id);
          if (cancelled) return;

          if (cached && cached.length > 0) {
            const cachedData: ChatSession = { ...fromList, messages: cached };
            lastSavedIndexRef.current = cached.length;
            setSession(cachedData);
            setLoading(false);
          }

          // 2. Always fetch full session from server (includes siblingsMap + correct branch)
          const freshResult = await getChatSession(id);
          if (cancelled) return;

          if (!freshResult.success || !freshResult.data) {
            setLoading(false);
            routerRef.current.push('/study');
            return;
          }
          const freshSession = freshResult.data;

          setSession((prevSession) => {
            if (!prevSession) {
              lastSavedIndexRef.current = freshSession.messages.length;
              return freshSession;
            }

            // Merge: keep client-only messages (sent while server fetch was in-flight)
            const serverMessageIds = new Set(freshSession.messages.map((m) => m.id));
            const clientOnlyMessages = prevSession.messages.filter(
              (m) => !serverMessageIds.has(m.id),
            );
            const mergedMessages = [...freshSession.messages, ...clientOnlyMessages];

            lastSavedIndexRef.current = mergedMessages.length;
            return { ...freshSession, messages: mergedMessages };
          });
          setLoading(false);
          return;
        }

        const result = await getChatSession(id);
        if (cancelled) return;

        const data = result.success ? result.data : null;
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
    async (
      updated: ChatSession,
      options?: { streamingMessageId?: string | null; resetSavedIndex?: number },
    ) => {
      setSession(updated);

      // Reset saved index when edit/branch-switch replaces the message array
      if (options?.resetSavedIndex !== undefined) {
        lastSavedIndexRef.current = options.resetSavedIndex;
      }

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

        const saveResult = await saveChatMessage(updated.id, msg);
        if (!saveResult.success) {
          console.error('Failed to save message:', saveResult.error);
          break; // Stop saving on error to maintain consistency
        }
        lastSavedIndexRef.current++;
      }

      // Persist mode change
      if (session && updated.mode !== session.mode && updated.mode) {
        const modeResult = await updateChatSessionMode(updated.id, updated.mode);
        if (!modeResult.success) console.error(modeResult.error);

        // Auto-rename if title still contains "New Session"
        if (session.title.includes('New Session')) {
          const newTitle = `${session.course?.code ?? 'Session'} - ${updated.mode}`;

          const titleResult = await updateChatSessionTitle(updated.id, newTitle);
          if (!titleResult.success) console.error(titleResult.error);

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

    const result = await toggleSessionPin(session.id, newPin);
    if (result.success) {
      updateSessionLocal({ ...session, isPinned: newPin });
    } else {
      console.error('Failed to toggle pin:', result.error);
      // Revert on error
      setSession({ ...session, isPinned: !newPin });
    }
  };

  // Handle rename
  const handleRename = async (id: string, newTitle: string) => {
    if (!session) return;

    setSession({ ...session, title: newTitle });

    const result = await updateChatSessionTitle(id, newTitle);
    if (result.success) {
      updateSessionLocal({ ...session, title: newTitle });
    } else {
      console.error('Failed to rename:', result.error);
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
      <Center h="100%">
        <Stack align="center" gap="md" ta="center">
          <Title order={1} size={80} c="gray.3" style={{ lineHeight: 1 }}>
            404
          </Title>
          <Title order={2}>Session Not Found</Title>
          <Text c="dimmed" maw={400}>
            The session you are looking for does not exist or you do not have permission to view it.
          </Text>
          <Anchor href="/study" underline="never">
            <Button variant="light" color="indigo" mt="md">
              Back to Study
            </Button>
          </Anchor>
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
        knowledgePanelCollapsed={desktopPanelCollapsed}
        onKnowledgePanelToggle={() =>
          handleKnowledgePanelToggle({
            isCompact: window.matchMedia('(max-width: 75em)').matches,
            openDrawer: () => setKnowledgeDrawerTrigger((prev) => prev + 1),
            toggleDesktopPanel: () => setDesktopPanelCollapsed((prev) => !prev),
          })
        }
      >
        <LectureHelper
          key={session.id}
          session={session}
          onUpdateSession={handleUpdateSession}
          openDrawerTrigger={knowledgeDrawerTrigger}
          isLoading={loading}
          desktopPanelCollapsed={desktopPanelCollapsed}
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
