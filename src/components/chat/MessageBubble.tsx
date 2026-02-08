import { Bot, Compass, FileQuestion, Presentation, Quote } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Group, Image, Portal, SimpleGrid, Text } from '@mantine/core';
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
  onAddCard?: (
    title: string,
    content: string,
    options?: {
      source?: { messageId: string; role: 'user' | 'assistant' };
    },
  ) => void;
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
  const [selection, setSelection] = useState<{
    text: string;
    toolbar: { x: number; y: number; placement: 'top' | 'bottom' };
  } | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);

  // Store latest callback in ref to avoid stale closures
  const onAddCardRef = useRef(onAddCard);

  useEffect(() => {
    onAddCardRef.current = onAddCard;
  }, [onAddCard]);

  const handleExplainSelection = useCallback(() => {
    if (!selection || !onAddCardRef.current) return;

    const title = generateSmartTitle(selection.text);
    onAddCardRef.current(title, selection.text, {
      source: { messageId: message.id, role: message.role },
    });

    setSelection(null);
  }, [selection, message.id, message.role]);

  // Handle Text Selection
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isUser || !onAddCard) return;

      const windowSelection = window.getSelection();
      if (windowSelection && windowSelection.toString().trim().length > 3) {
        const text = windowSelection.toString().trim();
        const range = windowSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
        const centerX = rect.left + rect.width / 2;
        const margin = 16;
        const preferredX = Number.isFinite(centerX) ? centerX : e.clientX;
        const x = Math.min(Math.max(preferredX, margin), Math.max(margin, viewportW - margin));
        const showAbove = rect.top > 72;
        const preferredY = Number.isFinite(showAbove ? rect.top : rect.bottom)
          ? showAbove
            ? rect.top
            : rect.bottom
          : e.clientY;
        const y = Math.min(Math.max(preferredY, margin), Math.max(margin, viewportH - margin));
        selectionRangeRef.current = range.cloneRange();
        const placement: 'top' | 'bottom' = showAbove ? 'top' : 'bottom';

        const selectionData = {
          text: text,
          toolbar: { x, y, placement },
        };

        // Delay UI mount to the next frame so the browser can finish the selection interaction
        // without the newly-rendered floating button interfering with the active selection.
        requestAnimationFrame(() => setSelection(selectionData));
      }
    },
    [isUser, onAddCard],
  );

  // Keyboard shortcut: Enter to explain, Escape to cancel
  useEffect(() => {
    if (!selection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || active.isContentEditable) return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleExplainSelection();
      } else if (e.key === 'Escape') {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection, handleExplainSelection]);

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

  // Preserve native selection highlight after rendering the floating action.
  // Force-restore the selection range to keep the active highlight visible.
  useLayoutEffect(() => {
    if (!selection) return;

    const active = document.activeElement as HTMLElement | null;
    if (active) {
      const tag = active.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || active.isContentEditable) return;
    }

    const range = selectionRangeRef.current;
    const current = window.getSelection();
    if (!range || !current) return;
    try {
      current.removeAllRanges();
      current.addRange(range);
    } catch {
      // ignore
    }
  }, [selection]);

  // Safari/Chrome can still drop the highlight after the next paint if the DOM reflows.
  // Re-assert the selection on the next frame if the selected text disappears.
  useEffect(() => {
    if (!selection) return;

    const id = requestAnimationFrame(() => {
      const current = window.getSelection();
      const currentText = (current?.toString() ?? '').trim();
      if (currentText && currentText === selection.text) return;

      const range = selectionRangeRef.current;
      if (!range || !current) return;
      try {
        current.removeAllRanges();
        current.addRange(range);
      } catch {
        // ignore
      }
    });

    return () => cancelAnimationFrame(id);
  }, [selection]);

  // Clear selection on scroll/resize (prevents floating UI from drifting)
  useEffect(() => {
    if (!selection) return;
    const clear = () => setSelection(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [selection]);

  // Process content to add links for knowledge cards
  const processedContent = React.useMemo(() => {
    if (isUser || !knowledgeCards.length || isStreaming) return message.content;

    return injectLinks(message.content, knowledgeCards);
  }, [message.content, knowledgeCards, isUser, isStreaming]);

  const handleLinkClickStable = useCallback(
    (href: string) => {
      if (href.startsWith('#card-') && onHighlightClick) {
        const cardId = href.replace('#card-', '');
        onHighlightClick(cardId);
      }
    },
    [onHighlightClick],
  );

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
    <Group align="flex-start" justify={isUser ? 'flex-end' : 'flex-start'} wrap="nowrap" gap="sm">
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
          p={isUser ? '10px 18px' : '12px 16px'}
          onMouseUp={handleMouseUp} // Listen for selection
          style={{
            borderRadius: '18px',
            background: isUser ? 'var(--mantine-color-gray-1)' : 'rgba(255, 255, 255, 0.96)',
            border: isUser
              ? '1px solid var(--mantine-color-gray-2)'
              : '1px solid var(--mantine-color-gray-2)',
            boxShadow: isUser ? 'none' : '0 2px 12px rgba(0, 0, 0, 0.04)',
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
              <Text style={{ whiteSpace: 'pre-wrap' }} fz="15px" lh={1.65}>
                {message.content}
              </Text>
            ) : (
              <>
                <MarkdownRenderer
                  content={isStreaming ? message.content : processedContent}
                  onLinkClick={handleLinkClickStable}
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

          {/* Selection Toolbar */}
          {selection && !isUser && onAddCard && (
            <Portal>
              <Box
                data-quick-add-btn
                style={{
                  position: 'fixed',
                  top:
                    selection.toolbar.placement === 'top'
                      ? selection.toolbar.y - 12
                      : selection.toolbar.y + 12,
                  left: selection.toolbar.x,
                  zIndex: 1000,
                  cursor: 'default',
                  transform:
                    selection.toolbar.placement === 'top'
                      ? 'translate(-50%, -100%)'
                      : 'translate(-50%, 0)',
                }}
              >
                <Box style={{ animation: 'fadeIn 0.15s ease-out' }}>
                  <Button
                    size="compact-sm"
                    radius="xl"
                    variant="white"
                    leftSection={<Quote size={16} />}
                    onMouseDown={(e) => e.preventDefault()} // keep selection stable until click
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExplainSelection();
                    }}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid var(--mantine-color-gray-2)',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
                    }}
                    styles={{
                      root: { height: 34, paddingInline: 14 },
                      label: { fontWeight: 650 },
                    }}
                  >
                    Explain
                  </Button>
                </Box>
              </Box>
            </Portal>
          )}
        </Box>
      </Box>
    </Group>
  );
};
