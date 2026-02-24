import React from 'react';
import { Box, Group, Text } from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import { TutoringMode } from '@/types';

interface ThinkingIndicatorProps {
  mode?: TutoringMode | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ mode }) => {
  const { t } = useLanguage();

  const THINKING_TEXT: Record<string, string> = {
    'Lecture Helper': t.chat.analyzingConcepts,
    'Assignment Coach': t.chat.organizingThoughts,
  };

  const text = (mode && THINKING_TEXT[mode]) || t.chat.thinking;
  const color =
    mode === 'Assignment Coach'
      ? `var(--mantine-color-${getDocColor('assignment')}-5)`
      : `var(--mantine-color-${getDocColor('lecture')}-5)`;

  return (
    <Box p="xs">
      <Group gap={4} mb={6}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            className="thinking-dot"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: color,
              animation: `thinkingBounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
            }}
          />
        ))}
      </Group>
      <Text fz="xs" c="dimmed">
        {text}
      </Text>
      <style>{`
        @keyframes thinkingBounce {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-dot { animation: none !important; opacity: 0.7 !important; }
        }
      `}</style>
    </Box>
  );
};
