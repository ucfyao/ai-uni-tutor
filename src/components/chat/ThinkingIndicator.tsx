import React, { useEffect, useState } from 'react';
import { Box, Stack, Text } from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import { TutoringMode } from '@/types';

interface ThinkingIndicatorProps {
  mode?: TutoringMode | null;
}

const barWidths = ['60%', '80%', '45%'];

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ mode }) => {
  const { t } = useLanguage();
  const [phraseIndex, setPhraseIndex] = useState(0);

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

  useEffect(() => {
    if (phrases.length <= 1) return;

    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  const shimmerColor =
    mode === 'Assignment Coach' ? getDocColor('assignment') : getDocColor('lecture');

  return (
    <Box>
      <Stack gap={6} mb={8}>
        {barWidths.map((width, i) => (
          <Box
            key={i}
            className="shimmer-bar"
            h={12}
            style={{
              width,
              borderRadius: 6,
              background: `linear-gradient(90deg, var(--mantine-color-${shimmerColor}-1) 0%, var(--mantine-color-${shimmerColor}-2) 40%, var(--mantine-color-${shimmerColor}-1) 60%, var(--mantine-color-${shimmerColor}-1) 100%)`,
              backgroundSize: '200% 100%',
              animation: `shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Stack>
      <Text fz="xs" c="dimmed">
        {text}
      </Text>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-bar { animation: none !important; }
        }
      `}</style>
    </Box>
  );
};
