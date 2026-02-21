'use client';

import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { getDocColor } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';
import { statusColor } from './types';

interface DocumentDetailHeaderProps {
  docId: string;
  initialName: string;
  docType: string;
  school: string;
  course: string;
  status: string;
  backHref?: string;
  onSaveName: (newName: string) => Promise<void>;
  /** When provided, status badge becomes clickable (e.g. publish/unpublish toggle). */
  onStatusClick?: () => void;
  /** Loading state for status action. */
  statusLoading?: boolean;
}

export function DocumentDetailHeader({
  docId,
  initialName,
  docType,
  school,
  course,
  status,
  backHref,
  onSaveName,
  onStatusClick,
  statusLoading,
}: DocumentDetailHeaderProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      await onSaveName(trimmed);
    }
    setEditing(false);
  };

  return (
    <Group justify="space-between" align="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
      {/* Left: back + name */}
      <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
        <Button
          component={Link}
          href={backHref ?? '/admin/knowledge'}
          variant="subtle"
          color="gray"
          size="compact-sm"
          px={4}
        >
          <ArrowLeft size={16} />
        </Button>

        {editing ? (
          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
            <TextInput
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              size="sm"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <Button size="compact-sm" onClick={handleSave}>
              {t.documentDetail.done}
            </Button>
          </Group>
        ) : (
          <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
            <Text fw={600} size="sm" truncate>
              {value}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setEditing(true)}
              aria-label={t.documentDetail.editName ?? 'Edit name'}
            >
              <Pencil size={14} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      <Box
        style={{
          width: 1,
          height: 14,
          background: 'var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      />

      {/* Right: badges */}
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        {/* Context: school · course */}
        {(school || course) && (
          <>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {[school, course].filter(Boolean).join(' · ')}
            </Text>
            <Box
              style={{
                width: 1,
                height: 14,
                background: 'var(--mantine-color-default-border)',
                flexShrink: 0,
              }}
            />
          </>
        )}
        {/* Document attributes */}
        <Badge variant="light" color={getDocColor(docType)} size="sm">
          {(t.knowledge.docTypeLabel as Record<string, string>)?.[docType] ?? docType}
        </Badge>
        <Tooltip
          label={
            status === 'draft' ? t.documentDetail.clickToPublish : t.documentDetail.clickToUnpublish
          }
          disabled={!onStatusClick}
        >
          <Badge
            variant="light"
            color={statusColor(status)}
            size="sm"
            style={
              onStatusClick
                ? {
                    cursor: 'pointer',
                    textDecoration: 'underline dotted',
                    textUnderlineOffset: 2,
                  }
                : undefined
            }
            onClick={onStatusClick}
          >
            {statusLoading ? '...' : status}
          </Badge>
        </Tooltip>
      </Group>
    </Group>
  );
}
