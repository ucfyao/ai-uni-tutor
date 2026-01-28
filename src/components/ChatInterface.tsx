import React, { useState, useRef, useEffect } from 'react';
import { Stack, Group, Text, Textarea, ActionIcon, ScrollArea, Avatar, Box, Loader, Container, SimpleGrid, Paper, ThemeIcon, rem, Menu, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Bot, Paperclip, ArrowUp, Share2, MoreHorizontal, Lightbulb, Code, Feather, ClipboardCheck, Globe, BrainCircuit, Pin, PinOff, PenLine, Share, Trash, Presentation, Compass, FileQuestion, ChevronRight } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types/index';
import { generateChatResponse } from '@/app/actions/chat';
import { MessageBubble } from './chat/MessageBubble';
import { MODES } from '../constants/index';

interface ChatInterfaceProps {
  session: ChatSession;
  onUpdateSession: (session: ChatSession) => void;
  onRenameSession: () => void;
  onDeleteSession: () => void;
  onShareSession: () => void;
  onTogglePin: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, onUpdateSession, onRenameSession, onDeleteSession, onShareSession, onTogglePin }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  const isNewChat = session.messages.length === 0;

  const scrollToBottom = () => {
    if (viewport.current) {
        viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'auto' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: input, timestamp: Date.now() };
    const updatedSession = { ...session, messages: [...session.messages, userMsg] };
    onUpdateSession(updatedSession);
    setInput('');
    setIsTyping(true);

    try {
        const response = await generateChatResponse(session.course, session.mode, updatedSession.messages, input);
        const aiMsg: ChatMessage = { id: `a_${Date.now()}`, role: 'assistant', content: response || "...", timestamp: Date.now() };
        onUpdateSession({ ...updatedSession, messages: [...updatedSession.messages, aiMsg] });
        setStreamingMsgId(aiMsg.id);
    } catch (e: any) {
        console.error(e);
        notifications.show({
            title: 'Action Failed',
            message: e.message || 'Failed to generate response.',
            color: 'red',
        });
        // Remove the user message if failed? Or keep it? Keeping it lets them retry.
        // But we should remove the 'typing' state which is done in finally.
    } finally {
        setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Shared Input Component
  const inputArea = (
    <Container size="48rem" px={0} w="100%">
      <Box 
        p="sm"
        style={{ 
          borderRadius: '24px', 
          display: 'flex',
          alignItems: 'flex-end', 
          border: '1px solid var(--mantine-color-gray-2)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}
        className="group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300"
      >
        <ActionIcon 
            variant="subtle" 
            c="gray.5" 
            radius="xl" 
            size="lg" 
            mb={6}
            className="hover:bg-gray-100 hover:text-dark transition-colors"
        >
          <Paperclip size={20} strokeWidth={2} />
        </ActionIcon>
        
        <Textarea
          autosize
          minRows={1}
          maxRows={8}
          variant="unstyled"
          placeholder="Message AI Tutor..."
          size="md"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          flex={1}
          px="sm"
          styles={{ 
            input: { 
                paddingTop: '10px', 
                paddingBottom: '10px', 
                fontWeight: 450, 
                fontSize: '15px', 
                color: 'var(--mantine-color-dark-9)', 
                lineHeight: 1.5 
            } 
          }}
        />
        
        <ActionIcon 
          size={42} 
          radius="xl" 
          variant={input.trim() ? 'gradient' : 'filled'}
          gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }}
          color={input.trim() ? undefined : "gray.2"} 
          onClick={handleSend} 
          disabled={!input.trim() || isTyping}
          mb={2}
          style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          className={input.trim() ? 'shadow-md hover:scale-110 hover:shadow-lg' : ''}
        >
          <ArrowUp size={22} strokeWidth={3} color={input.trim() ? 'white' : 'var(--mantine-color-gray-5)'} />
        </ActionIcon>
      </Box>
      <Text ta="center" size="xs" c="dimmed" mt="xs" mb="xs" fw={500}>
        AI Tutor can make mistakes. Check important info.
      </Text>
    </Container>
  );

  return (
    <Stack h="100%" gap={0} bg="transparent" pos="relative">
      
      {/* Header - Minimal with Glass Effect */}
      <Box px="md" py={14} bg="rgba(255,255,255,0.7)" pos="absolute" top={0} left={0} right={0} style={{ borderBottom: isNewChat ? 'none' : '1px solid var(--mantine-color-gray-2)', zIndex: 10, backdropFilter: 'blur(10px)' }}>
        <Group justify="space-between" wrap="nowrap">
           <Group 
             gap={8} 
             align="center" 
             wrap="nowrap"
             style={{ cursor: 'pointer', flex: 1, minWidth: 0 }} 
             className="hover:bg-gray-50 p-2 rounded-lg transition-colors"
           >
              <Text fw={600} size="lg" c="dark.8" truncate>{session.course.code}</Text>
              <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}> {'>'} </Text>
              <Text fw={500} size="sm" c={session.mode ? "dimmed" : "indigo.6"} truncate>
                {session.mode || "Select Mode"}
              </Text>
           </Group>
           
           <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
               <ActionIcon variant="subtle" c="dimmed" radius="xl" size="lg" onClick={onShareSession}>
                    <Share2 size={20} strokeWidth={1.5} />
               </ActionIcon>
               
               <Menu position="bottom-end" withArrow>
                   <Menu.Target>
                       <ActionIcon variant="subtle" c="dimmed" radius="xl" size="lg">
                            <MoreHorizontal size={20} strokeWidth={1.5} />
                       </ActionIcon>
                   </Menu.Target>
                   <Menu.Dropdown>
                        <Menu.Item 
                            leftSection={<Share size={14} />} 
                            onClick={onShareSession}
                        >
                            Share
                        </Menu.Item>
                        <Menu.Item 
                            leftSection={<PenLine size={14} />} 
                            onClick={onRenameSession}
                        >
                            Rename
                        </Menu.Item>
                        <Menu.Item 
                            leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />} 
                            onClick={onTogglePin}
                        >
                            {session.isPinned ? 'Unpin chat' : 'Pin chat'}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item 
                            leftSection={<Trash size={14} />} 
                            color="red"
                            onClick={onDeleteSession}
                        >
                            Delete
                        </Menu.Item>
                   </Menu.Dropdown>
               </Menu>
           </Group>
        </Group>
      </Box>

      {isNewChat ? (
          /* CENTERED LAYOUT FOR NEW CHAT */
              <Stack flex={1} px="md" justify="center" gap={64}>
                  <Container size="50rem" w="100%">
                      <Stack gap={64}>
                          {/* Welcome Hero Section */}
                          <Stack align="center" gap={32} ta="center">
                              <Avatar size={90} radius="xl" variant="gradient" gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }} className="shadow-2xl">
                                  <Bot size={44} className="text-white" />
                              </Avatar>
                              
                              <Stack gap={12}>
                                  <Text c="dark.9" style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, textBalance: 'balance' }}>
                                      Welcome to <span style={{ background: 'linear-gradient(45deg, var(--mantine-color-indigo-6), var(--mantine-color-violet-6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{session.course.code}</span>
                                  </Text>
                                  <Text c="dark.4" size="lg" fw={500} maw={560} mx="auto" lh={1.6} style={{ textWrap: 'balance' }}>
                                      Choose your learning path below to start the conversation.
                                  </Text>
                              </Stack>
                          </Stack>

                          {/* Quick Actions Grid */}
                          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" verticalSpacing="lg">
                            {MODES.map((mode) => {
                                // Metadata map for UI decoration - ANALOGOUS PALETTE (Cool Spectrum)
                                const meta = {
                                    'Lecture Helper': {
                                        color: 'indigo',
                                        desc: 'Simplify & Explain',
                                        intro: "**Lecture Helper Mode Active**\n\nI break down complex theories into simple, digestible parts using analogies. What concept needs clarifying?",
                                        hoverClass: "hover:border-indigo-300 hover:shadow-[0_8px_30px_rgba(79,70,229,0.15)]"
                                    },
                                    'Assignment Coach': {
                                        color: 'violet',
                                        desc: 'Guide & Debug',
                                        intro: "**Assignment Coach Mode Active**\n\nI guide you through code, writing, and analysis without giving direct answers, so you learn the 'why'.",
                                        hoverClass: "hover:border-violet-300 hover:shadow-[0_8px_30px_rgba(124,58,237,0.15)]"
                                    },
                                    'Exam Prep': {
                                        color: 'grape',
                                        desc: 'Drill & Simulate',
                                        intro: "**Exam Prep Mode Active**\n\nI generate practice questions and simulate exam scenarios to test your knowledge gaps. Ready to drill?",
                                        hoverClass: "hover:border-grape-300 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)]"
                                    },
                                    'Feedback': {
                                        color: 'pink',
                                        desc: 'Critique & Polish',
                                        intro: "**Feedback Mode Active**\n\nI critique academic tone, structure, and clarity. Paste your work for a ruthless but helpful review.",
                                        hoverClass: "hover:border-pink-300 hover:shadow-[0_8px_30px_rgba(236,72,153,0.15)]"
                                    }
                                }[mode.label] || { color: 'gray', desc: '', intro: '', hoverClass: '' };

                                const Icon = { Presentation: Presentation, Compass: Compass, FileQuestion: FileQuestion, School: Feather }[mode.icon as string] || Presentation;

                                return (
                                <Tooltip 
                                    key={mode.id} 
                                    label={<Text size="xs" maw={220} style={{ whiteSpace: 'pre-wrap' }}>{meta.intro.replace(/\*\*/g, '')}</Text>} 
                                    multiline 
                                    position="top" 
                                    withArrow 
                                    transitionProps={{ duration: 200, transition: 'pop' }}
                                    color="dark"
                                >
                                    <Paper 
                                        shadow="sm" 
                                        radius="lg" 
                                        p="lg"
                                        style={{ 
                                            cursor: 'pointer', 
                                            backgroundColor: 'white', // Ensure white card
                                            border: '1px solid var(--mantine-color-gray-2)',
                                            position: 'relative',
                                            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                        }}
                                        className={`group ${meta.hoverClass} hover:-translate-y-1`}
                                        onClick={() => {
                                            const welcomeMsg: ChatMessage = { 
                                                id: `a_${Date.now()}`, 
                                                role: 'assistant', 
                                                content: meta.intro, 
                                                timestamp: Date.now() 
                                            };
                                            onUpdateSession({ 
                                                ...session, 
                                                mode: mode.label as any, 
                                                messages: [welcomeMsg] 
                                            });
                                        }}
                                    >
                                        <Stack gap="sm" h="100%" justify="space-between">
                                            <Group justify="space-between" align="start">
                                                <ThemeIcon 
                                                    size={48} 
                                                    radius="md" 
                                                    variant="light" 
                                                    color={meta.color}
                                                    className="transition-transform duration-300 group-hover:scale-110"
                                                >
                                                    <Icon size={24} strokeWidth={2} />
                                                </ThemeIcon>

                                                <Box 
                                                    c={`${meta.color}.6`}
                                                    className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-8px] group-hover:translate-x-0"
                                                >
                                                    <ArrowUp size={20} style={{ transform: 'rotate(45deg)' }} strokeWidth={2.5} />
                                                </Box>
                                            </Group>
                                            
                                            <Box>
                                                <Text size="md" fw={700} c="dark.9" lh={1.2} mb={4} className={`group-hover:text-${meta.color === 'indigo' ? 'indigo-700' : 'dark-9'} transition-colors`}>
                                                    {mode.label}
                                                </Text>
                                                <Text size="xs" c="dimmed" lh={1.4} lineClamp={2}>
                                                    {meta.desc}
                                                </Text>
                                            </Box>
                                        </Stack>
                                    </Paper>
                                </Tooltip>
                            )})}
                      </SimpleGrid>

                      {/* Input Area with Feature Toggles - HIDDEN IF NO MODE */}
                      {session.mode && (
                          <Box mt="lg">
                              <Group mb="xs" px="xs">
                                  <Group gap={6} bg="gray.1" p={4} style={{ borderRadius: '8px' }}>
                                      <ThemeIcon size="sm" c="gray" variant="transparent"><Globe size={14} /></ThemeIcon>
                                      <Text size="xs" fw={500} c="dark.6">Web Search</Text>
                                  </Group>
                                  <Group gap={6} bg="blue.0" p={4} style={{ borderRadius: '8px' }}>
                                      <ThemeIcon size="sm" c="blue" variant="transparent"><BrainCircuit size={14} /></ThemeIcon>
                                      <Text size="xs" fw={500} c="blue.7">Deep Think</Text>
                                  </Group>
                              </Group>
                              {inputArea}
                          </Box>
                      )}
                  </Stack>
              </Container>
          </Stack>
      ) : (
          /* STANDARD LAYOUT */
          <>
            <ScrollArea viewportRef={viewport} flex={1} scrollbarSize={8} type="auto">
                <Box py={80}> 
                <Container size="48rem" px={0}> 
                    <Stack gap="xl">
                    {session.messages.map((msg) => (
                        <MessageBubble 
                          key={msg.id} 
                          message={msg} 
                          isStreaming={msg.id === streamingMsgId}
                          onStreamingComplete={() => setStreamingMsgId(null)}
                          mode={session.mode}
                        />
                    ))}
                    
                    {isTyping && (
                        <Group align="flex-start" gap="md" px="md">
                        <Avatar size="sm" radius="sm" style={{ border: '1px solid var(--mantine-color-gray-2)' }} bg="transparent">
                            <Bot size={18} className="text-indigo-600" />
                        </Avatar>
                        <Box mt={6}>
                            <Loader size="xs" color="gray" type="dots" />
                        </Box>
                        </Group>
                    )}
                    </Stack>
                </Container>
                </Box>
            </ScrollArea>

            {/* Input Area - Floating & Centered */}
            <Box p="md" bg="gradient(to top, white 0%, white 90%, transparent 100%)" pos="absolute" bottom={0} left={0} right={0}>
                {inputArea}
            </Box>
          </>
      )}

    </Stack>
  );
};

export default ChatInterface;
