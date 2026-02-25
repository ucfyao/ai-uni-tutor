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
                  {/* Radial gradient glow */}
                  <Box
                    pos="absolute"
                    w={300}
                    h={300}
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      borderRadius: '50%',
                      background: `radial-gradient(circle, var(--mantine-color-${metadata.color}-1) 0%, transparent 70%)`,
                      opacity: 0.6,
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />
                  <ThemeIcon
                    size={64}
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: `${metadata.color}.1`, to: `${metadata.color}.0`, deg: 45 }}
                    style={{
                      border: `1px solid var(--mantine-color-${metadata.color}-2)`,
                      position: 'relative',
                      zIndex: 1,
                    }}
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
                    style={{
                      border: '3px solid var(--mantine-color-body)',
                      zIndex: 1,
                    }}
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
              <SimpleGrid w="100%" cols={{ base: 1, xs: 2 }} spacing="sm" style={styles}>
                {commands.map((cmd, index) => {
                  const cmdT = (t.chat.commands as Record<string, { label: string; desc: string }>)[
                    cmd.labelKey
                  ];
                  const CmdIcon = cmd.icon;
                  return (
                    <Paper
                      key={cmd.id}
                      className="cmd-card"
                      p="md"
                      radius="lg"
                      withBorder
                      style={
                        {
                          cursor: 'pointer',
                          borderColor: 'var(--mantine-color-default-border)',
                          opacity: mounted ? 1 : 0,
                          transition: `opacity 0.4s ease-out ${index * 80}ms, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s, background-color 0.3s, box-shadow 0.3s`,
                          '--cmd-color-border': `var(--mantine-color-${cmd.color}-4)`,
                          '--cmd-color-bg': `var(--mantine-color-${cmd.color}-0)`,
                          '--cmd-color-shadow': `0 8px 24px color-mix(in srgb, var(--mantine-color-${cmd.color}-4) 25%, transparent)`,
                        } as React.CSSProperties
                      }
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
            )}
          </Transition>
        </Stack>
      </Center>
    </Container>
  );
};
