import { Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Container,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Transition,
} from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import { MODES_METADATA } from '@/constants/modes';
import { useLanguage } from '@/i18n/LanguageContext';
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
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const metadata = MODES_METADATA[mode];
  const Icon = metadata?.icon || Sparkles;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Container size="md" h="100%">
      {/* Keep symmetric vertical padding so the hero doesn't hug the header */}
      <Center h="100%" py={{ base: 48, sm: 64 }}>
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
                    style={{ border: '3px solid var(--mantine-color-body)' }}
                  >
                    <Sparkles size={12} fill="white" />
                  </ThemeIcon>
                </Box>

                <Stack gap={2} align="center">
                  <Title order={2} fw={800} size={24}>
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
                  {t.chat.suggestedActions}
                </Text>
                <Group gap="sm" wrap="wrap" justify="center">
                  {metadata.suggestedPrompts?.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="light"
                      color="gray"
                      radius="xl"
                      size="sm"
                      leftSection={<IconMessageCircle size={14} />}
                      onClick={() => onPromptSelect(prompt)}
                      styles={{
                        root: {
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            backgroundColor: `var(--mantine-color-${metadata.color}-0)`,
                          },
                        },
                      }}
                    >
                      {prompt}
                    </Button>
                  ))}
                </Group>
              </Box>
            )}
          </Transition>
        </Stack>
      </Center>
    </Container>
  );
};
