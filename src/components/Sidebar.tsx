'use client';

import React, { useEffect, useState } from 'react';
import { ActionIcon, Avatar, Box, Button, Group, Menu, Modal, ScrollArea, Stack, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton, rem } from '@mantine/core';
import { Plus, GraduationCap, PanelLeft, PanelLeftOpen, LogOut, LogIn, Settings, Sparkles, Wand2, LifeBuoy, Pin, PinOff, MoreHorizontal, Share, PenLine, Trash } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { ChatSession } from '../types/index';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onDeleteSession?: (id: string) => void;
  onShareSession?: (id: string) => void;
  onUpdateSession?: (id: string, isShared: boolean) => void;
  onGoHome?: () => void;
  opened: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ sessions, activeSessionId, onSelectSession, onNewChat, onToggleSidebar, onTogglePin, onRenameSession, onDeleteSession, onShareSession, onUpdateSession, onGoHome, opened }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const supabase = createClient();
  const router = useRouter();
  const [expandHover, setExpandHover] = useState(false);

  // Reset hover state when sidebar toggles
  useEffect(() => {
    setExpandHover(false);
  }, [opened]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        setProfile(data);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleSignIn = () => {
      router.push('/login');
  }

  if (!opened) {
    return (
      <Stack h="100%" bd={{ base: 'none', sm: '1px solid var(--mantine-color-gray-2)' }} align="center" py="sm">
        {/* Mini Header / Toggle */}
        <Tooltip label="Expand sidebar" position="right" withArrow>
            <ActionIcon 
                variant="transparent" 
                color="dimmed" 
                onClick={onToggleSidebar} 
                size="lg" 
                mb="xs"
                className="transition-colors hover:text-dark"
                onMouseEnter={() => setExpandHover(true)}
                onMouseLeave={() => setExpandHover(false)}
            >
                {/* Show Logo by default, show Panel icon on hover */}
                {expandHover ? (
                    <PanelLeftOpen size={20} />
                ) : (
                    <img src="/assets/logo.png" alt="Logo" width={22} height={22} />
                )}
            </ActionIcon>
        </Tooltip>

        {/* Mini New Chat */}
        <Tooltip label="New chat" position="right" withArrow>
            <ActionIcon
                onClick={onNewChat}
                size={34}
                radius="xl"
                variant="light"
                color="indigo"
                className="shadow-sm hover:shadow-md transition-all"
            >
                <Plus size={18} strokeWidth={2.5} />
            </ActionIcon>
        </Tooltip>

        <Box style={{ flex: 1 }} />

        {/* Mini User */}
        <Box>
        {user ? (
             <Menu shadow="md" width={260} position="right-end" withArrow arrowPosition="center" withinPortal>
                <Menu.Target>
                     <Tooltip label={profile?.full_name || (user?.email || 'User')} position="right" withArrow>
                         <Avatar size="sm" radius="md" color="indigo" variant="filled" style={{ cursor: 'pointer' }} className="hover:opacity-80 transition-opacity">
                            {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                         </Avatar>
                     </Tooltip>
                </Menu.Target>
                <Menu.Dropdown p="sm">
                    <Box px="md" py="sm">
                        <Text size="sm" fw={600}>{profile?.full_name || user.email?.split('@')[0]}</Text>
                        <Text size="xs" c="dimmed">{user.email}</Text>
                    </Box>
                    <Menu.Divider />
                    
                    {!(profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') && (
                        <Menu.Item 
                            leftSection={<Sparkles size={18} />} 
                            onClick={() => router.push('/pricing')}
                            styles={{ item: { fontWeight: 500 } }}
                        >
                            Upgrade plan
                        </Menu.Item>
                    )}
                    
                    <Menu.Item 
                        leftSection={<Wand2 size={18} />}
                        onClick={() => router.push('/personalization')}
                    >
                        Personalization
                    </Menu.Item>
                    
                    <Menu.Item 
                        leftSection={<Settings size={18} />} 
                        onClick={() => router.push('/settings')}
                    >
                        Settings
                    </Menu.Item>
                    
                    <Menu.Divider />
                    
                    <Menu.Item 
                        leftSection={<LifeBuoy size={18} />}
                        onClick={() => router.push('/help')}
                    >
                        Help
                    </Menu.Item>
                    
                    <Menu.Item 
                        leftSection={<LogOut size={18} />} 
                        onClick={handleSignOut}
                    >
                        Log out
                    </Menu.Item>
                </Menu.Dropdown>
             </Menu>
        ) : (
            <Tooltip label="Sign In" position="right" withArrow>
                <ActionIcon variant="light" size="lg" radius="md" onClick={handleSignIn} color="dark">
                    <LogIn size={18} />
                </ActionIcon>
            </Tooltip>
        )}
        </Box>
      </Stack>
    );
  }

  return (
    <Stack h="100%" gap={0} bd={{ base: 'none', sm: '1px solid var(--mantine-color-gray-2)' }}>
      
      {/* --- TOP SECTION --- */}
      <Box p="md">
        {/* Header / Brand */}
        <Group justify="space-between" mb="xl" h={28} align="center">
            <Group gap={10} visibleFrom="sm" style={{ cursor: 'pointer' }} onClick={onGoHome} align="center">
                <img src="/assets/logo.png" alt="Logo" width={28} height={28} />
                <Text fw={600} size="md" c="dark.9" style={{ letterSpacing: '-0.3px' }}>AI Tutor</Text>
            </Group>
            
            <Tooltip label="Close sidebar" withArrow>
                <ActionIcon variant="transparent" c="dimmed" className="hover:text-gray-900 transition-colors" onClick={onToggleSidebar} size="lg">
                    <PanelLeft size={20} />
                </ActionIcon>
            </Tooltip>
        </Group>

        {/* New Chat Button */ }
        <Button 
            fullWidth
            variant="outline"
            color="indigo"
            mb="xs"
            onClick={onNewChat}
            leftSection={<Plus size={16} strokeWidth={2.5} />}
            justify="flex-start"
            styles={{
                label: {
                    fontWeight: 600,
                }
            }}
        >
            New Chat
        </Button>
        <Button
                fullWidth
                variant="light" 
                color="indigo"
                leftSection={<GraduationCap size={16} />}
                justify="flex-start"
                onClick={() => router.push('/knowledge')}
             >
                Knowledge Base
             </Button>
      </Box>

      {/* --- MIDDLE SECTION (Grow) --- */}
      <Box flex={1} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        <Group px="md" mb="xs" justify="space-between">
            <Text size="11px" fw={700} c="dimmed" tt="uppercase" lts={1.2}>Recent Activity</Text>
        </Group>
        
        <ScrollArea flex={1} px="md">
          <Stack gap={4} pb="md"> 
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <UnstyledButton
                  component="div"
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  py={6}
                  bg={isActive ? 'gray.1' : 'transparent'}
                  style={{
                    borderRadius: 'var(--mantine-radius-md)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  className={!isActive ? 'hover:bg-gray-50 group' : 'group'}
                >
                  <Group wrap="nowrap" gap="xs">
                      <Box style={{ flex: 1, overflow: 'hidden' }}>
                        <Group gap={6} align="center" wrap="nowrap">
                            {session.isPinned && <Pin size={12} className="text-indigo-500 fill-indigo-500" />}
                            <Text fz={15} truncate c={isActive ? 'dark.9' : 'gray.7'} fw={isActive ? 600 : 450} lh="20px">
                                {session.title || session.course.code}
                            </Text>
                        </Group>
                      </Box>
                      
                      <Menu position="right-start" withArrow arrowPosition="center" withinPortal>
                          <Menu.Target>
                            <ActionIcon 
                                variant="subtle" 
                                size="xs" 
                                c="gray.5"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item 
                                leftSection={<Share size={14} />} 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onShareSession && onShareSession(session.id);
                                }}
                            >
                                Share
                            </Menu.Item>

                            <Menu.Item 
                                leftSection={<PenLine size={14} />} 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRenameSession && onRenameSession(session.id, session.title || session.course.code); // Pass current title effectively? Wait, Sidebar signature logic needs check.
                                }}
                            >
                                Rename
                            </Menu.Item>
                            
                            <Menu.Divider />
                            
                            <Menu.Item 
                                leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin && onTogglePin(session.id, !session.isPinned);
                                }}
                            >
                                {session.isPinned ? 'Unpin chat' : 'Pin chat'}
                            </Menu.Item>

                            <Menu.Item 
                                leftSection={<Trash size={14} />} 
                                color="red"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSession && onDeleteSession(session.id);
                                }}
                            >
                                Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                      </Menu>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        </ScrollArea>
      </Box>

      {/* --- BOTTOM SECTION --- */}
      <Box style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
        {user ? (
            <Menu shadow="md" width={260} position="top-start" withArrow arrowPosition="center">
                <Menu.Target>
                    <UnstyledButton 
                        w="100%" 
                        p="xs" 
                        style={{ borderRadius: 'var(--mantine-radius-md)' }} 
                        className="hover:bg-gray-50 transition-colors"
                    >
                        <Group>
                            <Avatar size="sm" radius="md" color="indigo" variant="filled">
                                {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                            </Avatar>
                            <Box style={{ flex: 1, overflow: 'hidden' }}>
                                <Text size="15px" fw={600} c="dark.9" truncate>{profile?.full_name || user.email?.split('@')[0]}</Text>
                                {profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing' ? (
                                    <Text size="xs" c="indigo.6" fw={600}>Plus</Text>
                                ) : (
                                    <Text size="xs" c="dimmed">Free Plan</Text>
                                )}
                            </Box>
                        </Group>
                    </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown p="xs">
                    <Box px="md" py="sm">
                        <Text size="sm" fw={600}>{profile?.full_name || user.email?.split('@')[0]}</Text>
                        <Text size="xs" c="dimmed">{user.email}</Text>
                    </Box>
                    <Menu.Divider />
                    
                    {!(profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') && (
                        <Menu.Item 
                            leftSection={<Sparkles size={18} />} 
                            onClick={() => router.push('/pricing')}
                            styles={{ item: { fontWeight: 500 } }}
                        >
                            Upgrade plan
                        </Menu.Item>
                    )}
                    
                    <Menu.Item 
                        leftSection={<Wand2 size={18} />}
                        onClick={() => router.push('/personalization')}
                    >
                        Personalization
                    </Menu.Item>
                    
                    <Menu.Item 
                        leftSection={<Settings size={18} />} 
                        onClick={() => router.push('/settings')}
                    >
                        Settings
                    </Menu.Item>
                    
                    <Menu.Divider />
                    
                    <Menu.Item 
                        leftSection={<LifeBuoy size={18} />}
                        onClick={() => router.push('/help')}
                    >
                        Help
                    </Menu.Item>
                    
                    <Menu.Item 
                        leftSection={<LogOut size={18} />} 
                        onClick={handleSignOut}
                    >
                        Log out
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>
        ) : (
             <Button fullWidth variant="light" color="dark" onClick={handleSignIn} leftSection={<LogIn size={16} />}>
                Sign In
             </Button>
        )}
      </Box>

    </Stack>
  );
};

export default Sidebar;
