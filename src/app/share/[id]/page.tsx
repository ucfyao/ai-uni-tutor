import { Calendar, LogIn } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import React from 'react';
import { Badge, Box, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { getSharedSession } from '@/app/actions/chat';
import { ChatMessage } from '@/types/index';
import 'katex/dist/katex.min.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SharedSessionPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSharedSession(id);

  if (!session) {
    return notFound();
  }

  return (
    <Box bg="white" mih="100vh">
      {/* Header */}
      <Box py="md" px="xl" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Container size="lg">
          <Group justify="space-between">
            <Group gap="xs">
              <Box mr={2}>
                <Image src="/assets/logo.png" alt="Logo" width={28} height={28} />
              </Box>
              <Text fw={700} size="lg" c="dark.9">
                AI Tutor
              </Text>
              <Badge variant="light" color="violet">
                Shared Chat
              </Badge>
            </Group>
            <Button
              component="a"
              href="/login"
              variant="light"
              color="violet"
              size="xs"
              leftSection={<LogIn size={14} />}
            >
              Sign In to Chat
            </Button>
          </Group>
        </Container>
      </Box>

      {/* Content */}
      <Container size="md" py="xl">
        <Stack gap="xl">
          <Box>
            <Title order={1} size="h2" mb="xs">
              {session.title || session.course.code}
            </Title>
            <Group justify="space-between">
              <Text c="dimmed" size="sm">
                {session.course.code}: {session.course.name} • {session.mode}
              </Text>
              <Group gap="xs">
                <Calendar size={14} className="text-gray-500" />
                <Text c="dimmed" size="xs">
                  {new Date(session.lastUpdated).toLocaleDateString()}
                </Text>
              </Group>
            </Group>
          </Box>

          <Stack gap="lg">
            {session.messages.map((msg: ChatMessage) => (
              <Group
                key={msg.id}
                align="flex-start"
                gap="md"
                wrap="nowrap"
                style={{ flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}
              >
                <Box
                  style={{
                    flex: 1,
                    maxWidth: '85%',
                  }}
                >
                  <Box
                    p="md"
                    bg={msg.role === 'user' ? 'violet.0' : 'gray.0'}
                    style={{
                      borderRadius: 'var(--mantine-radius-md)',
                      borderTopRightRadius: msg.role === 'user' ? 0 : 'var(--mantine-radius-md)',
                      borderTopLeftRadius:
                        msg.role === 'assistant' ? 0 : 'var(--mantine-radius-md)',
                    }}
                  >
                    <Text
                      c={msg.role === 'user' ? 'dark.9' : 'dark.8'}
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
                          code: ({ node: _node, inline, className, children, ...props }: any) => {
                            // eslint-disable-line @typescript-eslint/no-unused-vars
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <Box
                                component="pre"
                                p="xs"
                                bg="dark.8"
                                c="gray.1"
                                style={{ borderRadius: 4, overflowX: 'auto' }}
                              >
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </Box>
                            ) : (
                              <code
                                className={className}
                                style={{
                                  background: 'var(--mantine-color-gray-2)',
                                  padding: '2px 4px',
                                  borderRadius: 4,
                                }}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </Text>
                  </Box>
                  <Text size="xs" c="dimmed" mt={4} ta={msg.role === 'user' ? 'right' : 'left'}>
                    {msg.role === 'user' ? 'You' : 'AI Tutor'}
                  </Text>
                </Box>
              </Group>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
