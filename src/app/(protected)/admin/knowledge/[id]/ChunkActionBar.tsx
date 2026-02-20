'use client';

import { Check, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Box, Button, Card, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import {
  regenerateEmbeddings,
  updateAssignmentItems,
  updateDocumentChunks,
  updateExamQuestions,
} from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import type { DocType } from './types';

interface ChunkActionBarProps {
  docId: string;
  docType: DocType;
  pendingChanges: number;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedChunkIds: Set<string>;
  onSaved: () => void;
  // Optional props for publish/delete controls
  status?: 'draft' | 'ready';
  itemCount?: number;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDelete?: () => void;
  isPublishing?: boolean;
}

export function ChunkActionBar({
  docId,
  docType,
  pendingChanges,
  editedChunks,
  deletedChunkIds,
  onSaved,
  status,
  itemCount,
  onPublish,
  onUnpublish,
  onDelete,
  isPublishing,
}: ChunkActionBarProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
        id,
        content: data.content,
        metadata: data.metadata,
      }));
      const deletedArr = Array.from(deletedChunkIds);

      let result: { status: string; message: string };
      if (docType === 'exam') {
        result = await updateExamQuestions(docId, updates, deletedArr);
      } else if (docType === 'assignment') {
        result = await updateAssignmentItems(docId, updates, deletedArr);
      } else {
        result = await updateDocumentChunks(docId, updates, deletedArr);
      }

      if (result.status === 'success') {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
          autoClose: 3000,
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
    <>
      <Card
        withBorder
        radius="lg"
        p="md"
        style={{ position: 'sticky', bottom: 0, zIndex: 10 }}
        bg="var(--mantine-color-body)"
      >
        <Group justify="space-between">
          <Group gap="sm">
            {status === 'draft' && onPublish && (
              <Tooltip
                label={itemCount === 0 ? t.knowledge.publishDisabledTooltip : undefined}
                disabled={itemCount !== 0}
              >
                <Button
                  variant="light"
                  color="green"
                  size="compact-sm"
                  leftSection={<Send size={14} />}
                  loading={isPublishing}
                  disabled={itemCount === 0}
                  onClick={onPublish}
                  radius="md"
                >
                  {t.documentDetail.publish}
                </Button>
              </Tooltip>
            )}
            {status === 'ready' && onUnpublish && (
              <Button
                variant="light"
                color="yellow"
                size="compact-sm"
                onClick={onUnpublish}
                radius="md"
              >
                {t.documentDetail.unpublish}
              </Button>
            )}

            {onDelete && (
              <Button
                variant="light"
                color="red"
                size="compact-sm"
                onClick={() => setDeleteModalOpen(true)}
                radius="md"
              >
                <Trash2 size={14} />
              </Button>
            )}

            <Text size="sm" c="dimmed">
              {pendingChanges > 0
                ? `${pendingChanges} ${t.documentDetail.pendingChanges}`
                : t.documentDetail.noChanges}
            </Text>
          </Group>
          <Group gap="sm">
            {docType === 'lecture' && (
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
            )}
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

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={t.documentDetail.deleteDocument}
        centered
        size="sm"
        radius="lg"
      >
        <Stack align="center" gap="md">
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--mantine-color-red-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={22} color="var(--mantine-color-red-5)" />
          </Box>
          <Text fz="sm" ta="center">
            {t.documentDetail.deleteDocConfirm}
          </Text>
        </Stack>
        <Group justify="flex-end" mt="lg" gap="sm">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)} radius="md">
            {t.common.cancel}
          </Button>
          <Button
            color="red"
            onClick={() => {
              setDeleteModalOpen(false);
              onDelete?.();
            }}
            radius="md"
          >
            {t.common.delete}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
