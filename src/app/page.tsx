'use client';

import { Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Box, Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import NewSessionModal from '@/components/NewSessionModal';
import { useSessions } from '@/context/SessionContext';
import { Course, TutoringMode } from '@/types/index';

export default function Page() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const router = useRouter();
  const { addSession } = useSessions();

  const handleStartSession = async (course: Course, mode: TutoringMode | null) => {
    closeModal();
    const newId = await addSession(course, mode);
    if (newId) {
      router.push(`/chat/${newId}`);
    }
  };

  return (
    <>
      <Center h="100%">
        <Container size="xs" w="100%">
          <Stack align="center" gap={0} ta="center">
            <Box mb={24} className="animate-in fade-in zoom-in duration-700 ease-out">
              <Image src="/assets/logo.png" alt="AI Uni Tutor" width={120} height={120} />
            </Box>

            <Stack gap={12} align="center" mb={40}>
              <Title
                order={1}
                fw={800}
                c="dark.9"
                style={{ fontSize: '36px', letterSpacing: '-1.5px' }}
              >
                AI Uni Tutor
              </Title>
              <Text c="dark.5" size="lg" fw={500}>
                Your personalized academic copilot.
              </Text>
            </Stack>

            <Button
              size="xl"
              radius="xl"
              onClick={openModal}
              variant="gradient"
              gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }}
              leftSection={<Plus size={24} strokeWidth={3} />}
              className="transition-all hover:translate-y-[-3px] hover:shadow-2xl hover:scale-[1.02]"
              px={48}
              styles={{
                root: {
                  boxShadow: '0 10px 30px rgba(79, 70, 229, 0.25)',
                  height: '60px',
                  fontSize: '18px',
                },
              }}
            >
              Start Learning
            </Button>
          </Stack>
        </Container>
      </Center>

      <NewSessionModal opened={modalOpened} onClose={closeModal} onStart={handleStartSession} />
    </>
  );
}
