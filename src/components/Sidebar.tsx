'use client';

import {
  ChevronDown,
  ChevronRight,
  Compass,
  Ellipsis,
  FileQuestion,
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
  Presentation,
  Settings,
  Share,
  Sparkles,
  Trash,
  Wand2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Divider,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { Logo } from '@/components/Logo';
import { useProfile } from '@/context/ProfileContext';
import { createClient } from '@/lib/supabase/client';
import { ChatSession, TutoringMode } from '../types/index';

// ============================================================================
// MODULE CONFIG
// ============================================================================

const CHAT_MODULES = [
  {
    mode: 'Lecture Helper' as TutoringMode,
    label: 'Lectures',
    icon: Presentation,
    color: 'indigo',
  },
  {
    mode: 'Assignment Coach' as TutoringMode,
    label: 'Assignments',
    icon: Compass,
    color: 'violet',
  },
  { mode: 'Mock Exam' as TutoringMode, label: 'Mock Exams', icon: FileQuestion, color: 'purple' },
];

const JUMP_LINKS = [{ label: 'Knowledge Base', icon: GraduationCap, href: '/knowledge' }];

// ============================================================================
// SIDEBAR
// ============================================================================

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: (mode: TutoringMode) => void;
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
  const { profile, loading } = useProfile();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Auto-expand the module that contains the active session
  const activeSessionMode = useMemo(() => {
    if (!activeSessionId) return null;
    const session = sessions.find((s) => s.id === activeSessionId);
    return session?.mode ?? null;
  }, [activeSessionId, sessions]);

  const [expandedModule, setExpandedModule] = useState<TutoringMode | null>(activeSessionMode);

  useEffect(() => {
    if (activeSessionMode) {
      setExpandedModule(activeSessionMode);
    }
  }, [activeSessionMode]);

  // Group sessions by mode, sorted pinned-first + lastUpdated desc, max 10
  const sessionsByMode = useMemo(() => {
    const map: Record<string, ChatSession[]> = {};
    for (const mod of CHAT_MODULES) {
      const filtered = sessions
        .filter((s) => s.mode === mod.mode)
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastUpdated - a.lastUpdated;
        })
        .slice(0, 10);
      map[mod.mode] = filtered;
    }
    return map;
  }, [sessions]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  const handleSignIn = () => router.push('/login');

  const isPro =
    profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';

  const toggleModule = (mode: TutoringMode) => {
    setExpandedModule((prev) => (prev === mode ? null : mode));
  };

  // === COLLAPSED STATE (icon-only) ===
  if (!opened) {
    return (
      <Stack
        h="100%"
        bg="white"
        align="center"
        gap={0}
        style={{
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
          fontFamily: 'var(--mantine-font-family)',
        }}
      >
        {/* Toggle button */}
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

        {/* Jump links */}
        {JUMP_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Tooltip key={link.href} label={link.label} position="right">
              <ActionIcon
                onClick={() => router.push(link.href)}
                variant="subtle"
                color="gray"
                size={36}
                radius="md"
                mb={4}
              >
                <Icon size={20} strokeWidth={1.5} />
              </ActionIcon>
            </Tooltip>
          );
        })}

        {/* Chat modules */}
        {CHAT_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Tooltip key={mod.mode} label={mod.label} position="right">
              <ActionIcon
                onClick={() => {
                  onToggleSidebar();
                  setExpandedModule(mod.mode);
                }}
                variant="subtle"
                color="gray"
                size={36}
                radius="md"
                mb={4}
              >
                <Icon size={20} strokeWidth={1.5} />
              </ActionIcon>
            </Tooltip>
          );
        })}

        <Box flex={1} />

        {/* User Avatar */}
        {profile ? (
          <Menu shadow="lg" width={220} position="right-end" withinPortal>
            <Menu.Target>
              <Avatar
                size={28}
                radius="xl"
                color="dark"
                variant="filled"
                style={{ cursor: 'pointer' }}
                mb={8}
              >
                {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
              </Avatar>
            </Menu.Target>
            <Menu.Dropdown>
              <Box px="sm" py="xs">
                <Text size="sm" fw={600}>
                  {profile?.full_name || profile?.email?.split('@')[0]}
                </Text>
                <Text size="xs" c="dimmed">
                  {profile?.email}
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
        ) : !loading ? (
          <Tooltip label="Sign In" position="right">
            <ActionIcon
              variant="filled"
              size={28}
              radius="xl"
              onClick={handleSignIn}
              color="dark"
              mb={8}
            >
              <LogIn size={14} />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </Stack>
    );
  }

  // === EXPANDED STATE ===
  return (
    <Stack
      h="100%"
      gap={0}
      bg="white"
      style={{
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
        fontFamily: 'var(--mantine-font-family)',
      }}
    >
      {/* Header: Logo and Toggle — 52px, matches AppShell header */}
      <Group justify="space-between" align="center" h={52} px={8}>
        <UnstyledButton
          onClick={onGoHome}
          h={36}
          px={8}
          className="hover:bg-gray-100 transition-colors"
          style={{ borderRadius: 8, display: 'flex', alignItems: 'center' }}
        >
          <Logo size={22} alt="Logo" />
        </UnstyledButton>
        <Tooltip label="Close sidebar" position="right">
          <ActionIcon variant="subtle" color="gray" onClick={onToggleSidebar} size={36} radius="md">
            <PanelLeft size={20} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Module sections + jump links */}
      <ScrollArea flex={1} scrollbarSize={4}>
        <Stack gap={2} mt={4}>
          {/* Jump links — Knowledge Base at top */}
          {JUMP_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <UnstyledButton
                key={link.href}
                onClick={() => router.push(link.href)}
                w="100%"
                py={7}
                px={10}
                mx={6}
                className="hover:bg-gray-100 transition-colors"
                style={{ borderRadius: 8, cursor: 'pointer', width: 'calc(100% - 12px)' }}
              >
                <Group gap={10} wrap="nowrap" justify="space-between">
                  <Group gap={10} wrap="nowrap">
                    <Icon size={18} strokeWidth={1.5} color="var(--mantine-color-gray-6)" />
                    <Text size="sm" c="gray.8">
                      {link.label}
                    </Text>
                  </Group>
                  <ChevronRight size={14} color="var(--mantine-color-gray-4)" />
                </Group>
              </UnstyledButton>
            );
          })}

          <Divider my={8} mx={16} color="gray.1" />

          {CHAT_MODULES.map((mod) => (
            <ModuleSection
              key={mod.mode}
              mode={mod.mode}
              label={mod.label}
              icon={mod.icon}
              color={mod.color}
              sessions={sessionsByMode[mod.mode] || []}
              expanded={expandedModule === mod.mode}
              onToggle={() => toggleModule(mod.mode)}
              onNewChat={() => onNewChat(mod.mode)}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onTogglePin={onTogglePin}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              onShareSession={onShareSession}
            />
          ))}
        </Stack>
      </ScrollArea>

      {/* User Section (Bottom) — Compact */}
      <Box px={8} pb={8} pt={4} style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
        {profile ? (
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
                    {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                  <Text size="sm" fw={500} c="gray.8" truncate style={{ flex: 1 }}>
                    {profile?.full_name || profile?.email?.split('@')[0]}
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
                    {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Text size="sm" fw={600}>
                      {profile?.full_name || profile?.email?.split('@')[0]}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {profile?.email}
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
        ) : !loading ? (
          <UnstyledButton
            w="100%"
            py={6}
            px={8}
            onClick={handleSignIn}
            className="hover:bg-gray-100 transition-colors"
            style={{ borderRadius: 6 }}
          >
            <Group gap={8}>
              <LogIn size={16} color="var(--mantine-color-gray-5)" />
              <Text size="sm" c="gray.7">
                Sign in
              </Text>
            </Group>
          </UnstyledButton>
        ) : null}
      </Box>
    </Stack>
  );
};

