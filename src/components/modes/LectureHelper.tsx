import React, { useRef, useState } from 'react';
import { Box, Drawer, Group, Stack } from '@mantine/core';
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
  const { session, setSession, addMessage, updateLastMessage, removeLastMessage } = useChatSession({
    initialSession,
    onSessionUpdate: onUpdateSession,
  });

  const { isStreaming, streamingMsgId, setStreamingMsgId, streamChatResponse } = useChatStream();

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
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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
          removeLastMessage();
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

    // Add user message to card chat
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
      cardId: card.id,
    };
    addMessage(userMsg);

    setLoadingCardId(card.id);

    try {
      const result = await generateChatResponse(
        session.course,
        session.mode,
        session.messages,
        contextualInput,
      );

      if (result.success) {
        const aiMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: result.data || '...',
          timestamp: Date.now(),
          cardId: card.id,
        };
        addMessage(aiMsg);
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
    const cardElement = cardRefs.current[cardId];
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleAddCard = async (title: string, content: string) => {
    const result = await addManualCard(title, content);
    if (result.error === 'limit') {
      setLimitModalOpen(true);
    } else if (result.success && result.cardId) {
      setActiveCardId(result.cardId);
      setKnowledgePanelDrawerOpened(true); // Open drawer on mobile so user sees the new card
      // Defer scroll so the card has expanded
      setTimeout(() => {
        const el = cardRefs.current[result.cardId!];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  };

  const handleRetry = () => {
    if (lastInput && session) {
      removeLastMessage();
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
    <Stack gap={0} h="100%" w="100%">
      <Group
        flex={1}
        gap={0}
        bg="transparent"
        align="stretch"
        style={{ overflow: 'hidden', minHeight: 0 }}
      >
        {/* Left: Chat */}
        <Stack gap={0} h="100%" pt={24} style={{ flex: 1, minWidth: 0 }}>
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

          <Box bg="white" px="md" pb="md" pt={0} style={{ flexShrink: 0, zIndex: 5 }}>
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
          }}
        >
          <KnowledgePanel
            cards={knowledgeCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={setActiveCardId}
            onAsk={handleCardAsk}
            onDelete={deleteCard}
            cardRefs={cardRefs}
            cardChats={cardChats}
            loadingCardId={loadingCardId}
            explainingCardIds={explainingCardIds}
          />
        </Box>
      </Group>

      {/* Knowledge Panel Drawer for smaller screens */}
      <Drawer
        opened={knowledgePanelDrawerOpened}
        onClose={() => setKnowledgePanelDrawerOpened(false)}
        position="right"
        size="lg"
        withCloseButton
        padding={0}
        hiddenFrom="lg"
        styles={{
          header: { display: 'none' },
          body: { height: '100%', padding: 0 },
        }}
      >
        <KnowledgePanel
          cards={knowledgeCards}
          visible={true}
          activeCardId={activeCardId}
          onCardClick={setActiveCardId}
          onAsk={handleCardAsk}
          onDelete={deleteCard}
          cardRefs={cardRefs}
          cardChats={cardChats}
          loadingCardId={loadingCardId}
          explainingCardIds={explainingCardIds}
          onClose={() => setKnowledgePanelDrawerOpened(false)}
        />
      </Drawer>

      <UsageLimitModal opened={isLimitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </Stack>
  );
};
