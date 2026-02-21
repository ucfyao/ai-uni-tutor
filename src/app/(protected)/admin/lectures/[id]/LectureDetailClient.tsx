'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Check, Lightbulb, Pencil, Plus, Upload } from 'lucide-react';
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
import {
  addDocumentChunk,
  deleteDocument,
  publishDocument,
  unpublishDocument,
  updateDocumentChunks,
  updateDocumentMeta,
} from '@/app/actions/documents';
import { DocumentOutlineView, type SectionEditData } from '@/components/rag/DocumentOutlineView';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentStatus } from '@/lib/domain/models/Document';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { DocumentOutline } from '@/lib/rag/parsers/types';
import type { Json } from '@/types/database';

interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

function metaStr(meta: Json, key: string): string {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    return typeof val === 'string' ? val : '';
  }
  return '';
}

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
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const outline = doc.outline ? (doc.outline as unknown as DocumentOutline) : null;

  const totalKPs = useMemo(() => {
    let count = 0;
    for (const chunk of chunks) {
      const m = chunk.metadata as Record<string, unknown> | null;
      if (m && Array.isArray(m.knowledgePoints)) count += m.knowledgePoints.length;
    }
    return count;
  }, [chunks]);

  // ── Helpers ──

  const getMeta = useCallback((chunk: Chunk): Record<string, unknown> => {
    if (chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)) {
      return chunk.metadata as Record<string, unknown>;
    }
    return {};
  }, []);

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

  const handleAddSection = useCallback(
    async (title: string, content: string, summary: string) => {
      const result = await addDocumentChunk({
        documentId: doc.id,
        title,
        content,
        summary,
      });
      if (result.success) {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
        });
        setAddSectionOpen(false);
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
        throw new Error(result.error);
      }
    },
    [doc.id, router, t],
  );

  const handleSaveSection = useCallback(
    async (chunkId: string, data: SectionEditData) => {
      const chunk = chunks.find((c) => c.id === chunkId);
      if (!chunk) return;
      const existingMeta = getMeta(chunk);
      const metadata: Record<string, unknown> = {
        ...existingMeta,
        title: data.title,
        summary: data.summary,
        knowledgePoints: data.knowledgePoints,
      };
      const fullContent = [`## ${data.title}`, data.summary, '', data.content].join('\n');
      const result = await updateDocumentChunks(
        doc.id,
        [{ id: chunkId, content: fullContent, metadata }],
        [],
      );
      if (result.status === 'success') {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
        });
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.message, color: 'red' });
        throw new Error(result.message);
      }
    },
    [chunks, getMeta, doc.id, router, t],
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

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

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
              <Box
                style={{
                  width: 1,
                  height: 14,
                  background: 'var(--mantine-color-default-border)',
                  flexShrink: 0,
                }}
              />
              <Tooltip label={`${chunks.length} sections`} withArrow>
                <Group gap={4} wrap="nowrap" style={{ flexShrink: 0, cursor: 'default' }}>
                  <BookOpen size={12} color="var(--mantine-color-indigo-5)" />
                  <Text size="xs" c="dimmed">
                    {chunks.length}
                  </Text>
                </Group>
              </Tooltip>
              {totalKPs > 0 && (
                <Tooltip label={`${totalKPs} knowledge points`} withArrow>
                  <Group gap={4} wrap="nowrap" style={{ flexShrink: 0, cursor: 'default' }}>
                    <Lightbulb size={12} color="var(--mantine-color-yellow-6)" />
                    <Text size="xs" c="dimmed">
                      {totalKPs}
                    </Text>
                  </Group>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>

        {/* Right: actions + status */}
        <Group gap={12} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Add Section">
              <ActionIcon
                variant="subtle"
                color="indigo"
                size="md"
                onClick={() => setAddSectionOpen(true)}
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
      totalKPs,
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

          {/* Content: section list */}
          <DocumentOutlineView
            outline={outline}
            chunks={chunks}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleToggleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkDelete={handleBulkDelete}
            onDelete={handleDelete}
            onSaveSection={handleSaveSection}
            addSectionOpen={addSectionOpen}
            onToggleAddSection={() => setAddSectionOpen((v) => !v)}
            onAddSection={handleAddSection}
          />
        </Stack>
      </ScrollArea>
    </Box>
  );
}
