'use client';

import { User } from '@supabase/supabase-js';
import {
  ChevronDown,
  Ellipsis,
  GraduationCap,
  LifeBuoy,
  LogIn,
  LogOut,
  PanelLeft,
  PanelLeftOpen,
  PenLine,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Share,
  Sparkles,
  Trash,
  Wand2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Collapse,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { createClient } from '@/lib/supabase/client';
import { ChatSession } from '../types/index';

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

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onToggleSidebar,
  onTogglePin,
  onRenameSession,
  onDeleteSession,
  onShareSession,
  onGoHome,
  opened,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{
    full_name?: string;
    subscription_status?: string;
  } | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const [chatsExpanded, { toggle: toggleChats }] = useDisclosure(true);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleSignIn = () => router.push('/login');

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  // === COLLAPSED STATE ===
  if (!opened) {
    return (
      <Stack h="100%" bg="white" align="center" gap={0}>
        {/* Header area - 52px height to match expanded */}
        <Box h={52} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tooltip label="Open sidebar" position="right" color="dark" radius="md">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onToggleSidebar}
              size={36}
              radius="md"
            >
              <PanelLeftOpen size={20} strokeWidth={1.5} />
            </ActionIcon>
          </Tooltip>
        </Box>

        {/* New Chat (+) */}
        <Tooltip label="New chat" position="right">
          <ActionIcon
            onClick={onNewChat}
            variant="subtle"
            color="gray"
            size={36}
            radius="md"
            mb={4}
          >
            <Plus size={20} strokeWidth={2} />
          </ActionIcon>
        </Tooltip>

        {/* Search */}
        <Tooltip label="Search chats" position="right">
          <ActionIcon variant="subtle" color="gray" size={36} radius="md" mb={4}>
            <Search size={20} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>

        {/* Knowledge Base */}
        <Tooltip label="Knowledge Base" position="right">
          <ActionIcon
            onClick={() => router.push('/knowledge')}
            variant="subtle"
            color="gray"
            size={36}
            radius="md"
          >
            <GraduationCap size={20} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>

        <Box flex={1} />

        {/* User Avatar */}
        {user ? (
          <Menu shadow="lg" width={220} position="right-end" withinPortal>
            <Menu.Target>
              <Avatar
                size={28}
                radius="xl"
                color="dark"
                variant="filled"
                style={{ cursor: 'pointer' }}
              >
                {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </Avatar>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" py="xs">
                <Text size="sm" fw={600}>
                  {profile?.full_name || user.email?.split('@')[0]}
                </Text>
                <Text size="xs" c="dimmed">
                  {user.email}
                </Text>
              </Box>
              <Menu.Divider />
              {!isPro && (
                <Menu.Item
                  leftSection={<Sparkles size={14} />}
                  onClick={() => router.push('/pricing')}
                >
                  Upgrade plan
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => router.push('/settings')}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<LogOut size={14} />} onClick={handleSignOut}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Tooltip label="Sign In" position="right">
            <ActionIcon variant="filled" size={28} radius="xl" onClick={handleSignIn} color="dark">
              <LogIn size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Stack>
    );
  }

  // === EXPANDED STATE ===
  return (
    <Stack h="100%" gap={0} bg="white">
      {/* Header: 52px height, Logo and Toggle aligned */}
      <Group justify="space-between" align="center" h={52} px={8}>
        <UnstyledButton
          onClick={onGoHome}
          h={36}
          px={8}
          className="hover:bg-gray-100 transition-colors"
          style={{ borderRadius: 8, display: 'flex', alignItems: 'center' }}
        >
          <img src="/assets/logo.png" alt="Logo" width={22} height={22} />
        </UnstyledButton>
        <Tooltip label="Close sidebar" position="right">
          <ActionIcon variant="subtle" color="gray" onClick={onToggleSidebar} size={36} radius="md">
            <PanelLeft size={20} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Navigation Items */}
      <Stack gap={2} px={6} mt={4}>
        {/* New Chat (+) */}
        <UnstyledButton
          onClick={onNewChat}
          w="100%"
          py={7}
          px={10}
          className="hover:bg-gray-100 transition-colors"
          style={{ borderRadius: 8, cursor: 'pointer' }}
        >
          <Group gap={10} wrap="nowrap">
            <Plus size={18} strokeWidth={2} className="text-gray-600" />
            <Text size="sm" c="gray.8">
              New chat
            </Text>
          </Group>
        </UnstyledButton>

        {/* Search */}
        <UnstyledButton
          w="100%"
          py={7}
          px={10}
          className="hover:bg-gray-100 transition-colors"
          style={{ borderRadius: 8, cursor: 'pointer' }}
        >
          <Group gap={10} wrap="nowrap">
            <Search size={18} strokeWidth={1.5} className="text-gray-600" />
            <Text size="sm" c="gray.8">
              Search chats
            </Text>
          </Group>
        </UnstyledButton>

        {/* Knowledge Base */}
        <UnstyledButton
          onClick={() => router.push('/knowledge')}
          w="100%"
          py={7}
          px={10}
          className="hover:bg-gray-100 transition-colors"
          style={{ borderRadius: 8, cursor: 'pointer' }}
        >
          <Group gap={10} wrap="nowrap">
            <GraduationCap size={18} strokeWidth={1.5} className="text-gray-600" />
            <Text size="sm" c="gray.8">
              Knowledge Base
            </Text>
          </Group>
        </UnstyledButton>
      </Stack>

      {/* Your Chats Section */}
      <Box
        mt={12}
        flex={1}
        style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Section Header */}
        <UnstyledButton
          onClick={toggleChats}
          px={16}
          py={6}
          className="hover:bg-gray-50 transition-colors"
          style={{ cursor: 'pointer' }}
        >
          <Group gap={4}>
            <Text size="xs" c="gray.5" fw={500}>
              Your chats
            </Text>
            <ChevronDown
              size={12}
              className="text-gray-400"
              style={{
                transform: chatsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </Group>
        </UnstyledButton>

        {/* Chat List */}
        <Collapse in={chatsExpanded}>
          <ScrollArea flex={1} scrollbarSize={4}>
            <Stack gap={0} pb={8}>
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={activeSessionId === session.id}
                  onSelect={onSelectSession}
                  onTogglePin={onTogglePin}
                  onRename={onRenameSession}
                  onDelete={onDeleteSession}
                  onShare={onShareSession}
                />
              ))}

              {sessions.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg" px="md">
                  No conversations yet
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Collapse>
      </Box>

      {/* User Section (Bottom) - Compact */}
      <Box px={8} pb={8} pt={4} style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
        {user ? (
          <Menu shadow="lg" width={220} position="top-start" withinPortal>
            <Menu.Target>
              <UnstyledButton
                w="100%"
                py={6}
                px={8}
                className="hover:bg-gray-100 transition-colors"
                style={{ borderRadius: 6 }}
              >
                <Group gap={8} wrap="nowrap">
                  <Avatar size={24} radius="xl" color="dark" variant="filled">
                    {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                  <Text size="sm" fw={500} c="gray.8" truncate style={{ flex: 1 }}>
                    {profile?.full_name || user.email?.split('@')[0]}
                  </Text>
                  {isPro && (
                    <Badge size="xs" variant="light" color="dark" radius="sm">
                      Plus
                    </Badge>
                  )}
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" py="xs">
                <Group gap={8}>
                  <Avatar size={28} radius="xl" color="dark" variant="filled">
                    {(profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Text size="sm" fw={600}>
                      {profile?.full_name || user.email?.split('@')[0]}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {user.email}
                    </Text>
                  </Box>
                </Group>
              </Box>
              <Menu.Divider />
              {!isPro && (
                <Menu.Item
                  leftSection={<Sparkles size={14} />}
                  onClick={() => router.push('/pricing')}
                >
                  Upgrade plan
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<Wand2 size={14} />}
                onClick={() => router.push('/personalization')}
              >
                Personalization
              </Menu.Item>
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => router.push('/settings')}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<LifeBuoy size={14} />} onClick={() => router.push('/help')}>
                Help
              </Menu.Item>
              <Menu.Item leftSection={<LogOut size={14} />} onClick={handleSignOut}>
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <UnstyledButton
            w="100%"
            py={6}
            px={8}
            onClick={handleSignIn}
            className="hover:bg-gray-100 transition-colors"
            style={{ borderRadius: 6 }}
          >
            <Group gap={8}>
              <LogIn size={16} className="text-gray-500" />
              <Text size="sm" c="gray.7">
                Sign in
              </Text>
            </Group>
          </UnstyledButton>
        )}
      </Box>
    </Stack>
  );
};

// === SESSION ITEM ===
interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onRename,
  onDelete,
  onShare,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <UnstyledButton
      component="div"
      onClick={() => onSelect(session.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      py={8}
      px={12}
      bg={isActive ? 'gray.1' : hovered ? 'gray.0' : 'transparent'}
      style={{
        borderRadius: 0,
        transition: 'background 0.1s ease',
        cursor: 'pointer',
      }}
    >
      <Group wrap="nowrap" gap={8}>
        {/* Title */}
        <Text size="sm" truncate c={isActive ? 'dark.9' : 'gray.7'} fw={400} style={{ flex: 1 }}>
          {session.title || session.course.code}
        </Text>

        {/* Pin indicator: show when pinned AND not hovered */}
        {session.isPinned && !hovered && (
          <Pin size={14} style={{ color: 'var(--mantine-color-gray-5)', flexShrink: 0 }} />
        )}

        {/* Actions Menu: show only when hovered */}
        {hovered && (
          <Menu position="right-start" withinPortal shadow="md">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                size={22}
                radius="sm"
                color="gray"
                style={{ flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Ellipsis size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<Share size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.(session.id);
                }}
              >
                Share
              </Menu.Item>
              <Menu.Item
                leftSection={<PenLine size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename?.(session.id, session.title || session.course.code);
                }}
              >
                Rename
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin?.(session.id, !session.isPinned);
                }}
              >
                {session.isPinned ? 'Unpin' : 'Pin'}
              </Menu.Item>
              <Menu.Item
                leftSection={<Trash size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(session.id);
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </UnstyledButton>
  );
};

export default Sidebar;
