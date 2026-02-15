'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { Box, Container, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useHeader } from '@/context/HeaderContext';

interface PageShellProps {
  title: string;
  subtitle?: string;
  mobileTitle?: string;
  children: ReactNode;
}

export function PageShell({ title, subtitle, mobileTitle, children }: PageShellProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" truncate>
        {mobileTitle || title}
      </Text>
    ),
    [mobileTitle, title],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Title order={1} fz={28} fw={700} mb="xs">
            {title}
          </Title>
          {subtitle && (
            <Text c="dimmed" fz="md">
              {subtitle}
            </Text>
          )}
        </Box>
        {children}
      </Stack>
    </Container>
  );
}
