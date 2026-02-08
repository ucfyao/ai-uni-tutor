import React, { ReactNode } from 'react';
import { Box, Group, Stack } from '@mantine/core';
import { KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage, TutoringMode } from '@/types';
import { ChatInput } from './ChatInput';
import { KnowledgePanel } from './KnowledgePanel';
import { MessageList } from './MessageList';

interface ChatLayoutProps {
  // Message display
  messages: ChatMessage[];
  isTyping: boolean;
  streamingMsgId: string | null;
  lastError: { message: string; canRetry: boolean } | null;
  onRetry: () => void;
  mode: TutoringMode | null;

  // Input
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;

  // File attachments
  attachedFiles: File[];
  imagePreviews: string[];
  onRemoveFile: (index: number) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;

  // Knowledge Panel (optional)
  showKnowledgePanel?: boolean;
  knowledgeCards?: KnowledgeCard[];
  activeCardId?: string | null;
  onCardClick?: (id: string | null) => void;
  onCardAsk?: (card: KnowledgeCard, question: string) => void;
  onCardDelete?: (cardId: string) => void;

  cardChats?: Record<string, ChatMessage[]>;
  loadingCardId?: string | null;
  explainingCardIds?: Set<string>;
  onHighlightClick?: (cardId: string) => void;
  onAddCard?: (
    title: string,
    content: string,
    options?: {
      source?: { messageId: string; role: 'user' | 'assistant' };
    },
  ) => Promise<void>;

  // Custom header (optional)
  header?: ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  messages,
  isTyping,
  streamingMsgId,
  lastError,
  onRetry,
  mode,
  input,
  setInput,
  onSend,
  onKeyDown,
  onPaste,
  attachedFiles,
  imagePreviews,
  onRemoveFile,
  onFileSelect,
  fileInputRef,
  showKnowledgePanel = false,
  knowledgeCards = [],
  activeCardId = null,
  onCardClick,
  onCardAsk,
  onCardDelete,

  cardChats = {},
  loadingCardId = null,
  explainingCardIds = new Set(),
  onHighlightClick,
  onAddCard,
  header,
}) => {
  const isKnowledgeMode = showKnowledgePanel;

  return (
    <Stack gap={0} h="100%" w="100%">
      {/* Optional Header */}
      {header}

      {/* Main Content Area */}
      <Group
        flex={1}
        gap={0}
        bg="transparent"
        align="stretch"
        style={{ overflow: 'hidden', minHeight: 0 }}
      >
        {/* Left Column: Chat */}
        <Stack gap={0} h="100%" style={{ flex: 1, minWidth: 0 }}>
          {/* Messages */}
          <MessageList
            messages={messages}
            isTyping={isTyping}
            streamingMsgId={streamingMsgId}
            lastError={lastError}
            onRetry={onRetry}
            mode={mode}
            knowledgeCards={knowledgeCards}
            onHighlightClick={onHighlightClick}
            onAddCard={onAddCard}
            isKnowledgeMode={isKnowledgeMode}
          />

          {/* Input Area */}
          <Box
            bg="white"
            px={isKnowledgeMode ? 'md' : 0}
            pb={isKnowledgeMode ? 'md' : 0}
            pt={0}
            style={{ flexShrink: 0, zIndex: 5 }}
          >
            <ChatInput
              input={input}
              setInput={setInput}
              isTyping={isTyping}
              onSend={onSend}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              attachedFiles={attachedFiles}
              imagePreviews={imagePreviews}
              onRemoveFile={onRemoveFile}
              onFileClick={() => fileInputRef.current?.click()}
              isKnowledgeMode={isKnowledgeMode}
              fileInputRef={fileInputRef}
              onFileSelect={onFileSelect}
            />
          </Box>
        </Stack>

        {/* Right Column: Knowledge Panel (if enabled) */}
        {showKnowledgePanel && onCardClick && onCardAsk && onCardDelete && (
          <KnowledgePanel
            cards={knowledgeCards}
            visible={true}
            activeCardId={activeCardId}
            onCardClick={onCardClick}
            onAsk={onCardAsk}
            onDelete={onCardDelete}
            cardChats={cardChats}
            loadingCardId={loadingCardId}
            explainingCardIds={explainingCardIds}
          />
        )}
      </Group>
    </Stack>
  );
};
