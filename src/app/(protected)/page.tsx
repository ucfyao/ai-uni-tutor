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
      <Center h="100%">
        <Container size="xl" w="100%">
          <Stack align="center" gap={48} ta="center">
            <Stack align="center" gap={0}>
              <Box mb={24} className="animate-in fade-in zoom-in duration-700 ease-out">
                <Logo size={120} alt="AI Uni Tutor" />
              </Box>

              <Stack gap={12} align="center" mb={16}>
                <Title
                  order={1}
                  fw={800}
                  c="dark.9"
                  style={{ fontSize: '36px', letterSpacing: '-1.5px' }}
                >
                  AI Uni Tutor
                </Title>
                <Text c="dark.5" size="lg" fw={500} maw={560} mx="auto">
                  Choose your learning mode to start your personalized study session.
                </Text>
              </Stack>
            </Stack>

            <Container size="50rem" w="100%">
              <ModeSelectionGrid onModeSelect={handleModeClick} />
            </Container>
          </Stack>
        </Container>
      </Center>

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
