import React, { useState, useEffect } from 'react';
import { Box, Group, Text, Popover, Button, TextInput } from '@mantine/core'; // Add Popover, Button, TextInput
import MarkdownRenderer from '../MarkdownRenderer';
import { Typewriter } from '../ui/Typewriter';
import { ChatMessage, TutoringMode } from '@/types/index';
import { Presentation, Compass, FileQuestion, Bot, Plus } from 'lucide-react'; // Add Plus
import { KnowledgeCard, injectLinks } from '@/lib/contentParser';

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
  onStreamingComplete,
  mode,
  knowledgeCards = [],
  onHighlightClick,
  onAddCard
}) => {
  const isUser = message.role === 'user';
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  // Handle Text Selection
  const handleMouseUp = () => {
    if (isUser || !onAddCard) return; // Only allow adding from AI response for now? Or user too? Let's say AI only for 'Knowledge'.

    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 0) {
      const text = windowSelection.toString().trim();
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate relative position or use fixed? 
      // Popover target needs an element. We can use a virtual element or absolute box.
      setSelection({
        text: text,
        x: rect.left + rect.width / 2,
        y: rect.top
      });
      setPopoverOpened(true);
      setCustomTitle(text.split(' ').slice(0, 3).join(' ')); // Default title estimate
    } else {
       // Only close if we are not interacting with the popover itself (which is handled by Popover's logic usually)
       // But clicking outside text clears selection.
    }
  };

  // Close selection on generic click if not selecting
  useEffect(() => {
    const clearSelection = () => {
        // Validation logic to ensure we don't close when clicking INSIDE the popover
        // This is tricky with React Portals.
        // For simple MVP: reliance on Popover's outside click + text selection logic.
        if (!window.getSelection()?.toString()) {
            setPopoverOpened(false);
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
            return { icon: Presentation, color: 'indigo', gradient: 'var(--mantine-color-indigo-1)', iconColor: 'var(--mantine-color-indigo-6)' };
        case 'Assignment Coach':
            return { icon: Compass, color: 'violet', gradient: 'var(--mantine-color-violet-1)', iconColor: 'var(--mantine-color-violet-6)' };
        case 'Exam Prep':
            return { icon: FileQuestion, color: 'grape', gradient: 'var(--mantine-color-grape-1)', iconColor: 'var(--mantine-color-grape-6)' };
        default:
            return { icon: Bot, color: 'dark', gradient: 'var(--mantine-color-gray-1)', iconColor: 'var(--mantine-color-dark-4)' };
    }
  }, [mode, isUser]);

  return (
    <Group 
      align="flex-start" 
      justify={isUser ? 'flex-end' : 'flex-start'}
      wrap="nowrap" 
      gap="sm"
      px="md"
      my={4}
    >
      {!isUser && (
        <Box mt={4}>
          <Box 
            bg={botConfig.gradient}
            w={40} h={40} 
            style={{ 
                borderRadius: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: `1px solid ${botConfig.iconColor}20` 
            }}
          >
             {botConfig.icon && <botConfig.icon size={22} color={botConfig.iconColor} strokeWidth={2} />}
          </Box>
        </Box>
      )}

      <Box style={{ maxWidth: '85%' }}> 
        <Box 
          p={isUser ? '12px 20px' : 0}
          onMouseUp={handleMouseUp} // Listen for selection
          style={{ 
            borderRadius: isUser ? '20px 20px 4px 20px' : 0, 
            background: isUser ? 'var(--mantine-color-gray-1)' : 'none', // Minimalist Light Gray
            boxShadow: 'none', // Flat style
            color: isUser ? 'var(--mantine-color-dark-9)' : 'inherit',
            position: 'relative' // For positioning context if needed
          }}
        >
          
          <Box className="markdown-content" c={isUser ? 'dark.9' : 'dark.8'}>
            {isUser ? (
              <Text style={{ whiteSpace: 'pre-wrap' }} fz="17px" lh={1.6}>{message.content}</Text>
            ) : (
              isStreaming ? (
                <Typewriter content={message.content} onComplete={onStreamingComplete} />
              ) : (
                <MarkdownRenderer content={processedContent} onLinkClick={handleLinkClick} />
              )
            )}
          </Box>

            {/* Selection Popover */}
            {selection && !isUser && (
                <Popover 
                    opened={popoverOpened} 
                    onChange={setPopoverOpened}
                    width={300}
                    position="top"
                    withArrow
                    shadow="md"
                    styles={{ dropdown: { padding: '8px' } }}
                >
                    <Popover.Target>
                        <Box 
                            style={{ 
                                position: 'fixed', 
                                top: selection.y - 10, 
                                left: selection.x, 
                                width: 1, 
                                height: 1, 
                                pointerEvents: 'none' 
                            }} 
                        />
                    </Popover.Target>
                    <Popover.Dropdown style={{ pointerEvents: 'auto' }}>
                        <Box>
                            <Text size="xs" fw={700} mb={4}>Add Knowledge Card</Text>
                            <TextInput 
                                size="xs" 
                                placeholder="Title" 
                                value={customTitle} 
                                onChange={(e) => setCustomTitle(e.currentTarget.value)}
                                mb={8}
                                autoFocus
                            />
                            <Text size="xs" c="dimmed" lineClamp={2} mb={8} fs="italic">
                                &quot;{selection.text}&quot;
                            </Text>
                            <Button 
                                size="xs" 
                                fullWidth 
                                leftSection={<Plus size={14} />}
                                onClick={() => {
                                    if (onAddCard) {
                                        onAddCard(customTitle, selection.text);
                                        setPopoverOpened(false);
                                        setSelection(null);
                                        window.getSelection()?.removeAllRanges();
                                    }
                                }}
                            >
                                Add to Panel
                            </Button>
                        </Box>
                    </Popover.Dropdown>
                </Popover>
            )}

        </Box>
      </Box>
    </Group>
  );
};
