import { Bot, Compass, FileQuestion, Presentation, Sparkles, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Group, Image, SimpleGrid, Text } from '@mantine/core';
import { injectLinks, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage, TutoringMode } from '@/types/index';
import MarkdownRenderer from '../MarkdownRenderer';

// Title generation function (hoisted outside component)
function generateSmartTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 40) return cleaned;

  const breakPoints = ['. ', ', ', ' - ', ': ', '；', '。', '，'];
  for (const bp of breakPoints) {
    const idx = cleaned.indexOf(bp);
    if (idx > 5 && idx < 50) {
      return cleaned.slice(0, idx);
    }
  }

  const words = cleaned.split(' ');
  if (words.length <= 5) return cleaned;
  return words.slice(0, 5).join(' ') + '...';
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onStreamingComplete?: () => void;
  mode?: TutoringMode | null;
  knowledgeCards?: KnowledgeCard[];
  onHighlightClick?: (cardId: string) => void;
  onAddCard?: (title: string, content: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStreamingComplete,
  mode,
  knowledgeCards = [],
  onHighlightClick,
  onAddCard,
}) => {
  const isUser = message.role === 'user';
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Store latest callback in ref to avoid stale closures
  const onAddCardRef = useRef(onAddCard);
  onAddCardRef.current = onAddCard;

  // Handle quick add with visual feedback
  const handleQuickAdd = useCallback(() => {
    if (!selection || !onAddCardRef.current) return;

    const title = generateSmartTitle(selection.text);
    onAddCardRef.current(title, selection.text);

    // Show success feedback
    setAddedFeedback(true);
    window.getSelection()?.removeAllRanges();

    setTimeout(() => {
      setAddedFeedback(false);
      setSelection(null);
    }, 600);
  }, [selection]);

  // Handle Text Selection
  const handleMouseUp = useCallback(() => {
    if (isUser || !onAddCard) return;

    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 3) {
      const text = windowSelection.toString().trim();
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        text: text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
  }, [isUser, onAddCard]);

  // Keyboard shortcut: Enter to quick add, Escape to cancel
  useEffect(() => {
    if (!selection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleQuickAdd();
      } else if (e.key === 'Escape') {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection, handleQuickAdd]);

  // Clear selection on outside click
  useEffect(() => {
    const clearSelection = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-quick-add-btn]')) return;

      if (!window.getSelection()?.toString()) {
        setSelection(null);
      }
    };
    document.addEventListener('mousedown', clearSelection);
    return () => document.removeEventListener('mousedown', clearSelection);
  }, []);

  // Process content to add links for knowledge cards
  const processedContent = React.useMemo(() => {
    if (isUser || !knowledgeCards.length || isStreaming) return message.content;

    return injectLinks(message.content, knowledgeCards);
  }, [message.content, knowledgeCards, isUser, isStreaming]);

  const handleLinkClick = (href: string) => {
    if (href.startsWith('#card-') && onHighlightClick) {
      const cardId = href.replace('#card-', '');
      onHighlightClick(cardId);
    }
  };

  // Bot Configuration based on Mode
  const botConfig = React.useMemo(() => {
    if (isUser) return {};
    // const defaultConfig = { icon: Bot, color: 'gray', gradient: 'from-gray-100 to-gray-200' };
    switch (mode) {
      case 'Lecture Helper':
        return {
          icon: Presentation,
          color: 'indigo',
          gradient: 'var(--mantine-color-indigo-1)',
          iconColor: 'var(--mantine-color-indigo-6)',
        };
      case 'Assignment Coach':
        return {
          icon: Compass,
          color: 'violet',
          gradient: 'var(--mantine-color-violet-1)',
          iconColor: 'var(--mantine-color-violet-6)',
        };
      case 'Exam Prep':
        return {
          icon: FileQuestion,
          color: 'grape',
          gradient: 'var(--mantine-color-grape-1)',
          iconColor: 'var(--mantine-color-grape-6)',
        };
      default:
        return {
          icon: Bot,
          color: 'dark',
          gradient: 'var(--mantine-color-gray-1)',
          iconColor: 'var(--mantine-color-dark-4)',
        };
    }
  }, [mode, isUser]);

  return (
    <Group
      align="flex-start"
      justify={isUser ? 'flex-end' : 'flex-start'}
      wrap="nowrap"
      gap="sm"
      px="md"
      my={6}
    >
      {!isUser && (
        <Box mt={4}>
          <Box
            bg={botConfig.gradient}
            w={36}
            h={36}
            style={{
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              border: `1px solid ${botConfig.iconColor}15`,
            }}
          >
            {botConfig.icon && (
              <botConfig.icon size={20} color={botConfig.iconColor} strokeWidth={2} />
            )}
          </Box>
        </Box>
      )}

      <Box style={{ maxWidth: '85%' }}>
        <Box
          p={isUser ? '10px 18px' : 0}
          onMouseUp={handleMouseUp} // Listen for selection
          style={{
            borderRadius: isUser ? '18px' : 0,
            background: isUser ? 'var(--mantine-color-gray-1)' : 'none',
            boxShadow: 'none',
            color: isUser ? 'var(--mantine-color-dark-9)' : 'inherit',
            position: 'relative',
          }}
        >
          {/* Display images if present */}
          {message.images && message.images.length > 0 && (
            <Box mb={message.content ? 12 : 0}>
              <SimpleGrid
                cols={message.images.length === 1 ? 1 : 2}
                spacing={8}
                style={{ maxWidth: message.images.length === 1 ? '320px' : '400px' }}
              >
                {message.images.map((img, index) => (
                  <Image
                    key={index}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={`Attachment ${index + 1}`}
                    radius="md"
                    style={{
                      maxHeight: (message.images?.length ?? 0) === 1 ? '400px' : '200px',
                      objectFit: 'cover',
                      border: '1px solid var(--mantine-color-gray-3)',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    className="hover:shadow-lg hover:scale-[1.02]"
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          <Box className="markdown-content" c={isUser ? 'dark.9' : 'dark.8'}>
            {isUser ? (
              <Text style={{ whiteSpace: 'pre-wrap' }} fz="16px" lh={1.6}>
                {message.content}
              </Text>
            ) : (
              <>
                <MarkdownRenderer
                  content={isStreaming ? message.content : processedContent}
                  onLinkClick={handleLinkClick}
                />
                {isStreaming && (
                  <Box
                    component="span"
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '18px',
                      backgroundColor: 'var(--mantine-color-indigo-5)',
                      marginLeft: '4px',
                      borderRadius: '3px',
                      verticalAlign: 'text-bottom',
                      animation: 'cursorBlink 1s ease-in-out infinite',
                      boxShadow: '0 0 8px var(--mantine-color-indigo-3)',
                    }}
                  />
                )}
              </>
            )}
          </Box>

          {/* Explain Tooltip */}
          {selection && !isUser && onAddCard && (
            <Box
              data-quick-add-btn
              onClick={handleQuickAdd}
              style={{
                position: 'fixed',
                top: selection.y - 44,
                left: Math.max(16, Math.min(selection.x - 80, window.innerWidth - 180)),
                zIndex: 1000,
                cursor: 'pointer',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              {addedFeedback ? (
                <Group
                  gap={6}
                  px={12}
                  py={8}
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #10b981',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  <Zap size={14} color="#10b981" />
                  <Text size="xs" c="#10b981" fw={600}>
                    Added to cards
                  </Text>
                </Group>
              ) : (
                <Box
                  px={12}
                  py={8}
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:border-indigo-300 hover:shadow-lg"
                >
                  <Group gap={8} mb={4}>
                    <Sparkles size={14} color="#6366f1" />
                    <Text size="xs" fw={600} c="gray.7">
                      Explain this
                    </Text>
                    <Text size="xs" c="gray.4" style={{ marginLeft: 'auto' }}>
                      ↵
                    </Text>
                  </Group>
                  <Text size="xs" c="gray.5" lineClamp={1} style={{ maxWidth: 160 }}>
                    &quot;{selection.text.slice(0, 30)}
                    {selection.text.length > 30 ? '...' : ''}&quot;
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Group>
  );
};
