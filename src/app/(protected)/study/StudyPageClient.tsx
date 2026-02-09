'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ModeSelectionGrid } from '@/components/chat/ModeSelectionGrid';
import NewSessionModal from '@/components/NewSessionModal';
import { Logo } from '@/components/ui/Logo';
import { MODES_METADATA } from '@/constants/modes';
import { useSessions } from '@/context/SessionContext';
import { Course, TutoringMode } from '@/types/index';

export function StudyPageClient() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [selectedMode, setSelectedMode] = useState<TutoringMode | null>(null);
  const router = useRouter();
  const { addSession } = useSessions();

  const handleCourseSelected = async (course: Course, mode: TutoringMode) => {
    closeModal();

    // Create session with mode and navigate using /{mode-id}/{session-id} pattern
    const newId = await addSession(course, mode);
    if (newId) {
      const modeRoute = MODES_METADATA[mode].id;
      router.push(`/${modeRoute}/${newId}`);
    }
  };

  const handleModeClick = (mode: TutoringMode) => {
    setSelectedMode(mode);
    openModal();
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
                  // Use CSS to control responsive size
                  width: 'var(--logo-size)',
                  height: 'var(--logo-size)',
                  ['--logo-size' as string]: '64px',
                }}
                className="study-logo-wrapper sm:[--logo-size:88px]"
              >
                {/* 
                  Pass a static large size to Next.js Image for resolution,
                  but let CSS control the actual display size.
                */}
                <Logo size={112} alt="AI Uni Tutor" style={{ width: '100%', height: '100%' }} />
              </Box>

              <Stack
                gap={{ base: '10px', sm: '14px' }}
                align="center"
                mb={{ base: '20px', sm: '28px' }}
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
                  AI Uni Tutor
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
                  Choose a learning mode, pick your course, and start your personalized session.
                </Text>
              </Stack>
            </Stack>

            <ModeSelectionGrid onModeSelect={handleModeClick} fillWidth />
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
