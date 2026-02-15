import { BookOpen, MoreHorizontal, PenLine, Pin, PinOff, Share2, Trash } from 'lucide-react';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActionIcon, Box, Group, Menu, Text, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { MODES_METADATA } from '@/constants/modes';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChatSession } from '@/types';

interface ChatPageLayoutProps {
  session: ChatSession;
  onShare: () => void;
  onRename: () => void;
  onPin: () => void;
  onDelete: () => void;
  showKnowledgePanel?: boolean;
  onKnowledgePanelToggle?: () => void;
  children: ReactNode;
}

/**
 * Shared layout component for all chat mode pages.
 * Manages header display (desktop + mobile) and provides consistent structure.
 */
export const ChatPageLayout: React.FC<ChatPageLayoutProps> = ({
  session,
  onShare,
  onRename,
  onPin,
  onDelete,
  showKnowledgePanel = false,
  onKnowledgePanelToggle,
  children,
}) => {
  const { t } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 48em)', false); // 768px
  const isCompact = useMediaQuery('(max-width: 75em)', false); // 1200px (lg breakpoint)
  const { setHeaderContent } = useHeader();
  const [mobileKnowledgeOpened, setMobileKnowledgeOpened] = useState(false);

  const headerNode = useMemo(
    () => (
      <Group justify="space-between" wrap="nowrap" w="100%">
        <Group
          gap={8}
          align="center"
          wrap="nowrap"
          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
          px={isMobile ? 6 : 8}
          py={isMobile ? 4 : 6}
          className="sidebar-hover rounded-lg"
        >
          <Text fw={650} size={isMobile ? 'md' : 'lg'} truncate>
            {session.course.code}
          </Text>
          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
            {' '}
            {'>'}{' '}
          </Text>
          {session.mode && MODES_METADATA[session.mode] && (
            <ThemeIcon
              size={isMobile ? 18 : 20}
              radius="md"
              variant="light"
              color={MODES_METADATA[session.mode].color}
            >
              {React.createElement(MODES_METADATA[session.mode].icon, { size: isMobile ? 11 : 12 })}
            </ThemeIcon>
          )}
          <Text
            fw={600}
            size="sm"
            c={
              session.mode && MODES_METADATA[session.mode]
                ? `${MODES_METADATA[session.mode].color}.7`
                : 'indigo.6'
            }
            truncate
          >
            {session.mode || t.chat.selectMode}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {showKnowledgePanel && isCompact && (
            <ActionIcon
              variant={mobileKnowledgeOpened ? 'light' : 'subtle'}
              color="indigo"
              radius="xl"
              size={isMobile ? 'md' : 'lg'}
              onClick={() => {
                setMobileKnowledgeOpened(true);
                onKnowledgePanelToggle?.();
              }}
              aria-label="Open knowledge panel"
              aria-expanded={mobileKnowledgeOpened}
            >
              <BookOpen size={isMobile ? 18 : 20} strokeWidth={1.5} />
            </ActionIcon>
          )}
          <ActionIcon
            variant="subtle"
            c="dimmed"
            radius="xl"
            size={isMobile ? 'md' : 'lg'}
            onClick={onShare}
            aria-label="Share conversation"
          >
            <Share2 size={isMobile ? 18 : 20} strokeWidth={1.5} />
          </ActionIcon>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                c="dimmed"
                radius="xl"
                size={isMobile ? 'md' : 'lg'}
                aria-label="More options"
              >
                <MoreHorizontal size={isMobile ? 18 : 20} strokeWidth={1.5} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Share2 size={14} />} onClick={onShare}>
                {t.chat.share}
              </Menu.Item>
              <Menu.Item leftSection={<PenLine size={14} />} onClick={onRename}>
                {t.chat.rename}
              </Menu.Item>
              <Menu.Item
                leftSection={session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                onClick={onPin}
              >
                {session.isPinned ? t.chat.unpinChat : t.chat.pinChat}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<Trash size={14} />} color="red" onClick={onDelete}>
                {t.chat.delete}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    ),
    [
      t,
      session.course.code,
      session.mode,
      session.isPinned,
      showKnowledgePanel,
      isCompact,
      isMobile,
      mobileKnowledgeOpened,
      onShare,
      onRename,
      onPin,
      onDelete,
      onKnowledgePanelToggle,
    ],
  );

  // Sync header to context on mobile
  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    // Cleanup to prevent stale header if unmounting
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  // Desktop header (hidden on mobile, shown by Shell's AppShell.Header)
  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Desktop Header */}
      {!isMobile && (
        <Box
          px="md"
          h={52}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--mantine-color-default-border)',
          }}
        >
          {headerNode}
        </Box>
      )}

      {/* Main Content - minHeight: 0 so flex child can shrink and inner scroll works */}
      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</Box>
    </Box>
  );
};
