'use client';

import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Text, TextInput } from '@mantine/core';
import { updateDocumentMeta } from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { statusColor } from './types';

interface DocumentDetailHeaderProps {
  docId: string;
  initialName: string;
  docType: string;
  school: string;
  course: string;
  status: string;
  /** Called after name is successfully saved server-side */
  onNameChanged: (newName: string) => void;
}

export function DocumentDetailHeader({
  docId,
  initialName,
  docType,
  school,
  course,
  status,
  onNameChanged,
}: DocumentDetailHeaderProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      const result = await updateDocumentMeta(docId, { name: trimmed });
      if (result.status === 'success') {
        onNameChanged(trimmed);
        showNotification({
          title: t.documentDetail.updated,
          message: t.documentDetail.nameUpdated,
          color: 'green',
        });
      }
    }
    setEditing(false);
  };

  return (
    <Group justify="space-between" align="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
      {/* Left: back + name */}
      <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
        <Button
          component={Link}
          href="/knowledge"
          variant="subtle"
          color="gray"
          size="compact-sm"
          px={4}
          aria-label={t.documentDetail.backToKnowledge}
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
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {/* Right: badges */}
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Badge variant="light" color="indigo" size="sm">
          {docType}
        </Badge>
        {school && (
          <Badge variant="light" color="gray" size="sm">
            {school}
          </Badge>
        )}
        {course && (
          <Badge variant="light" color="gray" size="sm">
            {course}
          </Badge>
        )}
        <Badge variant="light" color={statusColor(status)} size="sm">
          {status}
        </Badge>
      </Group>
    </Group>
  );
}
