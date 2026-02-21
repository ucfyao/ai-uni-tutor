import type { ReactNode } from 'react';
import { Stack } from '@mantine/core';
import type { MantineSpacing } from '@mantine/core';

interface AdminContentProps {
  gap?: MantineSpacing;
  children: ReactNode;
}

export function AdminContent({ gap = 'lg', children }: AdminContentProps) {
  return (
    <Stack gap={gap} p="lg" maw={1200} mx="auto">
      {children}
    </Stack>
  );
}
