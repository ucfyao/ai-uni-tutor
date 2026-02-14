import { AlertCircle, ArrowDown, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Container, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage, TutoringMode } from '@/types';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { WelcomeScreen } from './WelcomeScreen';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  streamingMsgId: string | null;
  lastError: { message: string; canRetry: boolean } | null;
  onRetry: () => void;
  mode: TutoringMode | null;
  knowledgeCards?: KnowledgeCard[];
  onHighlightClick?: (cardId: string) => void;
  onAddCard?: (
    title: string,
    content: string,
    options?: {
      source?: { messageId: string; role: 'user' | 'assistant' };
    },
  ) => Promise<void>;
  isKnowledgeMode?: boolean;
  courseCode?: string; // Added for WelcomeScreen
  onPromptSelect?: (prompt: string) => void; // Added for WelcomeScreen interaction
  onRegenerate?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping,
  streamingMsgId,
  lastError,
  onRetry,
  mode,
  knowledgeCards = [],
  onHighlightClick,
  onAddCard,
  isKnowledgeMode: _isKnowledgeMode = false,
  courseCode,
  onPromptSelect,
  onRegenerate,
}) => {
  const { t } = useLanguage();
  const viewport = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const handleScroll = useCallback(() => {
    if (!viewport.current || isAutoScrollingRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 200);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
    setHasNewMessage(false);
  }, []);

  // Filter out card-specific messages (only show main chat)
  const mainMessages = messages.filter((m) => !m.cardId);

  const initialMsgIdsRef = useRef<Set<string>>(new Set(mainMessages.map((m) => m.id)));
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newIds = mainMessages
      .filter((m) => !initialMsgIdsRef.current.has(m.id) && !animatedIds.has(m.id))
      .map((m) => m.id);

    if (newIds.length > 0) {
      setAnimatedIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [mainMessages, animatedIds]);

  const prevMessageCountRef = useRef(mainMessages.length);

  // Memoize processed messages to avoid repeated extractCards calls
  const processedMessages = useMemo(
    () =>
      mainMessages.map((msg) => ({
        ...msg,
        displayText:
          msg.role === 'assistant' ? extractCards(msg.content).cleanContent : msg.content,
      })),
    [mainMessages],
  );

  // Auto-scroll to bottom when messages change (double rAF ensures layout is complete)
  useEffect(() => {
    if (isScrolledUp) {
      if (mainMessages.length > prevMessageCountRef.current) {
        setHasNewMessage(true);
      }
    } else {
      isAutoScrollingRef.current = true;
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (viewport.current) {
            viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'auto' });
          }
          // Reset flag after scroll completes
          requestAnimationFrame(() => {
            isAutoScrollingRef.current = false;
          });
        }),
      );
      prevMessageCountRef.current = mainMessages.length;
      return () => cancelAnimationFrame(id);
    }
    prevMessageCountRef.current = mainMessages.length;
  }, [messages, isTyping, isScrolledUp, mainMessages.length]);
  const isNewChat = mainMessages.length === 0;

  // Use full height for empty state to center Welcome Screen
  if (isNewChat && mode && courseCode && onPromptSelect) {
    return (
      <Box bg="white" style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" scrollbarSize={6} type="auto">
          <WelcomeScreen mode={mode} courseCode={courseCode} onPromptSelect={onPromptSelect} />
        </ScrollArea>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ flex: 1, minHeight: 0 }} pos="relative">
      <ScrollArea
        viewportRef={viewport}
        h="100%"
        scrollbarSize={6}
        type="auto"
        onScrollPositionChange={handleScroll}
      >
        <Box pt="md" pb="md">
          {/* Max-width container for optimal line length */}
          <Container size="56.25rem" w="100%" px="md">
            <Stack gap="sm">
              {processedMessages.map((msg) => {
                return (
                  <Box
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                    className={
                      animatedIds.has(msg.id)
                        ? msg.role === 'user'
                          ? 'msg-enter-right'
                          : 'msg-enter-left'
                        : undefined
                    }
                  >
                    <MessageBubble
                      message={{ ...msg, content: msg.displayText }}
                      isStreaming={msg.id === streamingMsgId}
                      onStreamingComplete={() => {}}
                      mode={mode}
                      knowledgeCards={knowledgeCards}
                      onHighlightClick={onHighlightClick}
                      onAddCard={onAddCard}
                      onRegenerate={onRegenerate}
                    />
                  </Box>
                );
              })}

              {/* Loading state */}
              {isTyping && streamingMsgId === null && <ThinkingIndicator mode={mode} />}

              {/* Error state */}
              {lastError && (
                <Box
                  p="md"
                  style={{
                    borderRadius: 8,
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    <AlertCircle size={20} color="#c00" />
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" c="red.8" fw={500}>
                        {t.chat.error}
                      </Text>
                      <Text size="sm" c="red.7">
                        {lastError.message}
                      </Text>
                      {lastError.canRetry && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<RefreshCw size={14} />}
                          onClick={onRetry}
                          mt="xs"
                        >
                          {t.chat.retry}
                        </Button>
                      )}
                    </Box>
                  </Group>
                </Box>
              )}
            </Stack>
          </Container>
        </Box>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {isScrolledUp && (
        <ActionIcon
          variant="white"
          size={40}
          radius="xl"
          onClick={scrollToBottom}
          pos="absolute"
          bottom={16}
          left={0}
          right={0}
          mx="auto"
          style={{
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--mantine-color-gray-2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            animation: 'scrollBtnIn 0.2s ease-out',
          }}
          aria-label="Scroll to bottom"
        >
          <Box pos="relative">
            <ArrowDown size={18} color="var(--mantine-color-gray-7)" />
            {hasNewMessage && (
              <Box
                pos="absolute"
                top={-3}
                right={-3}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-indigo-5)',
                }}
              />
            )}
          </Box>
        </ActionIcon>
      )}
    </Box>
  );
};
