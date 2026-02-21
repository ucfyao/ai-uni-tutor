import React from 'react';
import { Box, Text } from '@mantine/core';
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
      <Box
        h={4}
        w={120}
        mb={6}
        className="shimmer-bar"
        style={{
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <Text fz="xs" c="dimmed">
        {text}...
      </Text>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-bar { animation: none !important; }
        }
      `}</style>
    </Box>
  );
};
