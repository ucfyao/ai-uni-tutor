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
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { createClient } from '@/lib/supabase/client';
import { ChatSession, TutoringMode } from '../types/index';

// ============================================================================
// AVATAR STYLE
// ============================================================================

const avatarGradient = { from: 'indigo', to: 'violet', deg: 135 };

// ============================================================================
// MODULE CONFIG
// ============================================================================

const CHAT_MODULES = [
  {
    mode: 'Lecture Helper' as TutoringMode,
    labelKey: 'lectures' as const,
    icon: Presentation,
    color: 'indigo',
  },
  {
    mode: 'Assignment Coach' as TutoringMode,
    labelKey: 'assignments' as const,
    icon: Compass,
    color: 'violet',
  },
  {
    mode: 'Mock Exam' as TutoringMode,
    labelKey: 'mockExams' as const,
    icon: FileQuestion,
    color: 'emerald',
  },
];

const JUMP_LINKS = [
  { labelKey: 'knowledgeBase' as const, icon: GraduationCap, href: '/knowledge' },
];

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
  const { t } = useLanguage();
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
        align="center"
        gap={0}
        style={{
          backgroundColor: 'var(--mantine-color-body)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.04)',
          fontFamily: 'var(--mantine-font-family)',
        }}
      >
        {/* Toggle button */}
        <Box h={52} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tooltip label={t.sidebar.openSidebar} position="right" color="dark" radius="md">
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
            <Tooltip key={link.href} label={t.sidebar[link.labelKey]} position="right">
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
            <Tooltip key={mod.mode} label={t.sidebar[mod.labelKey]} position="right">
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
                variant="gradient"
                gradient={avatarGradient}
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
                  {t.sidebar.upgradePlan}
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => router.push('/settings')}
              >
                {t.sidebar.settings}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<LogOut size={14} />} onClick={handleSignOut}>
                {t.sidebar.logOut}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : !loading ? (
          <Tooltip label={t.sidebar.signIn} position="right">
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
      style={{
        backgroundColor: 'var(--mantine-color-body)',
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
          className="sidebar-hover"
          style={{ borderRadius: 8, display: 'flex', alignItems: 'center' }}
        >
          <Logo size={22} alt="Logo" />
        </UnstyledButton>
        <Tooltip label={t.sidebar.closeSidebar} position="right">
          <ActionIcon variant="subtle" color="gray" onClick={onToggleSidebar} size={36} radius="md">
            <PanelLeft size={20} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Module sections + jump links */}
      <ScrollArea flex={1} scrollbarSize={4} scrollbars="y">
        <Stack gap={2} mt={12}>
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
                className="sidebar-hover"
                style={{ borderRadius: 8, cursor: 'pointer', width: 'calc(100% - 12px)' }}
              >
                <Group gap={10} wrap="nowrap">
                  <Icon size={18} strokeWidth={1.5} color="var(--mantine-color-gray-6)" />
                  <Text size="md">{t.sidebar[link.labelKey]}</Text>
                  <ChevronRight
                    size={12}
                    color="var(--mantine-color-gray-4)"
                    style={{ flexShrink: 0 }}
                  />
                </Group>
              </UnstyledButton>
            );
          })}

          <Box h={8} />

          {CHAT_MODULES.map((mod) => (
            <ModuleSection
              key={mod.mode}
              mode={mod.mode}
              label={t.sidebar[mod.labelKey]}
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
      <Box
        px={8}
        pb={8}
        pt={4}
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        {profile ? (
          <Menu shadow="lg" width={220} position="top-start" withinPortal>
            <Menu.Target>
              <UnstyledButton
                w="100%"
                py={6}
                px={8}
                className="sidebar-hover"
                style={{ borderRadius: 6 }}
              >
                <Group gap={8} wrap="nowrap">
                  <Avatar size={24} radius="xl" variant="gradient" gradient={avatarGradient}>
                    {(profile?.full_name?.[0] || profile?.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                  <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
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
                  <Avatar size={28} radius="xl" variant="gradient" gradient={avatarGradient}>
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
                  {t.sidebar.upgradePlan}
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<Wand2 size={14} />}
                onClick={() => router.push('/personalization')}
              >
                {t.sidebar.personalization}
              </Menu.Item>
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={() => router.push('/settings')}
              >
                {t.sidebar.settings}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<LifeBuoy size={14} />} onClick={() => router.push('/help')}>
                {t.sidebar.help}
              </Menu.Item>
              <Menu.Item leftSection={<LogOut size={14} />} onClick={handleSignOut}>
                {t.sidebar.logOut}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : !loading ? (
          <UnstyledButton
            w="100%"
            py={6}
            px={8}
            onClick={handleSignIn}
            className="sidebar-hover"
            style={{ borderRadius: 6 }}
          >
            <Group gap={8}>
              <LogIn size={16} color="var(--mantine-color-gray-5)" />
              <Text size="sm" c="dimmed">
                {t.sidebar.signIn}
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
  const { t } = useLanguage();

  return (
    <Box>
      {/* Module header row */}
      <Box
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        py={7}
        px={10}
        mx={6}
        className="sidebar-hover"
        style={{ borderRadius: 8, cursor: 'pointer' }}
      >
        <Group gap={8} wrap="nowrap" justify="space-between">
          <Group gap={10} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Icon size={18} strokeWidth={1.5} color={`var(--mantine-color-${color}-6)`} />
            <Text size="md" fw={600} truncate>
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
              {t.sidebar.noConversations}
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
  const { t } = useLanguage();

  return (
    <UnstyledButton
      component="div"
      onClick={() => onSelect(session.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      py={8}
      px={12}
      pl={indent ? 40 : 12}
      className="sidebar-session"
      data-active={isActive || undefined}
      style={{
        borderRadius: 0,
        cursor: 'pointer',
      }}
    >
      <Group wrap="nowrap" gap={8}>
        {/* Title */}
        <Text
          size="md"
          truncate
          c={isActive ? undefined : 'dimmed'}
          fw={isActive ? 500 : 400}
          style={{ flex: 1 }}
        >
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
                {t.sidebar.share}
              </Menu.Item>
              <Menu.Item
                leftSection={<PenLine size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename?.(session.id, session.title || session.course.code);
                }}
              >
                {t.sidebar.rename}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin?.(session.id, !session.isPinned);
                  showNotification({
                    message: session.isPinned ? t.toast.unpinned : t.toast.pinned,
                    color: 'indigo',
                    autoClose: 2000,
                  });
                }}
              >
                {session.isPinned ? t.sidebar.unpin : t.sidebar.pin}
              </Menu.Item>
              <Menu.Item
                leftSection={<Trash size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(session.id);
                }}
              >
                {t.sidebar.delete}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </UnstyledButton>
  );
};

export default Sidebar;
