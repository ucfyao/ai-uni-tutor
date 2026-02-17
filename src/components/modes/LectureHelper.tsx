import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Drawer, Loader, Stack } from '@mantine/core';
import { askCardQuestion } from '@/app/actions/knowledge-cards';
import { ChatInput } from '@/components/chat/ChatInput';
import { KnowledgePanel } from '@/components/chat/KnowledgePanel';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { useChatSession } from '@/hooks/useChatSession';
import { useChatStream } from '@/hooks/useChatStream';
import { useKnowledgeCards } from '@/hooks/useKnowledgeCards';
import { useLanguage } from '@/i18n/LanguageContext';
import { isDocumentFile, isImageFile, MAX_FILE_SIZE_BYTES } from '@/lib/file-utils';
import { showNotification } from '@/lib/notifications';
import { ChatMessage, ChatSession } from '@/types';

const MessageList = dynamic(
  () => import('@/components/chat/MessageList').then((mod) => mod.MessageList),
  {
    loading: () => (
      <Box
        bg="var(--mantine-color-body)"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader size="sm" />
      </Box>
    ),
  },
);

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
  const { t } = useLanguage();
  const {
    session,
    setSession,
    updateLastMessage,
    removeLastMessage: _removeLastMessage,
    removeMessages,
  } = useChatSession({
    initialSession,
    onSessionUpdate: onUpdateSession,
  });

  const { isStreaming, streamingMsgId, setStreamingMsgId, streamChatResponse, cancelStream } =
    useChatStream();

  // Knowledge cards management
  const { officialCards, userCards, loadRelatedCards, addManualCard, deleteCard } =
    useKnowledgeCards({
      sessionId: session?.id || '',
      enabled: true,
    });

  // Card interaction state
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const [cardPrefillInput, setCardPrefillInput] = useState<{ cardId: string; text: string } | null>(
    null,
  );

  // Input state
  const [input, setInput] = useState('');
  const [lastError, setLastError] = useState<{ message: string; canRetry: boolean } | null>(null);
  const [lastInput, setLastInput] = useState('');

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [attachedDocument, setAttachedDocument] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Knowledge Panel drawer state for responsive screens
  const [knowledgePanelDrawerOpened, setKnowledgePanelDrawerOpened] = useState(false);
  const [isLimitModalOpen, setLimitModalOpen] = useState(false);
  const [pendingScrollToCardId, setPendingScrollToCardId] = useState<string | null>(null);
  // Incrementing trigger to ensure scroll useEffect fires even for same cardId
  const [scrollTrigger, setScrollTrigger] = useState(0);

  const isSendingRef = useRef(false);

  // Session switch fade transition
  const [mounted, setMounted] = useState(true);
  const prevSessionIdRef = useRef(session?.id);

  useEffect(() => {
    if (session?.id !== prevSessionIdRef.current) {
      setMounted(false);
      const timer = setTimeout(() => {
        setMounted(true);
        prevSessionIdRef.current = session?.id;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [session?.id]);

  // Open drawer when trigger changes (from header button click)
  React.useEffect(() => {
    if (openDrawerTrigger && openDrawerTrigger > 0) {
      setKnowledgePanelDrawerOpened(true);
    }
  }, [openDrawerTrigger]);

  const handleSend = async (retryInput?: string) => {
    const messageToSend = retryInput || input.trim();

    if ((!messageToSend && attachedFiles.length === 0 && !attachedDocument) || isStreaming || isSendingRef.current)
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

    // Convert attached document to base64
    let documentData: { data: string; mimeType: string } | undefined;
    if (attachedDocument) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(attachedDocument);
        });
        documentData = { data: base64, mimeType: attachedDocument.type };
      } catch (error) {
        console.error('Failed to process document:', error);
        showNotification({
          title: t.chat.error,
          message: 'Failed to process document attachment',
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
      content: messageToSend || (imageData.length > 0 ? '(Image attached)' : '(Document attached)'),
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
        course: session.course ?? { code: '', name: '' },
        mode: session.mode,
        history: session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        userInput: messageToSend,
        images: imageData,
        document: documentData,
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
          loadRelatedCards(messageToSend);
          requestAnimationFrame(() => chatInputRef.current?.focus());
        },
      },
    );
  };

  const handleCardAsk = async (
    card: { id: string; title: string },
    question: string,
    cardType: 'knowledge' | 'user' = 'knowledge',
  ): Promise<string | null> => {
    if (!session) return null;

    setLoadingCardId(card.id);

    try {
      const result = await askCardQuestion(card.id, cardType, question, session.course?.code ?? '');

      if (!result.success) {
        showNotification({ title: 'Error', message: result.error || 'Failed', color: 'red' });
        return null;
      }
      return result.data;
    } catch (e) {
      console.error('Card ask error:', e);
      showNotification({ title: 'Error', message: 'Failed to connect', color: 'red' });
      return null;
    } finally {
      setLoadingCardId(null);
    }
  };

  const handleAddCard = async (
    title: string,
    content: string,
    options?: {
      source?: { messageId: string; role: 'user' | 'assistant' };
    },
  ) => {
    if (!session) return;

    const excerpt = content.trim();
    const normalizedTitle = title.trim();

    const cardId = await addManualCard(normalizedTitle, excerpt, {
      messageId: options?.source?.messageId,
      role: options?.source?.role,
    });
    if (!cardId) return;

    setActiveCardId(cardId);
    setKnowledgePanelDrawerOpened(true);
    setPendingScrollToCardId(cardId);
    setScrollTrigger((prev) => prev + 1);

    setCardPrefillInput({ cardId, text: `Explain this concept:\n\n${excerpt}` });
  };

  const handleRetry = () => {
    if (lastInput && session) {
      // onError already removed both AI placeholder and user message; just resend
      handleSend(lastInput);
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (!session || isStreaming) return;

    const msgIndex = session.messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 1) return;

    const userMsg = session.messages[msgIndex - 1];
    if (userMsg.role !== 'user') return;

    // Remove from the user message onwards
    const messagesToRemove = session.messages.length - msgIndex + 1;
    removeMessages(messagesToRemove);

    // Re-send with the original user input
    handleSend(userMsg.content);
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
    if (files.length === 0) return;

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showNotification({
          title: t.chat.fileTooLarge,
          message: t.chat.fileTooLargeMessage,
          color: 'red',
        });
        continue;
      }

      if (isImageFile(file.type)) {
        // Image handling
        if (attachedFiles.length >= 4) {
          showNotification({
            title: 'Too many files',
            message: 'You can attach up to 4 images',
            color: 'orange',
          });
          continue;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImagePreviews((prev) => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
        setAttachedFiles((prev) => [...prev, file]);
      } else if (isDocumentFile(file.type)) {
        // Document handling — one document per conversation
        if (attachedDocument) {
          showNotification({
            title: t.chat.oneDocumentLimit,
            message: t.chat.oneDocumentLimitMessage,
            color: 'orange',
          });
          continue;
        }
        setAttachedDocument(file);
      } else {
        showNotification({
          title: t.chat.unsupportedFileType,
          message: t.chat.unsupportedFileTypeMessage,
          color: 'red',
        });
      }
    }

    // Reset input so the same file can be re-selected
    if (e.target) e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveDocument = () => {
    setAttachedDocument(null);
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
    <Stack
      gap={0}
      h="100dvh"
      w="100%"
      style={{ minHeight: 0, overflow: 'hidden', maxHeight: '100%' }}
    >
      <Box flex={1} pos="relative" style={{ overflow: 'hidden', minHeight: 0, maxHeight: '100%' }}>
        {/* Chat area – full width so ScrollArea scrollbar sits at far-right edge */}
        <Stack
          gap={0}
          w="100%"
          h="100%"
          style={{
            minHeight: 0,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          <MessageList
            messages={session.messages}
            isTyping={isStreaming}
            streamingMsgId={streamingMsgId}
            lastError={lastError}
            onRetry={handleRetry}
            mode={session.mode}
            onAddCard={handleAddCard}
            isKnowledgeMode={true}
            courseCode={session.course?.code ?? ''}
            onPromptSelect={(prompt) => handleSend(prompt)}
            onRegenerate={handleRegenerate}
            contentClassName="chat-scroll-content-offset"
          />

          <Box
            px={0}
            className="chat-input-fade chat-scroll-content-offset"
            style={{
              flexShrink: 0,
              zIndex: 5,
            }}
          >
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
                inputRef={chatInputRef}
                onFileSelect={handleFileSelect}
                onStop={cancelStream}
                isStreaming={isStreaming}
                attachedDocument={attachedDocument}
                onRemoveDocument={handleRemoveDocument}
              />
            </Box>
          </Box>
        </Stack>

        {/* Knowledge Panel – overlays chat area on lg+ screens, right: 8px leaves room for scrollbar */}
        <Box
          hiddenFrom="base"
          visibleFrom="lg"
          pos="absolute"
          top={0}
          right={8}
          h="100%"
          w={380}
          style={{
            zIndex: 10,
            backgroundColor: 'var(--mantine-color-body)',
          }}
        >
          <KnowledgePanel
            officialCards={officialCards}
            userCards={userCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={setActiveCardId}
            onAsk={handleCardAsk}
            onDelete={deleteCard}
            loadingCardId={loadingCardId}
            scrollToCardId={pendingScrollToCardId}
            scrollTrigger={scrollTrigger}
            onScrolledToCard={() => setPendingScrollToCardId(null)}
            prefillInput={cardPrefillInput}
            onPrefillConsumed={() => setCardPrefillInput(null)}
          />
        </Box>
      </Box>

      {/* Knowledge Panel Drawer for smaller screens */}
      <Drawer
        opened={knowledgePanelDrawerOpened}
        onClose={() => setKnowledgePanelDrawerOpened(false)}
        position="right"
        size="lg"
        padding={0}
        hiddenFrom="lg"
        lockScroll={false}
        withOverlay={false}
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
        {/* Drag handle for mobile drawer */}
        <Box mx="auto" mt={8} mb={4} w={36} h={4} bg="gray.3" style={{ borderRadius: 2 }} />
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
            officialCards={officialCards}
            userCards={userCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={setActiveCardId}
            onAsk={handleCardAsk}
            onDelete={deleteCard}
            loadingCardId={loadingCardId}
            onClose={() => setKnowledgePanelDrawerOpened(false)}
            scrollToCardId={pendingScrollToCardId}
            scrollTrigger={scrollTrigger}
            onScrolledToCard={() => setPendingScrollToCardId(null)}
            prefillInput={cardPrefillInput}
            onPrefillConsumed={() => setCardPrefillInput(null)}
          />
        </Box>
      </Drawer>

      <UsageLimitModal opened={isLimitModalOpen} onClose={() => setLimitModalOpen(false)} />
    </Stack>
  );
};
