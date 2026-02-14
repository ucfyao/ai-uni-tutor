'use client';

import { RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Group, Text } from '@mantine/core';
import {
  regenerateEmbeddings,
  updateDocumentChunks,
} from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface ChunkActionBarProps {
  docId: string;
  pendingChanges: number;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedChunkIds: Set<string>;
  onSaved: () => void;
}

export function ChunkActionBar({
  docId,
  pendingChanges,
  editedChunks,
  deletedChunkIds,
  onSaved,
}: ChunkActionBarProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
        id,
        content: data.content,
        metadata: data.metadata,
      }));
      const result = await updateDocumentChunks(docId, updates, Array.from(deletedChunkIds));
      if (result.status === 'success') {
        showNotification({
          title: t.documentDetail.saved,
          message: result.message,
          color: 'green',
        });
        onSaved();
      } else {
        showNotification({ title: t.knowledge.error, message: result.message, color: 'red' });
      }
    } catch {
      showNotification({
        title: t.knowledge.error,
        message: t.documentDetail.failedToSave,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateEmbeddings(docId);
      if (result.status === 'success') {
        showNotification({
          title: t.knowledge.success,
          message: result.message,
          color: 'green',
        });
      } else {
        showNotification({ title: t.knowledge.error, message: result.message, color: 'red' });
      }
    } catch {
      showNotification({
        title: t.knowledge.error,
        message: t.documentDetail.failedToRegenerate,
        color: 'red',
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card
      withBorder
      radius="lg"
      p="md"
      style={{ position: 'sticky', bottom: 0, zIndex: 10 }}
      bg="var(--mantine-color-body)"
    >
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {pendingChanges > 0
            ? `${pendingChanges} ${t.documentDetail.pendingChanges}`
            : t.documentDetail.noChanges}
        </Text>
        <Group gap="sm">
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={16} />}
            loading={regenerating}
            disabled={regenerating}
            onClick={handleRegenerate}
            radius="md"
          >
            {t.documentDetail.regenerateEmbeddings}
          </Button>
          <Button
            color="indigo"
            leftSection={<Save size={16} />}
            loading={saving}
            disabled={pendingChanges === 0 || saving}
            onClick={handleSave}
            radius="md"
          >
            {t.documentDetail.saveChanges}
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
