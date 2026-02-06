import React, { useRef, useState } from 'react';
import { Box, Drawer, Group, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { generateChatResponse } from '@/app/actions/chat';
import { ChatInput } from '@/components/chat/ChatInput';
import { KnowledgePanel } from '@/components/chat/KnowledgePanel';
import { MessageList } from '@/components/chat/MessageList';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { useChatSession } from '@/hooks/useChatSession';
import { useChatStream } from '@/hooks/useChatStream';
import { useKnowledgeCards } from '@/hooks/useKnowledgeCards';
import { showNotification } from '@/lib/notifications';
import { ChatMessage, ChatSession } from '@/types';

interface LectureHelperProps {
  session: ChatSession;
  onUpdateSession: (session: ChatSession) => void;
  openDrawerTrigger?: number; // Increment to trigger drawer open
}

export const LectureHelper: React.FC<LectureHelperProps> = ({
  session: initialSession,
  onUpdateSession,
  openDrawerTrigger,
}) => {
  const {
    session,
    setSession,
    addMessage,
    updateLastMessage,
    removeLastMessage: _removeLastMessage,
    removeMessages,
  } = useChatSession({
    initialSession,
    onSessionUpdate: onUpdateSession,
  });

  const { isStreaming, streamingMsgId, setStreamingMsgId, streamChatResponse } = useChatStream();
  const isLargeScreen = useMediaQuery('(min-width: 75em)'); // Matches Mantine 'lg' breakpoint

  // Knowledge cards management
  const { knowledgeCards, explainingCardIds, addManualCard, deleteCard } = useKnowledgeCards({
    sessionId: session?.id || '',
    messages: session?.messages || [],
    courseCode: session?.course.code || '',
    enabled: true, // Lecture Helper has knowledge cards
  });

  // Card interaction state
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardChats, setCardChats] = useState<Record<string, ChatMessage[]>>({});
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);

  // Input state
  const [input, setInput] = useState('');
  const [lastError, setLastError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [lastInput, setLastInput] = useState('');

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge Panel drawer state for responsive screens
  const [knowledgePanelDrawerOpened, setKnowledgePanelDrawerOpened] = useState(false);
  const [isLimitModalOpen, setLimitModalOpen] = useState(false);
  const [pendingScrollToCardId, setPendingScrollToCardId] = useState<string | null>(null);
  // Incrementing trigger to ensure scroll useEffect fires even for same cardId
  const [scrollTrigger, setScrollTrigger] = useState(0);

  const isSendingRef = useRef(false);

  // Open drawer when trigger changes (from header button click)
  React.useEffect(() => {
    if (openDrawerTrigger && openDrawerTrigger > 0) {
      setKnowledgePanelDrawerOpened(true);
    }
  }, [openDrawerTrigger]);

  // Hydrate card chats from session history
  React.useEffect(() => {
    if (!session) return;

    const chats: Record<string, ChatMessage[]> = {};
    session.messages.forEach((msg) => {
      if (msg.cardId) {
        if (!chats[msg.cardId]) chats[msg.cardId] = [];
        chats[msg.cardId].push(msg);
      }
    });
    setCardChats(chats);
  }, [session]);

  const handleSend = async (retryInput?: string) => {
    const messageToSend = retryInput || input.trim();

    if ((!messageToSend && attachedFiles.length === 0) || isStreaming || isSendingRef.current)
      return;
    if (!session) return;

    isSendingRef.current = true;
    setLastError(null);
    setLastInput(messageToSend);

    // Convert attached files to base64
    const imageData: { data: string; mimeType: string }[] = [];
    for (const file of attachedFiles) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imageData.push({ data: base64, mimeType: file.type });
      } catch (error) {
        console.error('Failed to process image:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to process image attachment',
          color: 'red',
        });
        isSendingRef.current = false;
        return;
      }
    }

    // Add user message and AI placeholder in one update (avoid stale session: second addMessage would overwrite user msg)
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: messageToSend || '(Image attached)',
      timestamp: Date.now(),
      images: imageData.length > 0 ? imageData : undefined,
    };

    if (!retryInput) {
      setInput('');
      setAttachedFiles([]);
      setImagePreviews([]);
    }

    const aiMsgId = `a_${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setSession(
      { ...session, messages: [...session.messages, userMsg, aiMsg], lastUpdated: Date.now() },
      { streamingMessageId: aiMsgId },
    );
    setStreamingMsgId(aiMsgId);

    let accumulatedContent = '';

    await streamChatResponse(
      {
        course: session.course,
        mode: session.mode,
        history: session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        userInput: messageToSend,
        images: imageData,
      },
      {
        onChunk: (text) => {
          accumulatedContent += text;
          updateLastMessage(accumulatedContent, aiMsgId);
        },
        onError: (error, isLimitError) => {
          removeMessages(2); // Remove both AI placeholder AND user message atomically
          isSendingRef.current = false;

          if (isLimitError) {
            setLimitModalOpen(true);
          } else {
            setLastError({ message: error, canRetry: true }); // Keep retry logic only for non-limit errors
            showNotification({ title: 'Error', message: error, color: 'red' });
          }
        },
        onComplete: async () => {
          await updateLastMessage(accumulatedContent, null);
          setLastError(null);
          isSendingRef.current = false;
        },
      },
    );
  };

  const handleCardAsk = async (card: { id: string; title: string }, question: string) => {
    if (!session) return;

    const contextualInput = `Regarding the concept "${card.title}" in our lecture: ${question}`;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
      cardId: card.id,
    };

    setLoadingCardId(card.id);

    try {
      // Check quota and call model first; only add (and persist) messages on success
      const result = await generateChatResponse(
        session.course,
        session.mode,
        [...session.messages, userMsg],
        contextualInput,
      );

      if (result.success) {
        addMessage(userMsg);
        const aiMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: result.data || '...',
          timestamp: Date.now(),
          cardId: card.id,
        };
        addMessage(aiMsg);
      } else if (result.isLimitError) {
        setLimitModalOpen(true);
      } else {
        showNotification({ title: 'Error', message: result.error || 'Failed', color: 'red' });
      }
    } catch (e) {
      console.error('Card ask error:', e);
      showNotification({ title: 'Error', message: 'Failed to connect', color: 'red' });
    } finally {
      setLoadingCardId(null);
    }
  };

  const handleHighlightClick = (cardId: string) => {
    setActiveCardId(cardId);
    if (!isLargeScreen) {
      setKnowledgePanelDrawerOpened(true); // Open drawer on mobile so user can see the card
    }
    setPendingScrollToCardId(cardId); // Trigger scroll via KnowledgePanel's scroll mechanism
    setScrollTrigger((prev) => prev + 1); // Ensure useEffect fires even for same cardId
  };

  const handleAddCard = async (title: string, content: string) => {
    const result = await addManualCard(title, content);
    if (result.error === 'limit') {
      setLimitModalOpen(true);
    } else if (result.success && result.cardId) {
      const newCardId = result.cardId;
      setActiveCardId(newCardId); // Expand the new card
      setKnowledgePanelDrawerOpened(true); // Open drawer on mobile so user sees the new card
      setPendingScrollToCardId(newCardId); // useEffect will scroll once the card is rendered
      setScrollTrigger((prev) => prev + 1); // Ensure useEffect fires
    }
  };

  const handleRetry = () => {
    if (lastInput && session) {
      // onError already removed both AI placeholder and user message; just resend
      handleSend(lastInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      showNotification({
        title: 'Invalid file type',
        message: 'Please select image files only',
        color: 'red',
      });
      return;
    }

    if (attachedFiles.length + imageFiles.length > 4) {
      showNotification({
        title: 'Too many files',
        message: 'You can attach up to 4 images',
        color: 'orange',
      });
      return;
    }

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    setAttachedFiles((prev) => [...prev, ...imageFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));

    if (imageItems.length === 0) return;
    e.preventDefault();

    imageItems.forEach((item) => {
      const file = item.getAsFile();
      if (!file || attachedFiles.length >= 4) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);

      setAttachedFiles((prev) => [...prev, file]);
    });
  };

  if (!session) return null;

  return (
    <Stack gap={0} h="100%" w="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
      <Group
        flex={1}
        gap={0}
        bg="transparent"
        align="stretch"
        style={{ overflow: 'hidden', minHeight: 0, maxHeight: '100%' }}
      >
        {/* Left: Chat - minHeight: 0 so MessageList ScrollArea gets bounded height */}
        <Stack gap={0} h="100%" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <MessageList
            messages={session.messages}
            isTyping={isStreaming}
            streamingMsgId={streamingMsgId}
            lastError={lastError}
            onRetry={handleRetry}
            mode={session.mode}
            knowledgeCards={knowledgeCards}
            onHighlightClick={handleHighlightClick}
            onAddCard={handleAddCard}
            isKnowledgeMode={true}
            courseCode={session.course.code}
            onPromptSelect={(prompt) => handleSend(prompt)}
          />

          <Box bg="white" px={0} pb="sm" pt={0} style={{ flexShrink: 0, zIndex: 5 }}>
            <Box style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              <ChatInput
                input={input}
                setInput={setInput}
                isTyping={isStreaming}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                attachedFiles={attachedFiles}
                imagePreviews={imagePreviews}
                onRemoveFile={handleRemoveFile}
                onFileClick={() => fileInputRef.current?.click()}
                isKnowledgeMode={true}
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
              />
            </Box>
          </Box>
        </Stack>

        {/* Right: Knowledge Panel - Hide on tablets/small desktops, show on large screens */}
        <Box
          hiddenFrom="base"
          visibleFrom="lg"
          h="100%"
          w={380}
          style={{
            borderLeft: '1px solid #e2e8f0',
            flexShrink: 0,
            minHeight: 0,
          }}
        >
          <KnowledgePanel
            cards={knowledgeCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={setActiveCardId}
            onAsk={handleCardAsk}
            onDelete={deleteCard}
            cardChats={cardChats}
            loadingCardId={loadingCardId}
            explainingCardIds={explainingCardIds}
            scrollToCardId={pendingScrollToCardId}
            scrollTrigger={scrollTrigger}
            onScrolledToCard={() => setPendingScrollToCardId(null)}
          />
        </Box>
      </Group>

      {/* Knowledge Panel Drawer for smaller screens */}
      <Drawer
        opened={knowledgePanelDrawerOpened}
        onClose={() => setKnowledgePanelDrawerOpened(false)}
        position="right"
        size="lg"
        padding={0}
        hiddenFrom="lg"
        lockScroll={false}
        styles={{
          header: { display: 'none' },
          body: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: 0,
            overflow: 'hidden',
            minHeight: 0,
          },
        }}
      >
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <KnowledgePanel
            cards={knowledgeCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={setActiveCardId}
            onAsk={handleCardAsk}
            onDelete={deleteCard}
            cardChats={cardChats}
            loadingCardId={loadingCardId}
            explainingCardIds={explainingCardIds}
            onClose={() => setKnowledgePanelDrawerOpened(false)}
            scrollToCardId={pendingScrollToCardId}
            scrollTrigger={scrollTrigger}
            onScrolledToCard={() => setPendingScrollToCardId(null)}
          />
        </Box>
      </Drawer>

      <UsageLimitModal opened={isLimitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </Stack>
  );
};
