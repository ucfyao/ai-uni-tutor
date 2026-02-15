import { Check, Copy, Quote, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Image,
  Portal,
  SimpleGrid,
  Text,
  Tooltip,
} from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import { injectLinks, KnowledgeCard } from '@/lib/contentParser';
import { ChatMessage, TutoringMode } from '@/types/index';

const MarkdownRenderer = dynamic(() => import('../MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});

// Relative time formatting (hoisted outside component)
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

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
  onRegenerate?: (messageId: string) => void;
}

const MessageActionBar: React.FC<{
  isUser: boolean;
  content: string;
  messageId: string;
  timestamp: number;
  onRegenerate?: (messageId: string) => void;
}> = ({ isUser, content, messageId, timestamp, onRegenerate }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [content]);

  return (
    <Group
      gap={2}
      mt={6}
      className="message-actions"
      style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
    >
      <Tooltip label={copied ? t.chat.copied : t.chat.copy} position="bottom" withArrow>
        <ActionIcon
          variant="subtle"
          color={copied ? 'teal' : 'gray'}
          size={28}
          radius="md"
          onClick={handleCopy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </ActionIcon>
      </Tooltip>

      {!isUser && onRegenerate && (
        <Tooltip label={t.chat.regenerate} position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={28}
            radius="md"
            onClick={() => onRegenerate(messageId)}
          >
            <RefreshCw size={14} />
          </ActionIcon>
        </Tooltip>
      )}
      <Text size="xs" c="dimmed" ml={4}>
        {formatRelativeTime(timestamp)}
      </Text>
    </Group>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStreamingComplete,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mode: _mode,
  knowledgeCards = [],
  onHighlightClick,
  onAddCard,
  onRegenerate,
}) => {
  const { t } = useLanguage();
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
      if (windowSelection && windowSelection.toString().trim().length > 0) {
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

  // Consolidated selection event listeners
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

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-quick-add-btn]')) return;
      if (target.closest('[data-message-bubble]')) return;
      setSelection(null);
    };

    const onMouseUp = () => {
      requestAnimationFrame(() => {
        if (!window.getSelection()?.toString().trim()) {
          setSelection(null);
        }
      });
    };

    const clear = () => setSelection(null);

    const rafId = requestAnimationFrame(() => {
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

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [selection, handleExplainSelection]);

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

  return (
    <Box
      data-message-bubble
      style={{
        width: isUser ? 'auto' : '100%',
        maxWidth: isUser ? '85%' : '100%',
      }}
    >
      <Box
        w="100%"
        p="12px 16px"
        onMouseUp={handleMouseUp} // Listen for selection
        style={{
          borderRadius: isUser ? '18px 18px 4px 18px' : '16px',
          background: isUser
            ? 'linear-gradient(135deg, var(--mantine-color-gray-0), var(--mantine-color-gray-1))'
            : 'transparent',
          borderWidth: isUser ? '1px' : 0,
          borderStyle: 'solid',
          borderColor: isUser ? 'var(--mantine-color-gray-2)' : 'transparent',
          boxShadow: isUser ? '0 1px 6px rgba(0, 0, 0, 0.03)' : 'none',
          color: isUser ? 'var(--mantine-color-text)' : 'inherit',
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
                tight
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
                    backgroundColor: 'var(--mantine-color-body)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--mantine-color-default-border)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12)',
                  }}
                  styles={{
                    root: { height: 34, paddingInline: 14 },
                    label: { fontWeight: 650 },
                  }}
                >
                  {t.chat.explain}
                </Button>
              </Box>
            </Box>
          </Portal>
        )}
      </Box>

      {/* Message Action Bar - outside bubble */}
      {!isStreaming && (
        <MessageActionBar
          isUser={isUser}
          content={message.content}
          messageId={message.id}
          timestamp={message.timestamp}
          onRegenerate={onRegenerate}
        />
      )}
    </Box>
  );
};
