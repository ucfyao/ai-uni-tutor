'use client';

import React from 'react';
import { Box, Group, Text } from '@mantine/core';
import MarkdownRenderer from '../MarkdownRenderer';
import { Typewriter } from '../ui/Typewriter';
import { ChatMessage, TutoringMode } from '@/types/index';
import { Presentation, Compass, FileQuestion, Bot, Feather } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onStreamingComplete?: () => void;
  mode?: TutoringMode | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isStreaming = false, 
  onStreamingComplete,
  mode 
}) => {
  const isUser = message.role === 'user';

  // Bot Configuration based on Mode
  const botConfig = React.useMemo(() => {
    if (isUser) return {};
    
    // Default / Fallback
    const defaultConfig = { icon: Bot, color: 'gray', gradient: 'from-gray-100 to-gray-200' };
    
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
          style={{ 
            borderRadius: isUser ? '20px 20px 4px 20px' : 0, 
            background: isUser ? 'var(--mantine-color-gray-1)' : 'none', // Minimalist Light Gray
            boxShadow: 'none', // Flat style
            color: isUser ? 'var(--mantine-color-dark-9)' : 'inherit'
          }}
        >
          {/* Removed AI Tutor Text Label */}
          
          <Box className="markdown-content" c={isUser ? 'dark.9' : 'dark.8'}>
            {isUser ? (
              <Text style={{ whiteSpace: 'pre-wrap' }} fz="15px" lh={1.6}>{message.content}</Text>
            ) : (
              isStreaming ? (
                <Typewriter content={message.content} onComplete={onStreamingComplete} />
              ) : (
                <MarkdownRenderer content={message.content} />
              )
            )}
          </Box>
        </Box>
      </Box>
    </Group>
  );
};
