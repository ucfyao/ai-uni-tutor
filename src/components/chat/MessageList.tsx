import { AlertCircle, Bot, RefreshCw } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import {
  Avatar,
  Box,
  Button,
  Container,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage, TutoringMode } from '@/types';
import { MessageBubble } from './MessageBubble';
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
  const viewport = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change (double rAF ensures layout is complete)
  useEffect(() => {
    const scrollToBottom = () => {
      if (viewport.current) {
        viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'auto' });
      }
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(scrollToBottom));
    return () => cancelAnimationFrame(id);
  }, [messages, isTyping]);

  // Filter out card-specific messages (only show main chat)
  const mainMessages = messages.filter((m) => !m.cardId);
  const isNewChat = mainMessages.length === 0;

  // Use full height for empty state to center Welcome Screen
  if (isNewChat && mode && courseCode && onPromptSelect) {
    return (
      <Box bg="white" style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" scrollbarSize={8} type="auto">
          <WelcomeScreen mode={mode} courseCode={courseCode} onPromptSelect={onPromptSelect} />
        </ScrollArea>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ flex: 1, minHeight: 0 }}>
      <ScrollArea viewportRef={viewport} h="100%" scrollbarSize={8} type="auto">
        <Box pt="md" pb="md">
          {/* Max-width container for optimal line length */}
          <Container size="56.25rem" w="100%" px="md">
            <Stack gap="sm">
              {mainMessages.map((msg) => {
                // Clean content if assistant (remove knowledge cards markup)
                const displayText =
                  msg.role === 'assistant' ? extractCards(msg.content).cleanContent : msg.content;

                return (
                  <Box
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <MessageBubble
                      message={{ ...msg, content: displayText }}
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
              {isTyping && streamingMsgId === null && (
                <Group gap="md">
                  <Avatar radius="xl" size="md" color="indigo">
                    <Bot size={20} />
                  </Avatar>
                  <Box>
                    <Skeleton height={12} width={200} radius="md" mb={6} />
                    <Skeleton height={12} width={300} radius="md" mb={6} />
                    <Skeleton height={12} width={250} radius="md" />
                  </Box>
                </Group>
              )}

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
                        Error
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
                          Retry
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
    </Box>
  );
};
