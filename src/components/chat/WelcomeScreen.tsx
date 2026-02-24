import { Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Center,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Transition,
} from '@mantine/core';
import { getCommandsForMode, type ChatCommand } from '@/constants/commands';
import { MODES_METADATA } from '@/constants/modes';
import { useLanguage } from '@/i18n/LanguageContext';
import { TutoringMode } from '@/types';

interface WelcomeScreenProps {
  mode: TutoringMode;
  courseCode: string;
  onCommandSelect: (command: ChatCommand) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  mode,
  courseCode,
  onCommandSelect,
}) => {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const metadata = MODES_METADATA[mode];
  const Icon = metadata?.icon || Sparkles;
  const commands = getCommandsForMode(mode);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Container size="md" h="100%">
      <Center h="100%" py={{ base: 48, sm: 64 }}>
        <Stack align="center" gap={24} w="100%" maw={700}>
          {/* 1. Hero Section */}
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

          {/* 2. Command Cards Grid */}
          <Transition
            mounted={mounted}
            transition="fade-up"
            duration={600}
            timingFunction="ease-out"
          >
            {(styles) => (
              <Box w="100%" style={styles}>
                <Group gap={6} justify="center" mb="sm">
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    tt="uppercase"
                    ta="center"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    {t.chat.suggestedActions}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ opacity: 0.6 }}>
                    ·
                  </Text>
                  <Text size="xs" c="dimmed" style={{ opacity: 0.6 }}>
                    {t.chat.typeSlash}
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                  {commands.map((cmd) => {
                    const cmdT = (
                      t.chat.commands as Record<string, { label: string; desc: string }>
                    )[cmd.labelKey];
                    const CmdIcon = cmd.icon;
                    return (
                      <Paper
                        key={cmd.id}
                        p="md"
                        radius="lg"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderColor: 'var(--mantine-color-default-border)',
                        }}
                        styles={{
                          root: {
                            '&:hover': {
                              borderColor: `var(--mantine-color-${cmd.color}-3)`,
                              backgroundColor: `var(--mantine-color-${cmd.color}-0)`,
                              transform: 'translateY(-1px)',
                              boxShadow: `0 4px 12px color-mix(in srgb, var(--mantine-color-${cmd.color}-3) 25%, transparent)`,
                            },
                            '&:active': {
                              transform: 'translateY(0)',
                            },
                          },
                        }}
                        onClick={() => onCommandSelect(cmd)}
                      >
                        <Group gap="sm" wrap="nowrap" align="flex-start">
                          <ThemeIcon
                            size={36}
                            radius="md"
                            variant="light"
                            color={cmd.color}
                            style={{ flexShrink: 0 }}
                          >
                            <CmdIcon size={18} strokeWidth={1.8} />
                          </ThemeIcon>
                          <Box style={{ minWidth: 0 }}>
                            <Group gap={6} align="center">
                              <Text fw={600} size="sm" truncate>
                                {cmdT?.label ?? cmd.id}
                              </Text>
                              <Text size="xs" c={`${cmd.color}.5`} fw={500} ff="monospace">
                                {cmd.command}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                              {cmdT?.desc ?? ''}
                            </Text>
                          </Box>
                        </Group>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Box>
            )}
          </Transition>
        </Stack>
      </Center>
    </Container>
  );
};
