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
import { useLanguage } from '@/i18n/LanguageContext';
import { ChatMessage, ChatSession, TutoringMode } from '@/types';

interface ModeSelectionGridProps {
  session?: ChatSession | null;
  onUpdateSession?: (session: ChatSession) => void;
  onModeSelect?: (mode: TutoringMode) => void; // For homepage usage without session
  /** When true (study page), fill parent width and use same alignment as parent container */
  fillWidth?: boolean;
}

export const ModeSelectionGrid: React.FC<ModeSelectionGridProps> = ({
  session,
  onUpdateSession,
  onModeSelect,
  fillWidth = false,
}) => {
  const { t } = useLanguage();
  const isStandalone = !session;

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

  const content = (
    <Stack gap={isStandalone ? 40 : 64} w="100%">
      {/* Welcome Hero Section - Only show if in session */}
      {session && (
        <Stack align="center" gap={32} ta="center">
          <Avatar
            size={90}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'indigo.7', to: 'indigo.3', deg: 45 }}
            className="shadow-2xl"
          >
            <Bot size={44} className="text-white" />
          </Avatar>

          <Stack gap={12}>
            <Text
              style={{
                fontSize: '36px',
                fontWeight: 800,
                letterSpacing: '-1.5px',
                lineHeight: 1.1,
                textBalance: 'balance',
              }}
            >
              {t.chat.welcomeMessage}{' '}
              <span
                style={{
                  background:
                    'linear-gradient(45deg, var(--mantine-color-indigo-7), var(--mantine-color-indigo-3))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {session.course.code}
              </span>
            </Text>
            <Text
              c="dimmed"
              size="lg"
              fw={500}
              maw={560}
              mx="auto"
              lh={1.6}
              style={{ textWrap: 'balance' }}
            >
              {t.chat.chooseLearningPath}
            </Text>
          </Stack>
        </Stack>
      )}

      {/* Quick Actions Grid */}
      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        spacing={{ base: 'md', sm: 'lg' }}
        verticalSpacing={{ base: 'md', sm: 'lg' }}
        style={{ alignContent: 'start' }}
      >
        {MODES_LIST.map((mode, index) => {
          const Icon = mode.icon;
          const delay = isStandalone ? index * 80 : 0;

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
                p={0}
                tabIndex={0}
                role="button"
                aria-label={`Select ${mode.label} mode: ${mode.desc}`}
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--mantine-color-default-border)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  height: '100%',
                  ...(isStandalone && {
                    animation: 'study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                    animationDelay: `${260 + delay}ms`,
                    opacity: 0,
                  }),
                }}
                className="mode-card group hover:-translate-y-1 hover:shadow-xl hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                onClick={() => handleModeSelect(mode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleModeSelect(mode);
                  }
                }}
              >
                {/* Colored accent bar on hover */}
                <Box
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '4px',
                    background: `var(--mantine-color-${mode.color}-5)`,
                    transformOrigin: 'top',
                    transition: 'transform 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                    zIndex: 2,
                  }}
                  className="scale-y-0 group-hover:scale-y-100 mobile-accent-bar"
                />

                {/* Subtle background tint on hover */}
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `var(--mantine-color-${mode.color}-0)`,
                    opacity: 0,
                    transition: 'opacity 0.22s ease',
                    pointerEvents: 'none',
                  }}
                  className="group-hover:opacity-100"
                />

                {/* 
                   RESPONSIVE LAYOUT 
                   Desktop: Vertical Stack (Center)
                   Mobile: Horizontal Group (Left-aligned)
                */}
                <Box
                  p={{ base: 'md', sm: 'lg' }}
                  h="100%"
                  className="flex flex-row sm:flex-col items-center sm:justify-center gap-4 sm:gap-4 mobile-card-layout"
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <ThemeIcon
                    size={56} // Fixed size for both, visually balanced
                    radius="xl"
                    variant="light"
                    color={mode.color}
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      flexShrink: 0,
                    }}
                    className="group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-lg mobile-icon"
                  >
                    <Icon size={28} strokeWidth={2} />
                  </ThemeIcon>

                  <Stack gap={2} align="start" className="sm:items-center flex-1 min-w-0">
                    <Text
                      size="lg"
                      fw={800}
                      c="var(--mantine-color-text)"
                      style={{
                        transition: 'color 0.2s ease',
                      }}
                      className={`group-hover:text-${mode.color}-7 text-left sm:text-center w-full truncate`}
                    >
                      {mode.label}
                    </Text>

                    <Group gap={6} align="center" style={{ opacity: 0.9 }}>
                      <Text size="sm" fw={700} tt="uppercase" lts={0.5} c={`${mode.color}.6`}>
                        {t.chat.startSession}
                      </Text>
                      <ArrowUp
                        size={16}
                        color={`var(--mantine-color-${mode.color}-6)`}
                        style={{ transform: 'rotate(45deg)' }}
                        strokeWidth={3}
                      />
                    </Group>
                  </Stack>
                </Box>
              </Paper>
            </Tooltip>
          );
        })}
      </SimpleGrid>
    </Stack>
  );

  if (fillWidth && isStandalone) {
    return content;
  }

  return (
    <Stack
      flex={isStandalone ? undefined : 1}
      px={isStandalone ? 0 : 'md'}
      justify={isStandalone ? undefined : 'center'}
      gap={isStandalone ? 40 : 64}
      style={isStandalone ? undefined : { overflowY: 'auto' }}
    >
      <Container size="50rem" w="100%">
        {content}
      </Container>
    </Stack>
  );
};
