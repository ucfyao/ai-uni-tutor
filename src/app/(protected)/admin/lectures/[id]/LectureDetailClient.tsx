'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Pencil, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  addDocumentChunk,
  deleteDocument,
  publishDocument,
  unpublishDocument,
  updateDocumentChunks,
  updateDocumentMeta,
} from '@/app/actions/documents';
import { FullScreenModal } from '@/components/FullScreenModal';
import { DocumentOutlineView } from '@/components/rag/DocumentOutlineView';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentStatus } from '@/lib/domain/models/Document';
import type { DocumentOutline } from '@/lib/rag/parsers/types';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { Json } from '@/types/database';
import { ChunkEditForm } from '../../knowledge/[id]/ChunkEditForm';
import type { Chunk } from '../../knowledge/[id]/types';
import { metaStr } from '../../knowledge/[id]/types';

interface SerializedLectureDocument {
  id: string;
  userId: string;
  name: string;
  status: DocumentStatus;
  metadata: Json;
  courseId: string | null;
  outline: Json | null;
  createdAt: string;
}

interface LectureDetailClientProps {
  document: SerializedLectureDocument;
  chunks: Chunk[];
}

export function LectureDetailClient({ document: doc, chunks }: LectureDetailClientProps) {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>(doc.status);
  const [currentName, setCurrentName] = useState(doc.name);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(doc.name);
  const [isPublishing, setIsPublishing] = useState(false);

  const school = metaStr(doc.metadata, 'school');
  const course = metaStr(doc.metadata, 'course');

  const [showUpload, setShowUpload] = useState(chunks.length === 0);
  const [editingChunk, setEditingChunk] = useState<Chunk | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedAnswers] = useState<Set<string>>(new Set());
  const hasOutline = doc.outline !== null;

  // ── Helpers ──

  const getMeta = useCallback((chunk: Chunk): Record<string, unknown> => {
    if (chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)) {
      return chunk.metadata as Record<string, unknown>;
    }
    return {};
  }, []);

  const getContent = useCallback((chunk: Chunk): string => chunk.content, []);

  // ── Name editing ──

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== currentName) {
      const result = await updateDocumentMeta(doc.id, { name: trimmed });
      if (result.status === 'success') setCurrentName(trimmed);
    }
    setEditingName(false);
  }, [doc.id, nameValue, currentName]);

  // ── CRUD ──

  const handleEditSave = useCallback(
    async (chunkId: string, content: string, metadata: Record<string, unknown>) => {
      try {
        const result = await updateDocumentChunks(doc.id, [{ id: chunkId, content, metadata }], []);
        if (result.status === 'success') {
          showNotification({
            message: t.toast.changesSaved,
            color: 'green',
            icon: <Check size={16} />,
          });
          setEditingChunk(null);
          router.refresh();
        } else {
          showNotification({ title: t.common.error, message: result.message, color: 'red' });
        }
      } catch {
        showNotification({
          title: t.common.error,
          message: t.documentDetail.failedToSave,
          color: 'red',
        });
      }
    },
    [doc.id, router, t],
  );

  const handleDelete = useCallback(
    (chunkId: string) => {
      modals.openConfirmModal({
        title: t.knowledge.deleteConfirm,
        children: <Text size="sm">{t.knowledge.deleteDocConfirm}</Text>,
        labels: { confirm: t.documentDetail.deleteChunk, cancel: t.documentDetail.cancel },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            const result = await updateDocumentChunks(doc.id, [], [chunkId]);
            if (result.status === 'success') {
              showNotification({
                message: t.toast.deletedSuccessfully,
                color: 'green',
                icon: <Check size={16} />,
              });
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(chunkId);
                return next;
              });
              router.refresh();
            } else {
              showNotification({ title: t.common.error, message: result.message, color: 'red' });
            }
          } catch {
            showNotification({
              title: t.common.error,
              message: t.documentDetail.failedToSave,
              color: 'red',
            });
          }
        },
      });
    },
    [doc.id, router, t],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    modals.openConfirmModal({
      title: t.knowledge.deleteConfirm,
      children: (
        <Text size="sm">
          {selectedIds.size} {t.documentDetail.knowledgePoints}
        </Text>
      ),
      labels: { confirm: t.documentDetail.deleteChunk, cancel: t.documentDetail.cancel },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const ids = Array.from(selectedIds);
          const result = await updateDocumentChunks(doc.id, [], ids);
          if (result.status === 'success') {
            showNotification({
              message: t.toast.deletedSuccessfully,
              color: 'green',
              icon: <Check size={16} />,
            });
            setSelectedIds(new Set());
            router.refresh();
          } else {
            showNotification({ title: t.common.error, message: result.message, color: 'red' });
          }
        } catch {
          showNotification({
            title: t.common.error,
            message: t.documentDetail.failedToSave,
            color: 'red',
          });
        }
      },
    });
  }, [doc.id, selectedIds, router, t]);

  const handleAddItem = useCallback(
    async (_chunkId: string, content: string, metadata: Record<string, unknown>) => {
      const title = (metadata.title as string) || '';
      const definition = (metadata.definition as string) || content;
      const keyFormulas = Array.isArray(metadata.keyFormulas)
        ? (metadata.keyFormulas as string[]).filter(Boolean)
        : undefined;
      const keyConcepts = Array.isArray(metadata.keyConcepts)
        ? (metadata.keyConcepts as string[]).filter(Boolean)
        : undefined;
      const examples = Array.isArray(metadata.examples)
        ? (metadata.examples as string[]).filter(Boolean)
        : undefined;
      const result = await addDocumentChunk({
        documentId: doc.id,
        title,
        definition,
        keyFormulas,
        keyConcepts,
        examples,
      });
      if (result.success) {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
        });
        setShowAddForm(false);
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    },
    [doc.id, router, t],
  );

  // ── Selection ──

  const handleToggleSelect = useCallback((chunkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === chunks.length ? new Set() : new Set(chunks.map((c) => c.id)),
    );
  }, [chunks]);

  // ── Publish / Unpublish ──

  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await publishDocument(doc.id, 'lecture');
      setCurrentStatus('ready');
      showNotification({ message: t.toast.published, color: 'green', icon: <Check size={16} /> });
    } catch (e) {
      showNotification({
        title: t.common.error,
        message: e instanceof Error ? e.message : 'Failed',
        color: 'red',
      });
    } finally {
      setIsPublishing(false);
    }
  }, [doc.id, t]);

  const handleUnpublish = useCallback(async () => {
    try {
      await unpublishDocument(doc.id, 'lecture');
      setCurrentStatus('draft');
      showNotification({ message: t.toast.unpublished, color: 'blue', icon: <Check size={16} /> });
    } catch (e) {
      showNotification({
        title: t.common.error,
        message: e instanceof Error ? e.message : 'Failed',
        color: 'red',
      });
    }
  }, [doc.id, t]);

  const handleDeleteDoc = useCallback(async () => {
    modals.openConfirmModal({
      title: t.knowledge.deleteConfirm,
      children: <Text size="sm">{t.knowledge.deleteDocConfirm}</Text>,
      labels: { confirm: t.documentDetail.deleteChunk, cancel: t.documentDetail.cancel },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteDocument(doc.id, 'lecture');
          for (const dt of DOC_TYPES) {
            queryClient.setQueryData<KnowledgeDocument[]>(
              queryKeys.documents.byType(dt.value),
              (prev) => prev?.filter((d) => d.id !== doc.id),
            );
          }
          router.push('/admin/knowledge');
        } catch (e) {
          showNotification({
            title: t.common.error,
            message: e instanceof Error ? e.message : t.knowledge.failedToDelete,
            color: 'red',
          });
        }
      },
    });
  }, [doc.id, queryClient, router, t]);

  const handleParseComplete = useCallback(() => {
    router.refresh();
  }, [router]);

  // ── Header ──

  const canPublish = chunks.length > 0;
  const publishAction =
    canPublish && currentStatus === 'draft'
      ? handlePublish
      : canPublish && currentStatus === 'ready'
        ? handleUnpublish
        : undefined;

  const headerNode = useMemo(
    () => (
      <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
        {/* Left: back + name */}
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
          <Button
            component={Link}
            href="/admin/knowledge"
            variant="subtle"
            color="gray"
            size="compact-sm"
            px={4}
          >
            <ArrowLeft size={16} />
          </Button>
          {editingName ? (
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
              <TextInput
                value={nameValue}
                onChange={(e) => setNameValue(e.currentTarget.value)}
                size="sm"
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                autoFocus
              />
              <Button size="compact-sm" onClick={handleSaveName}>
                {t.documentDetail.done}
              </Button>
            </Group>
          ) : (
            <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
              <Text fw={600} size="sm" truncate>
                {currentName}
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => {
                  setNameValue(currentName);
                  setEditingName(true);
                }}
                aria-label={t.documentDetail.editName}
              >
                <Pencil size={14} />
              </ActionIcon>
              {school && (
                <Badge variant="light" color="gray" size="xs">
                  {school}
                </Badge>
              )}
              {course && (
                <Badge variant="light" color="gray" size="xs">
                  {course}
                </Badge>
              )}
              <Badge variant="light" color="gray" size="xs">
                {(t.knowledge.docTypeLabel as Record<string, string>)?.lecture ?? 'Lecture'}
              </Badge>
              <Badge variant="filled" color="indigo" size="sm">
                {chunks.length} {t.documentDetail.knowledgePoints}
              </Badge>
            </Group>
          )}
        </Group>

        {/* Right: actions + status */}
        <Group gap={12} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Group gap={4} wrap="nowrap">
            <Tooltip label={t.knowledge.addKnowledgePoint}>
              <ActionIcon
                variant="subtle"
                color="indigo"
                size="md"
                onClick={() => setShowAddForm(true)}
              >
                <Plus size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t.knowledge.upload}>
              <ActionIcon
                variant={showUpload ? 'filled' : 'subtle'}
                color="indigo"
                size="md"
                onClick={() => setShowUpload((v) => !v)}
              >
                <Upload size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Box
            style={{
              width: 1,
              height: 20,
              background: 'var(--mantine-color-default-border)',
              flexShrink: 0,
            }}
          />
          <Tooltip label={currentStatus === 'ready' ? t.knowledge.unpublish : t.knowledge.publish}>
            <Box>
              <Switch
                checked={currentStatus === 'ready'}
                onChange={() => publishAction?.()}
                disabled={!canPublish || isPublishing}
                size="xs"
                color="indigo"
              />
            </Box>
          </Tooltip>
        </Group>
      </Group>
    ),
    [
      editingName,
      nameValue,
      currentName,
      currentStatus,
      publishAction,
      isPublishing,
      handleSaveName,
      chunks.length,
      showUpload,
      t,
    ],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  // ── Render ──

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Desktop header */}
      {!isMobile && (
        <Box
          px="md"
          h={52}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--mantine-color-default-border)',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <Stack gap="md" p="lg">
          {/* Upload zone */}
          <Collapse in={showUpload}>
            <PdfUploadZone
              documentId={doc.id}
              docType="lecture"
              existingItemCount={chunks.length}
              courseId={doc.courseId ?? undefined}
              onParseComplete={handleParseComplete}
            />
          </Collapse>

          {/* Content */}
          {hasOutline ? (
            <DocumentOutlineView
              outline={doc.outline as unknown as DocumentOutline}
            />
          ) : chunks.length > 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {chunks.length} chunks (re-upload to generate outline)
            </Text>
          ) : null}
        </Stack>
      </ScrollArea>

      {/* Edit modal */}
      <FullScreenModal
        opened={editingChunk !== null}
        onClose={() => setEditingChunk(null)}
        title={t.documentDetail.editChunk}
      >
        {editingChunk && (
          <ChunkEditForm
            chunk={editingChunk}
            docType="lecture"
            content={editingChunk.content}
            metadata={getMeta(editingChunk)}
            onSave={handleEditSave}
            onCancel={() => setEditingChunk(null)}
          />
        )}
      </FullScreenModal>

      {/* Add modal */}
      <FullScreenModal
        opened={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={t.knowledge.addKnowledgePoint}
      >
        <ChunkEditForm
          chunk={{ id: '', content: '', metadata: {}, embedding: null }}
          docType="lecture"
          content=""
          metadata={{}}
          onSave={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      </FullScreenModal>
    </Box>
  );
}
