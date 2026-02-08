'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Box, Center, Container, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ModeSelectionGrid } from '@/components/chat/ModeSelectionGrid';
import NewSessionModal from '@/components/NewSessionModal';
import { Logo } from '@/components/ui/Logo';
import { MODES_METADATA } from '@/constants/modes';
import { useSessions } from '@/context/SessionContext';
import { Course, TutoringMode } from '@/types/index';

export default function HomePage() {
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
        h="100%"
        className="hero-radial"
        style={{
          background: 'var(--gradient-hero)',
        }}
      >
        <Center h="100%">
          <Container size="xl" w="100%" py={48}>
            <Stack align="center" gap={40} ta="center">
              <Stack align="center" gap={0}>
                <Box mb={20} className="animate-in fade-in zoom-in duration-700 ease-out">
                  <Logo size={112} alt="AI Uni Tutor" />
                </Box>

                <Stack gap={10} align="center" mb={12}>
                  <Title
                    order={1}
                    fw={850}
                    c="dark.9"
                    style={{
                      fontSize: 'clamp(30px, 3.6vw, 40px)',
                      letterSpacing: '-1.5px',
                      lineHeight: 1.1,
                      textWrap: 'balance',
                    }}
                  >
                    AI Uni Tutor
                  </Title>
                  <Text c="dark.5" size="md" fw={500} maw={560} mx="auto" lh={1.6}>
                    Choose your learning mode to start your personalized study session.
                  </Text>
                </Stack>
              </Stack>

              <ModeSelectionGrid onModeSelect={handleModeClick} />
            </Stack>
          </Container>
        </Center>
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
