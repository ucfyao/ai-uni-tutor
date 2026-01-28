'use client';

import { Container, Title, Text, Accordion, Stack, Button, Flex, TextInput, Textarea, Box, Paper } from '@mantine/core';
import { Mail, Search, HelpCircle } from 'lucide-react';

export default function HelpPage() {
  return (
    <Container size="md" py={60}>
      <Stack gap={60}>
        <Stack align="center" gap="md">
            <HelpCircle size={48} className="text-violet-600" />
            <Title order={1} fz={40} fw={900}>How can we help?</Title>
            <TextInput 
                placeholder="Search for answers..." 
                leftSection={<Search size={16} />}
                size="lg"
                w="100%"
                maw={500}
                radius="xl"
            />
        </Stack>
        
        <Box>
            <Title order={2} mb="xl">Frequently Asked Questions</Title>
            <Accordion variant="separated" radius="lg" defaultValue="account">
                <Accordion.Item value="account">
                    <Accordion.Control>How do I reset my password?</Accordion.Control>
                    <Accordion.Panel>You can reset your password by going to the login page and clicking on "Forgot Password". Follow the instructions sent to your email.</Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="billing">
                    <Accordion.Control>How do I cancel my subscription?</Accordion.Control>
                    <Accordion.Panel>Go to Settings, scroll down to the Plan & Billing section, and click "Manage via Stripe". You can cancel your subscription there.</Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item value="uploads">
                    <Accordion.Control>What file formats are supported?</Accordion.Control>
                    <Accordion.Panel>We currently support PDF files for knowledge base uploads.</Accordion.Panel>
                </Accordion.Item>
                
                 <Accordion.Item value="ai">
                    <Accordion.Control>Which AI model is used?</Accordion.Control>
                    <Accordion.Panel>We utilize advanced models like Gemini 2.0 to provide the best possible tutoring experience.</Accordion.Panel>
                </Accordion.Item>
            </Accordion>
        </Box>

        <Paper withBorder p="xl" radius="lg" bg="gray.0">
            <Flex justify="space-between" align="center" direction={{ base: 'column', sm: 'row' }} gap="md">
                <Stack gap={4}>
                    <Title order={3}>Still need help?</Title>
                    <Text c="dimmed">Our support team is just a message away.</Text>
                </Stack>
                <Button 
                    component="a" 
                    href="mailto:ucfyao@gmail.com"
                    size="lg" 
                    color="dark" 
                    leftSection={<Mail size={18}/>}
                >
                    Contact Support
                </Button>
            </Flex>
        </Paper>
      </Stack>
    </Container>
  );
}
