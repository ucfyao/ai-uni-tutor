import { ArrowRight, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Center,
  Container,
  Grid,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Transition,
} from '@mantine/core';
import { MODES_METADATA } from '@/constants/modes';
import { TutoringMode } from '@/types';

interface WelcomeScreenProps {
  mode: TutoringMode;
  courseCode: string; // e.g., COMP9417
  onPromptSelect: (prompt: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  mode,
  courseCode,
  onPromptSelect,
}) => {
  const [mounted, setMounted] = useState(false);
  const metadata = MODES_METADATA[mode];
  const Icon = metadata?.icon || Sparkles;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Container size="md" h="100%">
      {/* Reduced from pb=80 to pb=60, gap=40 to gap=24 */}
      <Center h="100%" pb={60}>
        <Stack align="center" gap={24} w="100%" maw={700}>
          {/* 1. Hero Section - Compact: icon 64px, gaps reduced */}
          <Transition
            mounted={mounted}
            transition="fade-down"
            duration={600}
            timingFunction="ease-out"
          >
            {(styles) => (
              <Stack align="center" gap="sm" style={styles}>
                <Box pos="relative">
                  <ThemeIcon
                    size={64}
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: `${metadata.color}.1`, to: `${metadata.color}.0`, deg: 45 }}
                    style={{ border: `1px solid var(--mantine-color-${metadata.color}-2)` }}
                  >
                    <Icon
                      size={32}
                      color={`var(--mantine-color-${metadata.color}-6)`}
                      strokeWidth={1.5}
                    />
                  </ThemeIcon>
                  {/* Decorative badge */}
                  <ThemeIcon
                    size={24}
                    radius="xl"
                    color={metadata.color}
                    variant="filled"
                    pos="absolute"
                    bottom={-2}
                    right={-2}
                    style={{ border: '3px solid white' }}
                  >
                    <Sparkles size={12} fill="white" />
                  </ThemeIcon>
                </Box>

                <Stack gap={2} align="center">
                  <Title order={2} fw={800} size={24} c="dark.8">
                    {courseCode} {metadata.label}
                  </Title>
                  <Text c="dimmed" size="md" ta="center" maw={480}>
                    {metadata.intro.replace(/\*\*.*?\*\*\n\n/, '')}
                  </Text>
                </Stack>
              </Stack>
            )}
          </Transition>

          {/* 2. Suggested Prompts Grid - Compact */}
          <Transition
            mounted={mounted}
            transition="fade-up"
            duration={600}
            timingFunction="ease-out"
          >
            {(styles) => (
              <Box w="100%" style={styles}>
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  mb="sm"
                  ta="center"
                  style={{ letterSpacing: '0.05em' }}
                >
                  Suggested Actions
                </Text>
                <Grid gutter="xs">
                  {metadata.suggestedPrompts?.map((prompt, index) => (
                    <Grid.Col span={{ base: 12, sm: 6 }} key={index}>
                      <Paper
                        component="button"
                        onClick={() => onPromptSelect(prompt)}
                        p="sm"
                        radius="md"
                        withBorder
                        bg="white"
                        className="hover-lift"
                        style={{
                          width: '100%',
                          minHeight: '68px',
                          textAlign: 'left',
                          borderColor: 'var(--mantine-color-gray-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = `var(--mantine-color-${metadata.color}-3)`;
                          e.currentTarget.style.backgroundColor = `var(--mantine-color-${metadata.color}-0)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--mantine-color-gray-2)';
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <Text size="sm" fw={500} c="dark.7" lineClamp={2} style={{ flex: 1 }}>
                          {prompt}
                        </Text>
                        <ThemeIcon variant="transparent" size="sm" c={`${metadata.color}.5`}>
                          <ArrowRight size={14} />
                        </ThemeIcon>
                      </Paper>
                    </Grid.Col>
                  ))}
                </Grid>
              </Box>
            )}
          </Transition>
        </Stack>
      </Center>
    </Container>
  );
};
