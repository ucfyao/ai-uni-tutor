'use client';

import { FileText, GraduationCap, HelpCircle, Search, Sparkles } from 'lucide-react';
import {
  Accordion,
  ActionIcon,
  Container,
  Input,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';

export default function HelpPage() {
  return (
    <Container size="lg" py={80}>
      <Stack align="center" gap="xl" mb={60}>
        <ThemeIcon size={80} radius="100%" variant="light" color="blue" mb="md">
          <HelpCircle size={40} />
        </ThemeIcon>
        <Title order={1} size={48} fw={900} ta="center">
          How can we help?
        </Title>
        <Text c="dimmed" size="lg" ta="center" maw={600}>
          Search our knowledge base or browse frequently asked questions to find the answers you
          need.
        </Text>

        <Paper
          withBorder
          radius="xl"
          p="xs"
          w="100%"
          maw={600}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <Input
            variant="unstyled"
            placeholder="Search for help..."
            style={{ flex: 1, paddingLeft: 16 }}
          />
          <ActionIcon size="xl" radius="xl" variant="filled" color="blue">
            <Search size={20} />
          </ActionIcon>
        </Paper>
      </Stack>

      <Container size="sm">
        <Stack gap="xl">
          <Title order={2}>Frequently Asked Questions</Title>
          <Accordion variant="separated" radius="lg">
            <Accordion.Item value="upload">
              <Accordion.Control icon={<FileText size={20} />}>
                How do I upload course materials?
              </Accordion.Control>
              <Accordion.Panel>
                You can upload PDF documents (syllabus, notes, etc.) directly in the chat interface
                or through the &quot;Knowledge Base&quot; section in the sidebar. Simply drag and
                drop your files or click to select them.
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="modes">
              <Accordion.Control icon={<GraduationCap size={20} />}>
                What are the different tutoring modes?
              </Accordion.Control>
              <Accordion.Panel>
                AI Tutor offers several modes: &quot;Lecture Helper&quot; for understanding
                concepts, &quot;Assignment Coach&quot; for help with tasks, and &quot;Exam
                Prep&quot; for study sessions. You can switch modes in the session settings.
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="ai">
              <Accordion.Control icon={<Sparkles size={20} />}>
                Which AI model is used?
              </Accordion.Control>
              <Accordion.Panel>
                We utilize advanced models like Gemini 2.0 to provide the best possible tutoring
                experience.
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      </Container>
    </Container>
  );
}
