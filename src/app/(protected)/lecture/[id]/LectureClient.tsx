'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Anchor, Button, Center, Stack, Text, Title } from '@mantine/core';
import {
  getSessionWithCards,
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
import { handleKnowledgePanelToggle } from '@/lib/knowledge-panel-toggle';
import { queryKeys } from '@/lib/query-keys';
import { ChatSession } from '@/types';
import type { UserCardEntity } from '@/types/user-card';

interface LectureClientProps {
  id: string;
}

export default function LectureClient({ id }: LectureClientProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  // undefined = not loaded yet (show skeleton), [] = loaded but empty, [...] = loaded with data
  const [initialUserCards, setInitialUserCards] = useState<UserCardEntity[] | undefined>(undefined);
  const [initialCardChats, setInitialCardChats] = useState<
    Record<string, import('@/types/card-conversation').CardConversationEntity[]> | undefined
  >(undefined);

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

  // Load session with TanStack Query (cached across page switches)
  const { data: sessionData, isLoading: queryLoading } = useQuery({
    queryKey: queryKeys.sessions.detail(id),
    queryFn: async () => {
      const result = await getSessionWithCards(id);
      if (!result.success || !result.data) return null;
      return result.data;
    },
    staleTime: Infinity, // Don't refetch on window focus / mount — only invalidate manually
    enabled: !!id,
  });

  // Sync query result to local state
  useEffect(() => {
    if (queryLoading) {
      setLoading(true);
      return;
    }

    if (!sessionData) {
      setInitialUserCards([]);
      setInitialCardChats({});
      setLoading(false);
      if (id) routerRef.current.push('/study');
      return;
    }

    const { session: freshSession, userCards, cardChats } = sessionData;

    // Mode guard
    if (freshSession.mode && freshSession.mode !== 'Lecture Helper') {
      setLoading(false);
      routerRef.current.push('/study');
      return;
    }

    setInitialUserCards(userCards);
    setInitialCardChats(cardChats);
    lastSavedIndexRef.current = freshSession.messages.length;
    setSession(freshSession);
    setLoading(false);
  }, [id, sessionData, queryLoading]);

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

  // Not found state (loading finished, session is null)
  if (!loading && !session) {
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

  // Loading: show skeleton in real layout
  if (!session) {
    const fromList = sessions.find((s) => s.id === id);
    const skeletonSession: ChatSession = fromList ?? {
      id,
      course: null,
      mode: 'Lecture Helper',
      title: '',
      messages: [],
      lastUpdated: Date.now(),
      isPinned: false,
    };

    const noop = () => {};
    return (
      <ChatPageLayout
        session={skeletonSession}
        onShare={noop}
        onRename={noop}
        onPin={noop}
        onDelete={noop}
        showKnowledgePanel={false}
      >
        <LectureHelper
          key={`skeleton-${id}`}
          session={skeletonSession}
          onUpdateSession={() => {}}
          isLoading={true}
        />
      </ChatPageLayout>
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
          initialUserCards={initialUserCards}
          initialCardChats={initialCardChats}
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
