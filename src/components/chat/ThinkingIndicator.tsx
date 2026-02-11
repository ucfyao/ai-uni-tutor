import React from 'react';
import { Box, Group, Text } from '@mantine/core';
import { TutoringMode } from '@/types';

const THINKING_TEXT: Record<string, string> = {
  'Lecture Helper': '正在分析概念...',
  'Assignment Coach': '正在梳理思路...',
};

interface ThinkingIndicatorProps {
  mode?: TutoringMode | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ mode }) => {
  const text = (mode && THINKING_TEXT[mode]) || '正在思考...';
  const color =
    mode === 'Assignment Coach' ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-indigo-5)';

  return (
    <Group gap="sm" py={4}>
      <Group gap={4}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: color,
              animation: `thinkingBounce 0.6s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </Group>
      <Text size="sm" c="dimmed" fw={500}>
        {text}
      </Text>
    </Group>
  );
};
