import { ArrowUp, Bot } from 'lucide-react';
import React from 'react';
import {
  Avatar,
  Box,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { ModeMetadata, MODES_LIST } from '@/constants/modes';
import { ChatMessage, ChatSession, TutoringMode } from '@/types';

interface ModeSelectionGridProps {
  session?: ChatSession | null;
  onUpdateSession?: (session: ChatSession) => void;
  onModeSelect?: (mode: TutoringMode) => void; // For homepage usage without session
}

export const ModeSelectionGrid: React.FC<ModeSelectionGridProps> = ({
  session,
  onUpdateSession,
  onModeSelect,
}) => {
  const handleModeSelect = (mode: ModeMetadata) => {
    // If onModeSelect provided (homepage), use that
    if (onModeSelect) {
      onModeSelect(mode.label);
      return;
    }

    // Otherwise use session update (in-chat mode selection)
    if (!session || !onUpdateSession) return;

    const welcomeMsg: ChatMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: mode.intro,
      timestamp: Date.now(),
    };
    onUpdateSession({
      ...session,
      mode: mode.label,
      messages: [welcomeMsg],
    });
  };

  return (
    <Stack flex={1} px="md" justify="center" gap={64} style={{ overflowY: 'auto' }}>
      <Container size="50rem" w="100%">
        <Stack gap={64}>
          {/* Welcome Hero Section - Only show if in session */}
          {session && (
            <Stack align="center" gap={32} ta="center">
              <Avatar
                size={90}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }}
                className="shadow-2xl"
              >
                <Bot size={44} className="text-white" />
              </Avatar>

              <Stack gap={12}>
                <Text
                  c="dark.9"
                  style={{
                    fontSize: '36px',
                    fontWeight: 800,
                    letterSpacing: '-1.5px',
                    lineHeight: 1.1,
                    textBalance: 'balance',
                  }}
                >
                  Welcome to{' '}
                  <span
                    style={{
                      background:
                        'linear-gradient(45deg, var(--mantine-color-indigo-6), var(--mantine-color-violet-6))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {session.course.code}
                  </span>
                </Text>
                <Text
                  c="dark.4"
                  size="lg"
                  fw={500}
                  maw={560}
                  mx="auto"
                  lh={1.6}
                  style={{ textWrap: 'balance' }}
                >
                  Choose your learning path below to start the conversation.
                </Text>
              </Stack>
            </Stack>
          )}

          {/* Quick Actions Grid */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" verticalSpacing="lg">
            {MODES_LIST.map((mode) => {
              const Icon = mode.icon;

              return (
                <Tooltip
                  key={mode.id}
                  label={
                    <Text size="xs" maw={220} style={{ whiteSpace: 'pre-wrap' }}>
                      {mode.intro.replace(/\*\*/g, '')}
                    </Text>
                  }
                  multiline
                  position="top"
                  withArrow
                  transitionProps={{ duration: 200, transition: 'pop' }}
                  color="dark"
                >
                  <Paper
                    shadow="sm"
                    radius="lg"
                    p="lg"
                    tabIndex={0}
                    role="button"
                    aria-label={`Select ${mode.label} mode: ${mode.desc}`}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      border: '1px solid var(--mantine-color-gray-2)',
                      position: 'relative',
                      transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      minHeight: '140px',
                    }}
                    className={`group ${mode.hoverClass} hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2`}
                    onClick={() => handleModeSelect(mode)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleModeSelect(mode);
                      }
                    }}
                  >
                    <Stack gap="sm" h="100%" justify="space-between">
                      <Group justify="space-between" align="start">
                        <ThemeIcon
                          size={48}
                          radius="md"
                          variant="light"
                          color={mode.color}
                          className="transition-transform duration-300 group-hover:scale-110"
                        >
                          <Icon size={24} strokeWidth={2} />
                        </ThemeIcon>

                        <Box
                          c={`${mode.color}.6`}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-8px] group-hover:translate-x-0"
                        >
                          <ArrowUp
                            size={20}
                            style={{ transform: 'rotate(45deg)' }}
                            strokeWidth={2.5}
                          />
                        </Box>
                      </Group>

                      <Box>
                        <Text
                          size="md"
                          fw={700}
                          c="dark.9"
                          lh={1.2}
                          mb={4}
                          className={`group-hover:text-${mode.color === 'indigo' ? 'indigo-700' : 'dark-9'} transition-colors`}
                        >
                          {mode.label}
                        </Text>
                        <Text size="sm" c="gray.6" lh={1.4} lineClamp={2}>
                          {mode.desc}
                        </Text>
                      </Box>
                    </Stack>
                  </Paper>
                </Tooltip>
              );
            })}
          </SimpleGrid>
        </Stack>
      </Container>
    </Stack>
  );
};
