import dynamic from 'next/dynamic';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Drawer, Loader, Stack, Text } from '@mantine/core';
import { getLectureOutlines } from '@/app/actions/documents';
import { askCardQuestion } from '@/app/actions/knowledge-cards';
import { ChatInput } from '@/components/chat/ChatInput';
import { KnowledgePanel } from '@/components/chat/KnowledgePanel';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { parseCommand, type ChatCommand } from '@/constants/commands';
import { useChatSession } from '@/hooks/useChatSession';
import { useChatStream } from '@/hooks/useChatStream';
import { useKnowledgeCards } from '@/hooks/useKnowledgeCards';
import { useLanguage } from '@/i18n/LanguageContext';
import { isDocumentFile, isImageFile, MAX_FILE_SIZE_BYTES } from '@/lib/file-utils';
import { formatOutlineToMarkdown } from '@/lib/format-outline';
import { showNotification } from '@/lib/notifications';
import type { ChatMessage, ChatSession } from '@/types';

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
  isLoading?: boolean;
  desktopPanelCollapsed?: boolean;
}

export const LectureHelper: React.FC<LectureHelperProps> = ({
  session: initialSession,
  onUpdateSession,
  openDrawerTrigger,
  isLoading = false,
  desktopPanelCollapsed = false,
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

  const {
    isStreaming,
    isReconnecting,
    streamingMsgId,
    setStreamingMsgId,
    streamChatResponse,
    cancelStream,
  } = useChatStream();

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

  const handleSend = async (retryInput?: string, options?: { displayContent?: string }) => {
    const messageToSend = retryInput || input.trim();

    if (
      (!messageToSend && attachedFiles.length === 0 && !attachedDocument) ||
      isStreaming ||
      isSendingRef.current
    )
      return;
    if (!session) return;

    // Command check — BEFORE setting isSendingRef so dispatch can call handleSend recursively
    // Skip when called programmatically from handleCommandDispatch (displayContent set)
    if (!options?.displayContent && session.mode && messageToSend.startsWith('/')) {
      const parsed = parseCommand(messageToSend, session.mode);
      if (parsed) {
        handleCommandDispatch(parsed.command, parsed.args);
        return; // isSendingRef was never set — no leak
      }
    }

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
    const lastMsg = session.messages[session.messages.length - 1];
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content:
        options?.displayContent ||
        messageToSend ||
        (imageData.length > 0 ? '(Image attached)' : '(Document attached)'),
      timestamp: Date.now(),
      images: imageData.length > 0 ? imageData : undefined,
      parentMessageId: lastMsg?.id ?? null,
    };

    if (!retryInput) {
      setInput('');
      setAttachedFiles([]);
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setImagePreviews([]);
    }

    const aiMsgId = crypto.randomUUID();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      parentMessageId: userMsg.id,
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
      const result = await askCardQuestion(
        card.id,
        cardType,
        question,
        session.course?.code,
        session.course?.id,
      );

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

  const handleSummaryAction = async () => {
    if (!session?.course?.id) {
      handleSend('Summarize the key concepts of the last lecture');
      return;
    }

    const result = await getLectureOutlines(session.course.id);

    if (!result.success || result.data.length === 0) {
      // Fallback to regular RAG
      handleSend('Summarize the key concepts of the last lecture');
      return;
    }

    // Format outlines to markdown
    const markdown = result.data
      .map((doc) => formatOutlineToMarkdown(doc.outline))
      .join('\n\n---\n\n');

    // Display as user prompt + assistant response
    const lastMsg = session.messages[session.messages.length - 1];
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: '/summary',
      timestamp: Date.now(),
      parentMessageId: lastMsg?.id ?? null,
    };
    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: markdown,
      timestamp: Date.now(),
      parentMessageId: userMsg.id,
    };
    setSession({
      ...session,
      messages: [...session.messages, userMsg, aiMsg],
      lastUpdated: Date.now(),
    });

    // Defensive: ensure isSendingRef is reset (e.g., if called from a path that set it)
    isSendingRef.current = false;
  };

  /** Button click → just fill the input with the command text, let user press send */
  const handleCommandSelect = (command: ChatCommand, args: string = '') => {
    setInput(command.command + ' ' + args);
    requestAnimationFrame(() => chatInputRef.current?.focus());
  };

  /** Called from handleSend when a typed/sent command is detected */
  const handleCommandDispatch = (command: ChatCommand, args: string = '') => {
    // Guard: commands that require context need messages, documents, or images
    if (command.requiresContext && !args) {
      const hasContext =
        (session?.messages?.length ?? 0) > 0 || attachedFiles.length > 0 || !!attachedDocument;

      if (!hasContext) {
        showNotification({
          title: t.chat.noContextTitle,
          message: t.chat.noContextMessage,
          color: 'orange',
        });
        return;
      }
    }

    const displayContent = command.command + (args ? ' ' + args : '');
    setInput('');

    if (command.id === 'summary') {
      handleSummaryAction();
    } else {
      const prompt = command.promptTemplate + (args ? ' ' + args : '');
      handleSend(prompt, { displayContent });
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (!session || isStreaming) return;

    const msgIndex = session.messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 1) return;

    const userMsg = session.messages[msgIndex - 1];
    if (userMsg.role !== 'user') return;

    isSendingRef.current = true;
    setLastError(null);
    setLastInput(userMsg.content);

    // Keep messages up to and including the user message
    const keepMessages = session.messages.slice(0, msgIndex);

    // Create new assistant as sibling of original (same parent = userMsg)
    const originalAssistantId = session.messages[msgIndex].id;
    const aiMsgId = crypto.randomUUID();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      parentMessageId: userMsg.id,
    };

    // Compute updated siblingsMap client-side
    const prevMap = session.siblingsMap ?? {};
    const existingSiblings = prevMap[userMsg.id];
    const updatedSiblingsMap = {
      ...prevMap,
      [userMsg.id]: existingSiblings
        ? [...existingSiblings, aiMsgId]
        : [originalAssistantId, aiMsgId],
    };

    setInput('');
    setSession(
      {
        ...session,
        messages: [...keepMessages, aiMsg],
        siblingsMap: updatedSiblingsMap,
        lastUpdated: Date.now(),
      },
      { streamingMessageId: aiMsgId, resetSavedIndex: keepMessages.length },
    );
    setStreamingMsgId(aiMsgId);

    let accumulatedContent = '';

    await streamChatResponse(
      {
        course: session.course ?? { code: '', name: '' },
        mode: session.mode,
        // History EXCLUDES the user message (userInput provides it separately)
        history: session.messages.slice(0, msgIndex - 1).map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        userInput: userMsg.content,
        images: userMsg.images,
      },
      {
        onChunk: (text) => {
          accumulatedContent += text;
          updateLastMessage(accumulatedContent, aiMsgId);
        },
        onError: (error, isLimitError) => {
          removeMessages(1); // Only remove the 1 new assistant placeholder
          isSendingRef.current = false;

          if (isLimitError) {
            setLimitModalOpen(true);
          } else {
            setLastError({ message: error, canRetry: true });
            showNotification({ title: 'Error', message: error, color: 'red' });
          }
        },
        onComplete: async () => {
          await updateLastMessage(accumulatedContent, null);
          setLastError(null);
          isSendingRef.current = false;
          loadRelatedCards(userMsg.content);
          requestAnimationFrame(() => chatInputRef.current?.focus());
        },
      },
    );
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    if (!session || isStreaming) return;

    try {
      const { editAndRegenerate } = await import('@/app/actions/chat');
      const result = await editAndRegenerate(session.id, messageId, newContent);

      // Update session with new active-path messages (includes the new user sibling)
      const updatedMessages = result.messages;
      const updatedSession: ChatSession = {
        ...session,
        messages: updatedMessages,
        siblingsMap: result.siblingsMap,
        lastUpdated: Date.now(),
      };

      // Create AI placeholder and stream regeneration
      const aiMsgId = crypto.randomUUID();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        parentMessageId: result.newMessageId,
      };
      setSession(
        { ...updatedSession, messages: [...updatedMessages, aiMsg], lastUpdated: Date.now() },
        { streamingMessageId: aiMsgId, resetSavedIndex: updatedMessages.length },
      );
      setStreamingMsgId(aiMsgId);

      let accumulatedContent = '';
      await streamChatResponse(
        {
          course: session.course ?? { code: '', name: '' },
          mode: session.mode,
          history: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images,
          })),
          userInput: newContent,
        },
        {
          onChunk: (text) => {
            accumulatedContent += text;
            updateLastMessage(accumulatedContent, aiMsgId);
          },
          onError: (error, isLimitError) => {
            removeMessages(1); // Remove AI placeholder
            isSendingRef.current = false;
            if (isLimitError) {
              setLimitModalOpen(true);
            } else {
              setLastError({ message: error, canRetry: false });
              showNotification({ title: 'Error', message: error, color: 'red' });
            }
          },
          onComplete: async () => {
            await updateLastMessage(accumulatedContent, null);
            setLastError(null);
            isSendingRef.current = false;
            loadRelatedCards(newContent);
            requestAnimationFrame(() => chatInputRef.current?.focus());
          },
        },
      );
    } catch (error) {
      console.error('Edit failed:', error);
      showNotification({ title: t.chat.error, message: 'Failed to edit message', color: 'red' });
    }
  };

  const handleSwitchBranch = async (parentMessageId: string, targetChildId: string) => {
    if (!session) return;

    try {
      const { switchBranch } = await import('@/app/actions/chat');
      const result = await switchBranch(session.id, parentMessageId, targetChildId);
      if (result) {
        setSession(
          {
            ...session,
            messages: result.messages,
            siblingsMap: result.siblingsMap,
            lastUpdated: Date.now(),
          },
          { resetSavedIndex: result.messages.length },
        );
      }
    } catch (error) {
      console.error('Switch branch failed:', error);
      showNotification({
        title: t.chat.error,
        message: 'Failed to switch branch',
        color: 'red',
      });
    }
  };

  // siblingsMap: convert server-provided Record to Map for MessageList
  const siblingsMap = useMemo(() => {
    if (!session?.siblingsMap) return new Map<string, string[]>();
    return new Map(Object.entries(session.siblingsMap));
  }, [session?.siblingsMap]);

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
        const objectUrl = URL.createObjectURL(file);
        setImagePreviews((prev) => [...prev, objectUrl]);
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
    setImagePreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
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

      const objectUrl = URL.createObjectURL(file);
      setImagePreviews((prev) => [...prev, objectUrl]);

      setAttachedFiles((prev) => [...prev, file]);
    });
  };

  if (!session) return null;

  return (
    <Stack gap={0} h="100%" w="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
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
          {isReconnecting && (
            <Text size="xs" c="orange" ta="center" py={4}>
              {t.chat.reconnecting}
            </Text>
          )}
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
            onCommandSelect={(cmd) => handleCommandSelect(cmd)}
            onRegenerate={handleRegenerate}
            onEdit={handleEdit}
            onSwitchBranch={handleSwitchBranch}
            siblingsMap={siblingsMap}
            contentClassName="chat-scroll-content-offset"
            isLoading={isLoading}
          />

          <Box
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
                mode={session.mode || undefined}
                onCommandSelect={(cmd) => handleCommandSelect(cmd)}
              />
            </Box>
          </Box>
        </Stack>

        {/* Knowledge Panel – overlays chat area on lg+ screens, right: 8px leaves room for scrollbar */}
        {!desktopPanelCollapsed && (
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
        )}
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
