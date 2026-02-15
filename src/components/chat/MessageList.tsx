import { AlertCircle, ArrowDown, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Button, Container, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
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
  onAddCard?: (
    title: string,
    content: string,
    options?: {
      source?: { messageId: string; role: 'user' | 'assistant' };
    },
  ) => Promise<void>;
  isKnowledgeMode?: boolean;
  courseCode?: string;
  onPromptSelect?: (prompt: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping,
  streamingMsgId,
  lastError,
  onRetry,
  mode,
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

  const initialMsgIdsRef = useRef<Set<string>>(new Set(messages.map((m) => m.id)));
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newIds = messages
      .filter((m) => !initialMsgIdsRef.current.has(m.id) && !animatedIds.has(m.id))
      .map((m) => m.id);

    if (newIds.length > 0) {
      setAnimatedIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [messages, animatedIds]);

  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom when messages change (double rAF ensures layout is complete)
  useEffect(() => {
    if (isScrolledUp) {
      if (messages.length > prevMessageCountRef.current) {
        setHasNewMessage(true);
      }
    } else {
      isAutoScrollingRef.current = true;
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (viewport.current) {
            viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'auto' });
          }
          requestAnimationFrame(() => {
            isAutoScrollingRef.current = false;
          });
        }),
      );
      prevMessageCountRef.current = messages.length;
      return () => cancelAnimationFrame(id);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, isTyping, isScrolledUp, messages.length]);
  const isNewChat = messages.length === 0;

  // Use full height for empty state to center Welcome Screen
  if (isNewChat && mode && courseCode && onPromptSelect) {
    return (
      <Box bg="var(--mantine-color-body)" style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" scrollbarSize={6} type="auto">
          <WelcomeScreen mode={mode} courseCode={courseCode} onPromptSelect={onPromptSelect} />
        </ScrollArea>
      </Box>
    );
  }

  return (
    <Box bg="var(--mantine-color-body)" style={{ flex: 1, minHeight: 0 }} pos="relative">
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
              {messages.map((msg) => {
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
                      message={msg}
                      isStreaming={msg.id === streamingMsgId}
                      onStreamingComplete={() => {}}
                      mode={mode}
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
                    backgroundColor: 'var(--mantine-color-red-0)',
                    border: '1px solid var(--mantine-color-red-2)',
                  }}
                >
                  <Group gap="sm" align="flex-start">
                    <AlertCircle size={20} color="var(--mantine-color-red-7)" />
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
            backgroundColor: 'var(--mantine-color-body)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--mantine-color-default-border)',
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
