'use client';

import { ArrowUp, Compass, FileQuestion, Presentation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Box, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { startMockExamSession } from '@/app/actions/mock-exams';
import { Logo } from '@/components/Logo';
import NewSessionModal from '@/components/NewSessionModal';
import { MODES_METADATA } from '@/constants/modes';
import { useSessions } from '@/context/SessionContext';
import { showNotification } from '@/lib/notifications';
import { Course, TutoringMode } from '@/types/index';

const FEATURE_CARDS = [
  {
    label: 'Lecture Helper',
    subtitle: 'Upload slides and get key concepts explained',
    cta: 'Start Explaining',
    mode: 'Lecture Helper' as TutoringMode,
    icon: Presentation,
    color: 'indigo',
  },
  {
    label: 'Assignment Coach',
    subtitle: 'Paste your problem and get step-by-step guidance',
    cta: 'Start Solving',
    mode: 'Assignment Coach' as TutoringMode,
    icon: Compass,
    color: 'violet',
  },
  {
    label: 'Mock Exam',
    subtitle: 'Practice with AI-generated variants of real past exams',
    cta: 'Start Practicing',
    mode: 'Mock Exam' as TutoringMode,
    icon: FileQuestion,
    color: 'purple',
  },
];

export function StudyPageClient() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedMode, setSelectedMode] = useState<TutoringMode | null>(null);
  const router = useRouter();
  const { addSession } = useSessions();

  const handleCourseSelected = async (course: Course, mode: TutoringMode) => {
    closeModal();

    const newId = await addSession(course, mode);
    if (!newId) return;

    if (mode === 'Mock Exam') {
      const result = await startMockExamSession(newId, course.code);
      if (result.success) {
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        showNotification({ title: 'Error', message: result.error, color: 'red' });
      }
    } else {
      const modeRoute = MODES_METADATA[mode].id;
      router.push(`/${modeRoute}/${newId}`);
    }
  };

  const handleModeClick = (mode: TutoringMode) => {
    setSelectedMode(mode);
    openModal();
  };

  const handleCardClick = (card: (typeof FEATURE_CARDS)[number]) => {
    handleModeClick(card.mode);
  };

  return (
    <>
      <Box
        className="study-page-hero hero-radial"
        style={{
          background: 'var(--gradient-hero)',
          minHeight: '100%',
          position: 'relative',
        }}
      >
        {/* Subtle ambient glow */}
        <Box
          aria-hidden
          className="study-page-glow"
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            maxWidth: 600,
            height: '40%',
            background:
              'radial-gradient(ellipse at center, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box
          px={{ base: 16, sm: 32, md: 40 }}
          py={{ base: 16, sm: 48 }}
          maw={960}
          mx="auto"
          w="100%"
          style={{ position: 'relative', zIndex: 1 }}
        >
          <Stack align="center" className="gap-4 sm:gap-11" ta="center" w="100%">
            {/* Hero */}
            <Stack align="center" gap={0} className="study-hero-content" w="100%" maw={640}>
              <Box
                mb={{ base: 8, sm: 24 }}
                style={{
                  animation: 'study-logo-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  width: 'var(--logo-size)',
                  height: 'var(--logo-size)',
                  ['--logo-size' as string]: '64px',
                }}
                className="study-logo-wrapper sm:[--logo-size:88px]"
              >
                <Logo size={112} alt="AI Uni Tutor" style={{ width: '100%', height: '100%' }} />
              </Box>

              <Stack
                align="center"
                mb={{ base: '20px', sm: '28px' }}
                className="gap-2.5 sm:gap-3.5"
              >
                <Title
                  order={1}
                  fw={900}
                  c="dark.9"
                  style={{
                    fontSize: 'clamp(28px, 4.5vw, 44px)',
                    letterSpacing: '-0.035em',
                    lineHeight: 1.15,
                    textWrap: 'balance',
                    animation: 'study-title-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both',
                  }}
                >
                  Your AI Study Companion
                </Title>
                <Text
                  c="dark.5"
                  size="lg"
                  fw={500}
                  maw="100%"
                  mx="auto"
                  lh={1.65}
                  style={{
                    textWrap: 'balance',
                    animation: 'study-subtitle-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
                  }}
                >
                  Understand lectures instantly, get guided help on assignments, and practice with
                  real past exams.
                </Text>
              </Stack>
            </Stack>

            {/* 3 Feature Cards */}
            <SimpleGrid
              cols={{ base: 1, sm: 2, md: 3 }}
              spacing={{ base: 'md', sm: 'lg' }}
              verticalSpacing={{ base: 'md', sm: 'lg' }}
              style={{ alignContent: 'start' }}
              w="100%"
            >
              {FEATURE_CARDS.map((card, index) => {
                const Icon = card.icon;
                return (
                  <Paper
                    key={card.label}
                    shadow="sm"
                    radius="lg"
                    p={0}
                    tabIndex={0}
                    role="button"
                    aria-label={`${card.label}: ${card.subtitle}`}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      border: '1px solid var(--mantine-color-gray-2)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      height: '100%',
                      animation: 'study-mode-card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                      animationDelay: `${260 + index * 80}ms`,
                      opacity: 0,
                    }}
                    className="mode-card group hover:-translate-y-1 hover:shadow-xl hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={() => handleCardClick(card)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(card);
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
                        background: `var(--mantine-color-${card.color}-5)`,
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
                        background: `var(--mantine-color-${card.color}-0)`,
                        opacity: 0,
                        transition: 'opacity 0.22s ease',
                        pointerEvents: 'none',
                      }}
                      className="group-hover:opacity-100"
                    />

                    <Box
                      p={{ base: 'md', sm: 'lg' }}
                      h="100%"
                      className="flex flex-row sm:flex-col items-center sm:justify-center gap-4 sm:gap-4 mobile-card-layout"
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      <ThemeIcon
                        size={56}
                        radius="xl"
                        variant="light"
                        color={card.color}
                        style={{
                          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                          flexShrink: 0,
                        }}
                        className="group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-lg mobile-icon"
                      >
                        <Icon size={28} strokeWidth={2} />
                      </ThemeIcon>

                      <Stack gap={4} align="start" className="sm:items-center flex-1 min-w-0">
                        <Text
                          size="lg"
                          fw={800}
                          c="dark.9"
                          style={{ transition: 'color 0.2s ease' }}
                          className={`group-hover:text-${card.color}-7 text-left sm:text-center w-full truncate`}
                        >
                          {card.label}
                        </Text>

                        <Text size="sm" c="dimmed" lh={1.4} className="text-left sm:text-center">
                          {card.subtitle}
                        </Text>

                        <Group gap={6} align="center" mt={4} style={{ opacity: 0.9 }}>
                          <Text size="sm" fw={700} tt="uppercase" lts={0.5} c={`${card.color}.6`}>
                            {card.cta}
                          </Text>
                          <ArrowUp
                            size={16}
                            color={`var(--mantine-color-${card.color}-6)`}
                            style={{ transform: 'rotate(45deg)' }}
                            strokeWidth={3}
                          />
                        </Group>
                      </Stack>
                    </Box>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </Stack>
        </Box>
      </Box>

      <NewSessionModal
        opened={modalOpened}
        onClose={() => {
          closeModal();
          setSelectedMode(null);
        }}
        preSelectedMode={selectedMode}
        onStart={(course, mode) => handleCourseSelected(course, mode)}
      />
    </>
  );
}
