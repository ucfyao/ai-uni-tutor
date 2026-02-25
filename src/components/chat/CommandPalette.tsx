import React from 'react';
import { Box, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ChatCommand } from '@/constants/commands';
import { useLanguage } from '@/i18n/LanguageContext';

interface CommandPaletteProps {
  commands: ChatCommand[];
  selectedIndex: number;
  onSelect: (command: ChatCommand) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  selectedIndex,
  onSelect,
}) => {
  const { t } = useLanguage();

  if (commands.length === 0) return null;

  return (
    <Paper
      shadow="lg"
      radius="lg"
      withBorder
      p={6}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 8,
        maxHeight: 280,
        overflowY: 'auto',
        zIndex: 100,
        backgroundColor: 'var(--mantine-color-body)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Stack gap={2}>
        {commands.map((cmd, i) => {
          const cmdT = (t.chat.commands as Record<string, { label: string; desc: string }>)[
            cmd.labelKey
          ];
          const CmdIcon = cmd.icon;
          const isSelected = i === selectedIndex;

          return (
            <Group
              key={cmd.id}
              gap="sm"
              wrap="nowrap"
              px="sm"
              py={8}
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                backgroundColor: isSelected ? `var(--mantine-color-${cmd.color}-0)` : 'transparent',
                transition: 'background-color 0.1s ease',
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(cmd)}
            >
              <ThemeIcon
                size={32}
                radius="md"
                variant="light"
                color={cmd.color}
                style={{ flexShrink: 0 }}
              >
                <CmdIcon size={16} strokeWidth={1.8} />
              </ThemeIcon>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} align="center">
                  <Text fw={600} size="sm" truncate>
                    {cmdT?.label ?? cmd.id}
                  </Text>
                  <Text size="xs" c={`${cmd.color}.5`} fw={500} ff="monospace">
                    {cmd.command}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {cmdT?.desc ?? ''}
                </Text>
              </Box>
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
};
