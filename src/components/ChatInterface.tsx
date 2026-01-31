import React, { useState, useRef, useEffect } from 'react';
import { Stack, Group, Text, Textarea, ActionIcon, ScrollArea, Avatar, Box, Loader, Container, SimpleGrid, Paper, ThemeIcon, Menu, Tooltip, Modal, Button, Drawer, Burger } from '@mantine/core'; // Added Burger
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks'; 
import { Bot, Paperclip, ArrowUp, Share2, MoreHorizontal, Globe, BrainCircuit, Pin, PinOff, PenLine, Share, Trash, Presentation, Compass, FileQuestion, Sparkles, Feather, BookOpen } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types/index';
import { generateChatResponse } from '@/app/actions/chat';
import { MessageBubble } from './chat/MessageBubble';
import { MODES } from '../constants/index';
import { useSidebar } from '@/context/SidebarContext'; // Re-added useSidebar
import { useHeader } from '@/context/HeaderContext'; // Added

interface ChatInterfaceProps {
  session: ChatSession;
  onUpdateSession: (session: ChatSession) => void;
  onRenameSession: () => void;
  onDeleteSession: () => void;
  onShareSession: () => void;
  onTogglePin: () => void;
}

import { extractCards, KnowledgeCard } from '@/lib/contentParser';
import { KnowledgePanel } from './chat/KnowledgePanel';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ session, onUpdateSession, onRenameSession, onDeleteSession, onShareSession, onTogglePin }) => {
  // ... existing state ...
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // Derived State (Moved Up)
  const isNewChat = session.messages.length === 0;
  const isKnowledgeMode = session.mode === 'Lecture Helper' || session.mode === 'Assignment Coach';

  // Mobile Response State
  const isMobile = useMediaQuery('(max-width: 48em)'); // 768px (Sidebar)
  const isCompact = useMediaQuery('(max-width: 64em)'); // 1024px (Knowledge Panel)
  const [mobileKnowledgeOpened, setMobileKnowledgeOpened] = useState(false);
  const { toggleMobile, mobileOpened } = useSidebar(); 
  const { setHeaderContent } = useHeader(); // Context

  // ... Knowledge Card Logic ...
  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [cardChats, setCardChats] = useState<Record<string, ChatMessage[]>>({});
  const [loadingCardId, setLoadingCardId] = useState<string | null>(null);
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // ... useEffects ...

  // HEADER CONTENT CONSTRUCTION
  const headerContentNode = React.useMemo(() => (
      <Group justify="space-between" wrap="nowrap" w="100%">
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
               {isKnowledgeMode && isCompact && (
                   <ActionIcon 
                       variant={mobileKnowledgeOpened ? "light" : "subtle"} 
                       color="indigo"
                       radius="xl" 
                       size="lg" 
                       onClick={() => setMobileKnowledgeOpened(true)}
                   >
                        <BookOpen size={20} strokeWidth={1.5} />
                   </ActionIcon>
               )}
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
                        <Menu.Item leftSection={<Share size={14} />} onClick={onShareSession}>Share</Menu.Item>
                        <Menu.Item leftSection={<PenLine size={14} />} onClick={onRenameSession}>Rename</Menu.Item>
                        <Menu.Item leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />} onClick={onTogglePin}>{session.isPinned ? 'Unpin chat' : 'Pin chat'}</Menu.Item>
                        <Menu.Divider />
                        <Menu.Item leftSection={<Trash size={14} />} color="red" onClick={onDeleteSession}>Delete</Menu.Item>
                   </Menu.Dropdown>
               </Menu>
           </Group>
      </Group>
  ), [session.course.code, session.mode, session.isPinned, isKnowledgeMode, isCompact, mobileKnowledgeOpened, onShareSession, onRenameSession, onTogglePin, onDeleteSession]);

  // Sync Header to Context on Mobile
  useEffect(() => {
    if (isMobile) {
        setHeaderContent(headerContentNode);
    } else {
        setHeaderContent(null);
    }
    // Cleanup to prevent stale header if unmounting
    return () => setHeaderContent(null); 
  }, [isMobile, headerContentNode, setHeaderContent]);

  // ... 
  
  // Handlers ...

  // Auto-open drawer when card becomes active on mobile/compact
  useEffect(() => {
    if (activeCardId && isCompact) {
        setMobileKnowledgeOpened(true);
    }
  }, [activeCardId, isCompact]);

  // Derived State (WAS here, moved up)

  // ... rest ...

  // RENDER
  // We need to Conditional Render the Header inside Return.
  // Find where `return (` starts (approx line 325-ish originally).
  // Wrap layout header in `{!isMobile && ...}`.
  
  // Note: I cannot replace the whole render here easily because it's huge.
  // I will target the Header block specifically.


  // User-Managed State
  const [manualCards] = useState<KnowledgeCard[]>([]);
  const [deletedCardIds, setDeletedCardIds] = useState<Set<string>>(new Set());

  // 1. Separate Main Chat vs. Knowledge Card Chat
  const mainMessages = React.useMemo(() => session.messages.filter(m => !m.cardId), [session.messages]);

  // 2. Hydrate Card Chats from Session History
  useEffect(() => {
    if (!isKnowledgeMode) return;

    const chats: Record<string, ChatMessage[]> = {};
    session.messages.forEach(msg => {
        if (msg.cardId) {
            if (!chats[msg.cardId]) chats[msg.cardId] = [];
            chats[msg.cardId].push(msg);
        }
    });
    setCardChats(chats);
  }, [session.messages, isKnowledgeMode]);

  useEffect(() => {
    if (!isKnowledgeMode) {
        setKnowledgeCards([]);
        return;
    }

    const allCards: KnowledgeCard[] = [];
    // Only extract cards from MAIN chat to avoid recursion/duplication
    mainMessages.forEach(msg => {
        if (msg.role === 'assistant') {
            const { cards } = extractCards(msg.content);
            allCards.push(...cards);
        }
    });
    
    // Deduplicate cards by title
    const uniqueAutoCards = Array.from(new Map(allCards.map(c => [c.title, c])).values());
    
    // Merge: Auto + Manual - Deleted
    const combinedCards = [...uniqueAutoCards, ...manualCards]
        .filter(card => !deletedCardIds.has(card.id));

    // Deduplicate again (in case manual overrides auto) -> Prefer Manual? Or just unique by ID/Title?
    // Let's assume unique by ID.
    const uniqueFinalCards = Array.from(new Map(combinedCards.map(c => [c.id, c])).values());

    setKnowledgeCards(uniqueFinalCards);
  }, [mainMessages, isKnowledgeMode, manualCards, deletedCardIds]);

  const handleDeleteCard = (cardId: string) => {
    setDeletedCardIds(prev => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
    });
  };

  /* const handleAddManualCard = (title: string, content: string) => {
    const newCard: KnowledgeCard = {
        id: `manual-${Date.now()}`,
        title: title.trim(),
        content: content.trim()
    };
    setManualCards(prev => [...prev, newCard]);
    // Also remove from deleted if it was there (optional, but good UX)
    setDeletedCardIds(prev => {
        const next = new Set(prev);
        // We can't easily know the ID if it was auto-generated differently, 
        // but this manual add is fresh.
        return next;
    });
    // Scroll to panel? or Open it?
    setActiveCardId(newCard.id);
  }; */

  const scrollToBottom = () => {
    if (viewport.current) {
        viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'auto' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages, isTyping]);


  // --- INTERACTION HANDLERS ---

  const handleHighlightClick = (cardId: string) => {
    setActiveCardId(cardId);
    
    // Scroll to the card in the Knowledge Panel
    const cardElement = cardRefs.current[cardId];
    if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCardAsk = async (card: KnowledgeCard, question: string) => {
    // 1. Contextualize input for the AI, but keep display simple
    const contextualInput = `Regarding the concept "${card.title}" in our lecture: ${question}`;
    
    // 2. Create User Message for LOCAL card chat
    const userMsg: ChatMessage = { 
        id: `u_${Date.now()}`, 
        role: 'user', 
        content: question, 
        timestamp: Date.now(),
        cardId: card.id // Link to card
    };
    
    // Optimistic Update: Add to session (hydration will catch it)
    const updatedSession = { ...session, messages: [...session.messages, userMsg] };
    onUpdateSession(updatedSession);
    
    setLoadingCardId(card.id);

    try {
        // 3. Trigger API Call
        // Construct history: Main Chat + This Exchange context
        const contextHistory = mainMessages.concat({ role: 'user', content: contextualInput } as ChatMessage);
        
        const result = await generateChatResponse(session.course, session.mode, contextHistory, contextualInput);
        
        if (result.success === false) {
             if (result.isLimitError) {
                 setShowUpgradeModal(true);
             } else {
                 notifications.show({ title: 'Error', message: result.error, color: 'red' });
             }
             return;
        }

        const aiMsg: ChatMessage = { 
            id: `a_${Date.now()}`, 
            role: 'assistant', 
            content: result.data || "...", 
            timestamp: Date.now(),
            cardId: card.id // Link to card
        };
        
        onUpdateSession({ ...updatedSession, messages: [...updatedSession.messages, aiMsg] });
    } catch (e) {
        console.error("Layout/Network Error:", e);
        notifications.show({ title: 'Error', message: 'Failed to connect to server.', color: 'red' });
    } finally {
        setLoadingCardId(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: input, timestamp: Date.now() };
    const updatedSession = { ...session, messages: [...session.messages, userMsg] };
    onUpdateSession(updatedSession);
    setInput('');
    setIsTyping(true);

    try {
        const result = await generateChatResponse(session.course, session.mode, updatedSession.messages, input);
        
        if (result.success === false) {
            if (result.isLimitError) {
                setShowUpgradeModal(true);
            } else {
                notifications.show({
                    title: 'Action Failed',
                    message: result.error || 'Failed to generate response.',
                    color: 'red',
                });
            }
            return;
        }

        const aiMsg: ChatMessage = { id: `a_${Date.now()}`, role: 'assistant', content: result.data || "...", timestamp: Date.now() };
        onUpdateSession({ ...updatedSession, messages: [...updatedSession.messages, aiMsg] });
        setStreamingMsgId(aiMsg.id);
    } catch (e) {
        console.error("Layout/Network Error:", e);
        notifications.show({
            title: 'Network Error',
            message: 'Failed to connect to server.',
            color: 'red',
        });
    } finally {
        setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Shared Input Component
  const inputArea = (
    <Container size={isKnowledgeMode ? "100%" : "48rem"} px={isKnowledgeMode ? "md" : 0} w="100%">
      <Box 
        p={8}
        style={{ 
          borderRadius: '26px', 
          display: 'flex',
          alignItems: 'flex-end', 
          border: '1px solid var(--mantine-color-gray-3)',
          backgroundColor: 'rgba(255, 255, 255, 1)',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}
        className="group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300"
      >
        <ActionIcon 
            variant="subtle" 
            c="gray.5" 
            radius="xl" 
            size={32}
            mb={6}
            ml={4}
            className="hover:bg-gray-100 hover:text-dark transition-colors"
        >
          <Paperclip size={18} strokeWidth={2} />
        </ActionIcon>
        
        <Textarea
          autosize
          minRows={1}
          maxRows={8}
          variant="unstyled"
          placeholder={isKnowledgeMode ? "Ask about a concept..." : "Message AI Tutor..."}
          size="md"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          flex={1}
          px="xs"
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
          size={32} 
          radius="xl" 
          variant={input.trim() ? 'gradient' : 'filled'}
          gradient={{ from: 'indigo.6', to: 'violet.6', deg: 45 }}
          color={input.trim() ? undefined : "gray.2"} 
          onClick={handleSend} 
          disabled={!input.trim() || isTyping}
          mb={6}
          mr={4}
          style={{ transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          className={input.trim() ? 'shadow-md hover:scale-105' : ''}
        >
          <ArrowUp size={18} strokeWidth={3} color={input.trim() ? 'white' : 'var(--mantine-color-gray-5)'} />
        </ActionIcon>
      </Box>
      <Text ta="center" size="xs" c="dimmed" mt="xs" mb="xs" fw={500}>
        AI Tutor can make mistakes. Check important info.
      </Text>
    </Container>
  );

  return (
    <Stack h="100%" gap={0} bg="transparent" pos="relative">
      
      {/* Header - Static Flex Item - Only on NON-MOBILE */}
      {!isMobile && (
      <Box px="md" py={14} bg="rgba(255,255,255,0.7)" style={{ borderBottom: isNewChat ? 'none' : '1px solid var(--mantine-color-gray-2)', zIndex: 10, backdropFilter: 'blur(10px)', flexShrink: 0 }}>
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
               {isKnowledgeMode && isCompact && (
                   <ActionIcon 
                       variant={mobileKnowledgeOpened ? "light" : "subtle"} 
                       color="indigo"
                       radius="xl" 
                       size="lg" 
                       onClick={() => setMobileKnowledgeOpened(true)}
                   >
                        <BookOpen size={20} strokeWidth={1.5} />
                   </ActionIcon>
               )}
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
      )}

      {isNewChat ? (
          /* CENTERED LAYOUT FOR NEW CHAT */
              <Stack flex={1} px="md" justify="center" gap={64} style={{ overflowY: 'auto' }}>
                  {/* ... contents ... */}
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
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                mode: mode.label as any,  // Fixed elsewhere if types allow, but sticking with existing any here for safety if types mismatch 
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
          /* STANDARD LAYOUT - FLEX COLUMN SPLIT */
          <Group flex={1} gap={0} bg="transparent" align="stretch" style={{ overflow: 'hidden', minHeight: 0 }}>
            
            {/* LEFT COLUMN: CHAT */}
            <Stack gap={0} h="100%" style={{ flex: 1, minWidth: 0 }}>
                {/* Chat Scroll Area - Flex 1 to fill available space */}
                <ScrollArea viewportRef={viewport} flex={1} scrollbarSize={8} type="auto">
                    <Box pt="md" pb="md"> 
                    <Container size={isKnowledgeMode ? "100%" : "48rem"} px={isKnowledgeMode ? "xl" : 0}> 
                        <Stack gap="xl">
                        {mainMessages.map((msg) => {
                            // Clean content if assistant
                            const displayText = msg.role === 'assistant' 
                                ? extractCards(msg.content).cleanContent 
                                : msg.content;
                            
                            return (
                                <MessageBubble 
                                key={msg.id} 
                                message={{...msg, content: displayText}} 
                                isStreaming={msg.id === streamingMsgId}
                                onStreamingComplete={() => setStreamingMsgId(null)}
                                mode={session.mode}
                                knowledgeCards={knowledgeCards} // Pass cards for highlighting
                                onHighlightClick={handleHighlightClick} // Pass click handler
                                />
                            );
                        })}
                        
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

                {/* Input Area - Static Flex Item at Bottom */}
                <Box bg="white" px={isKnowledgeMode ? "md" : 0} pb={isKnowledgeMode ? "md" : 0} pt={0} style={{ flexShrink: 0, zIndex: 5 }}>
                    {inputArea}
                </Box>
            </Stack>

            {/* RIGHT COLUMN: KNOWLEDGE PANEL */}
            <KnowledgePanel 
                cards={knowledgeCards} 
                visible={isKnowledgeMode && !isCompact} 
                activeCardId={activeCardId}
                onCardClick={(id) => setActiveCardId(id)}
                onAsk={handleCardAsk}
                onDelete={handleDeleteCard}
                cardRefs={cardRefs}
                cardChats={cardChats}
                loadingCardId={loadingCardId}
            />

          </Group>
      )}

      {/* Upgrade Modal */}
      <Modal 
        opened={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        title={
            <Group gap="xs">
                <Sparkles size={20} className="text-violet-600" />
                <Text fw={700} c="violet.7" size="lg">Unlock Unlimited AI</Text>
            </Group>
        }
        centered
        radius="lg"
        padding="xl"
        zIndex={1001}
      >
        <Stack align="center" ta="center" gap="lg">
            <Box p="md" bg="violet.0" style={{ borderRadius: '50%' }}>
                <ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'indigo' }}>
                    <Sparkles size={26} />
                </ThemeIcon>
            </Box>
            
            <Box>
                <Text size="xl" fw={800} mb="xs">Daily Usage Limit Reached</Text>
                <Text c="dimmed" lh={1.5}>
                    You&apos;ve hit your daily message limit on the Free tier. 
                    Upgrade to <span className="font-semibold text-violet-700">Pro</span> to remove limits and help us maintain the service.
                </Text>
            </Box>

            <Group w="100%" justify="center">
                <Button variant="default" onClick={() => setShowUpgradeModal(false)}>
                    Maybe Later
                </Button>
                <Button 
                    variant="gradient" 
                    gradient={{ from: 'violet', to: 'indigo' }}
                    onClick={() => window.location.href = '/pricing'}
                    rightSection={<ArrowUp size={16} className="rotate-45" />}
                >
                    Upgrade Now
                </Button>
            </Group>
        </Stack>
      </Modal>

        <Drawer
            opened={isKnowledgeMode && isCompact && mobileKnowledgeOpened}
            onClose={() => setMobileKnowledgeOpened(false)}
            position="right"
            size="90%"
            withCloseButton={false}
            padding={0}
            zIndex={200}
        >
            <Box h="100dvh" style={{ display: 'flex', flexDirection: 'column' }}>
                <Group p="md" bg="white" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                    <Text fw={600}>Knowledge Panel</Text>
                    <ActionIcon variant="subtle" onClick={() => setMobileKnowledgeOpened(false)}>
                        <ArrowUp size={20} className="rotate-90" />
                    </ActionIcon>
                </Group>
                 <KnowledgePanel 
                    cards={knowledgeCards} 
                    visible={true} 
                    activeCardId={activeCardId}
                    onCardClick={(id) => setActiveCardId(id)}
                    onAsk={handleCardAsk}
                    onDelete={handleDeleteCard}
                    cardRefs={cardRefs}
                    cardChats={cardChats}
                    loadingCardId={loadingCardId}
                />
            </Box>
        </Drawer>

    </Stack>
  );
};

export default ChatInterface;

