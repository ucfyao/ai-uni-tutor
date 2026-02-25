import React, { useEffect, useState } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import { TutoringMode } from '@/types';

interface ThinkingIndicatorProps {
  mode?: TutoringMode | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ mode }) => {
  const { t } = useLanguage();
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    // Array of string from translations
    const defaultPhrases = (t.chat as any).thinkingPhrases as string[] | undefined;
    const phrases = mode
      ? [
          mode === 'Assignment Coach' ? t.chat.organizingThoughts : t.chat.analyzingConcepts,
          ...(defaultPhrases || []),
        ]
      : defaultPhrases || [];

    if (!phrases || phrases.length <= 1) return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [t.chat, mode]);

  const THINKING_TEXT: Record<string, string> = {
    'Lecture Helper': t.chat.analyzingConcepts,
    'Assignment Coach': t.chat.organizingThoughts,
  };

  const modeText = mode ? THINKING_TEXT[mode] : null;
  const defaultPhrases = (t.chat as any).thinkingPhrases as string[] | undefined;

  const phrases = modeText
    ? [modeText, ...(defaultPhrases || [])]
    : defaultPhrases || [t.chat.thinking];
  const text = phrases[phraseIndex % phrases.length] || t.chat.thinking;

  const color =
    mode === 'Assignment Coach'
      ? `var(--mantine-color-${getDocColor('assignment')}-5)`
      : `var(--mantine-color-${getDocColor('lecture')}-5)`;

  return (
    <Group gap="sm" align="center">
      <Group gap={4}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            className="thinking-dot"
            style={{
              width: 5,
              height: 5,
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
    </Group>
  );
};