// ============================================================================
// MODULE SECTION
// ============================================================================

interface ModuleSectionProps {
  mode: TutoringMode;
  label: string;
  icon: React.ElementType;
  color: string;
  sessions: ChatSession[];
  expanded: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onDeleteSession?: (id: string) => void;
  onShareSession?: (id: string) => void;
}

const ModuleSection: React.FC<ModuleSectionProps> = ({
  label,
  icon: Icon,
  color,
  sessions,
  expanded,
  onToggle,
  onNewChat,
  activeSessionId,
  onSelectSession,
  onTogglePin,
  onRenameSession,
  onDeleteSession,
  onShareSession,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Box>
      {/* Module header row — <div> to allow nested <button> (ActionIcon) without HTML nesting violation */}
      <Box
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        py={7}
        px={10}
        mx={6}
        className="hover:bg-gray-100 transition-colors"
        style={{ borderRadius: 8, cursor: 'pointer' }}
      >
        <Group gap={8} wrap="nowrap" justify="space-between">
          <Group gap={10} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Icon size={18} strokeWidth={1.5} color={`var(--mantine-color-${color}-6)`} />
            <Text size="sm" fw={600} c="gray.8" truncate>
              {label}
            </Text>
            <ChevronDown
              size={12}
              color="var(--mantine-color-gray-4)"
              style={{
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.15s ease',
                flexShrink: 0,
              }}
            />
          </Group>
          {hovered && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size={22}
              radius="sm"
              onClick={(e) => {
                e.stopPropagation();
                onNewChat();
              }}
            >
              <Plus size={14} strokeWidth={2} />
            </ActionIcon>
          )}
        </Group>
      </Box>

      {/* Collapsible session list */}
      {expanded && (
        <Stack gap={0} pb={4}>
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
              indent
            />
          ))}
          {sessions.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py={8} px="md">
              No conversations yet
            </Text>
          )}
        </Stack>
      )}
    </Box>
  );
};

// ============================================================================
// SESSION ITEM
// ============================================================================

interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  indent?: boolean;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onRename,
  onDelete,
  onShare,
  indent,
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
      pl={indent ? 40 : 12}
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
