'use client';

import { FileText, GraduationCap, Sparkles } from 'lucide-react';
import { Accordion, Paper, Stack, Text } from '@mantine/core';
import { PageShell } from '@/components/PageShell';

export default function HelpPage() {
  return (
    <PageShell
      title="Help"
      subtitle="Browse frequently asked questions to find the answers you need"
    >
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Text fw={600} fz="lg">
            Frequently Asked Questions
          </Text>
          <Accordion variant="separated" radius="md">
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
      </Paper>
    </PageShell>
  );
}
