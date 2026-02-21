'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  deleteAssignment,
  publishAssignment,
  saveAssignmentChanges,
  unpublishAssignment,
} from '@/app/actions/assignments';
import { AssignmentOutlineView } from '@/components/rag/AssignmentOutlineView';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAssignmentItems } from '@/hooks/useAssignmentItems';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

/* ── helpers ── */

function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'green';
    case 'draft':
      return 'blue';
    default:
      return 'gray';
  }
}

function parseAnswerText(text: string): Array<{ orderNum: number; answer: string }> {
  const results: Array<{ orderNum: number; answer: string }> = [];
  const pattern = /(?:^|\n)\s*(?:Q|第)?(\d+)[.):\s:、题]+\s*/gi;
  const matches = [...text.matchAll(pattern)];

  for (let i = 0; i < matches.length; i++) {
    const orderNum = parseInt(matches[i][1], 10);
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const answer = text.slice(start, end).trim();
    if (answer) results.push({ orderNum, answer });
  }
  return results;
}

/* ── Component ── */

interface AssignmentDetailClientProps {
  assignment: AssignmentEntity;
  initialItems: AssignmentItemEntity[];
}

export function AssignmentDetailClient({ assignment, initialItems }: AssignmentDetailClientProps) {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const school = assignment.school || '';
  const course = assignment.course || '';
  const courseId = assignment.courseId || '';

  /* -- use hook for data management -- */
  const {
    items,
    addItem,
    isAddingItem,
    rename,
    merge,
    split,
    batchUpdateAnswers: batchAnswers,
    invalidateItems,
  } = useAssignmentItems(assignment.id, initialItems);

  /* -- editing state -- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [showUploadZone, setShowUploadZone] = useState(initialItems.length === 0);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [answerModalOpen, setAnswerModalOpen] = useState(false);
  const [answerText, setAnswerText] = useState('');

  /* -- inline name editing -- */
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(assignment.title);

  /* -- derived -- */
  const visibleItems = useMemo(
    () => items.filter((item) => !deletedChunkIds.has(item.id)),
    [items, deletedChunkIds],
  );
  const pendingChanges = editedChunks.size + deletedChunkIds.size;

  const parsedAnswers = useMemo(() => {
    if (!answerText.trim()) return [];
    const parsed = parseAnswerText(answerText);
    return parsed.map((p) => {
      const item = items.find((i) => i.orderNum === p.orderNum);
      return { ...p, itemId: item?.id ?? null, matched: !!item };
    });
  }, [answerText, items]);

  /* -- editing handlers -- */
  const handleSaveEdit = useCallback(
    (chunkId: string, content: string, metadata: Record<string, unknown>) => {
      setEditedChunks((prev) => {
        const next = new Map(prev);
        next.set(chunkId, { content, metadata });
        return next;
      });
      setEditingChunkId(null);
    },
    [],
  );

  const handleDelete = useCallback(
    (chunkId: string) => {
      setDeletedChunkIds((prev) => {
        const next = new Set(prev);
        next.add(chunkId);
        return next;
      });
      if (editingChunkId === chunkId) setEditingChunkId(null);
    },
    [editingChunkId],
  );

  const handleToggleSelect = useCallback((chunkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === visibleItems.length) return new Set();
      return new Set(visibleItems.map((item) => item.id));
    });
  }, [visibleItems]);

  const handleBulkDelete = useCallback(() => {
    setDeletedChunkIds((prev) => {
      const next = new Set(prev);
      for (const id of selectedIds) next.add(id);
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkSetDifficulty = useCallback(
    (difficulty: string) => {
      setEditedChunks((prev) => {
        const next = new Map(prev);
        for (const id of selectedIds) {
          const existing = next.get(id);
          const item = items.find((i) => i.id === id);
          if (item) {
            const currentContent = existing?.content ?? item.content;
            const currentMeta = existing?.metadata ?? item.metadata ?? {};
            next.set(id, {
              content: currentContent,
              metadata: { ...currentMeta, difficulty },
            });
          }
        }
        return next;
      });
    },
    [selectedIds, items],
  );

  const handleBulkSetPoints = useCallback(
    (points: number) => {
      setEditedChunks((prev) => {
        const next = new Map(prev);
        for (const id of selectedIds) {
          const existing = next.get(id);
          const item = items.find((i) => i.id === id);
          if (item) {
            const currentContent = existing?.content ?? item.content;
            const currentMeta = existing?.metadata ?? item.metadata ?? {};
            next.set(id, {
              content: currentContent,
              metadata: { ...currentMeta, points },
            });
          }
        }
        return next;
      });
    },
    [selectedIds, items],
  );

  /* -- merge / split handlers -- */
  const handleMerge = useCallback(async () => {
    if (selectedIds.size < 2) return;
    await merge(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, merge]);

  const handleSplit = useCallback(
    async (itemId: string, splitContent: [string, string]) => {
      await split({ itemId, splitContent });
      setEditingChunkId(null);
    },
    [split],
  );

  /* -- batch answer matching handler -- */
  const handleApplyAnswers = useCallback(async () => {
    const matched = parsedAnswers.filter(
      (p): p is typeof p & { itemId: string } => p.itemId !== null,
    );
    if (matched.length === 0) return;
    await batchAnswers(matched.map((m) => ({ itemId: m.itemId, referenceAnswer: m.answer })));
    setAnswerModalOpen(false);
    setAnswerText('');
  }, [parsedAnswers, batchAnswers]);

  /* -- save changes handler -- */
  const handleSaveChanges = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
        id,
        content: data.content,
        metadata: data.metadata,
      }));
      const deletedArr = Array.from(deletedChunkIds);

      const result = await saveAssignmentChanges(assignment.id, updates, deletedArr);
      if (result.success) {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
          autoClose: 3000,
        });
        setEditedChunks(new Map());
        setDeletedChunkIds(new Set());
        setSelectedIds(new Set());
        invalidateItems();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } catch {
      showNotification({
        title: t.common.error,
        message: t.documentDetail.failedToSave,
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [assignment.id, editedChunks, deletedChunkIds, invalidateItems, t]);

  /* -- add item handler -- */
  const handleAddItem = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      try {
        await addItem({
          type: (data.type as string) || '',
          content: (data.content as string) || '',
          referenceAnswer: (data.referenceAnswer as string) || '',
          explanation: (data.explanation as string) || '',
          points: (data.points as number) || 0,
          difficulty: (data.difficulty as string) || '',
        });
        return true;
      } catch {
        return false;
      }
    },
    [addItem],
  );

  /* -- publish / unpublish / delete handlers -- */
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const result = await publishAssignment(assignment.id);
      if (result.success) {
        showNotification({ message: t.documentDetail.publish, color: 'green' });
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } finally {
      setIsPublishing(false);
    }
  }, [assignment.id, router, t]);

  const handleUnpublish = useCallback(async () => {
    const result = await unpublishAssignment(assignment.id);
    if (result.success) {
      showNotification({ message: t.documentDetail.unpublish, color: 'green' });
      router.refresh();
    } else {
      showNotification({ title: t.common.error, message: result.error, color: 'red' });
    }
  }, [assignment.id, router, t]);

  const handleDeleteDoc = useCallback(async () => {
    try {
      const result = await deleteAssignment(assignment.id);
      if (result.success) {
        for (const dt of DOC_TYPES) {
          queryClient.setQueryData<KnowledgeDocument[]>(
            queryKeys.documents.byType(dt.value),
            (prev) => prev?.filter((d) => d.id !== assignment.id),
          );
        }
        showNotification({ message: t.knowledge.deleted, color: 'green' });
        router.push('/admin/knowledge');
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } catch {
      showNotification({
        title: t.common.error,
        message: t.knowledge.failedToDelete,
        color: 'red',
      });
    }
  }, [assignment.id, queryClient, router, t]);

  /* -- rename handler -- */
  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== assignment.title) {
      await rename(trimmed);
    }
    setEditingName(false);
  }, [nameValue, assignment.title, rename]);

  /* -- header action buttons (right side) -- */
  const headerActions = useMemo(
    () => (
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        {/* ── Group 1: Content creation ── */}
        <Tooltip label={t.documentDetail.uploadPdf}>
          <ActionIcon
            variant={showUploadZone ? 'filled' : 'default'}
            color={showUploadZone ? 'indigo' : 'gray'}
            size="md"
            onClick={() => setShowUploadZone((v) => !v)}
          >
            <Upload size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t.documentDetail.addManually}>
          <ActionIcon variant="default" color="gray" size="md" onClick={() => setAddFormOpen(true)}>
            <Plus size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t.knowledge.batchAnswers}>
          <ActionIcon
            variant="default"
            color="gray"
            size="md"
            onClick={() => setAnswerModalOpen(true)}
          >
            <ListChecks size={16} />
          </ActionIcon>
        </Tooltip>

        {/* ── Group 2: Save / Publish ── */}
        {(pendingChanges > 0 || assignment.status === 'draft' || assignment.status === 'ready') && (
          <>
            <Divider orientation="vertical" size="xs" h={20} style={{ alignSelf: 'center' }} />
            {pendingChanges > 0 && (
              <Tooltip label={`${t.documentDetail.saveChanges} (${pendingChanges})`}>
                <ActionIcon
                  variant="filled"
                  color="indigo"
                  size="md"
                  loading={isSaving}
                  onClick={handleSaveChanges}
                >
                  <Save size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {assignment.status === 'draft' && (
              <Tooltip
                label={
                  visibleItems.length === 0
                    ? t.knowledge.publishDisabledTooltip
                    : t.documentDetail.publish
                }
              >
                <span style={{ display: 'inline-flex' }}>
                  <ActionIcon
                    variant="light"
                    color="green"
                    size="md"
                    loading={isPublishing}
                    disabled={visibleItems.length === 0}
                    onClick={handlePublish}
                  >
                    <Send size={16} />
                  </ActionIcon>
                </span>
              </Tooltip>
            )}
            {assignment.status === 'ready' && (
              <Tooltip label={t.documentDetail.unpublish}>
                <ActionIcon variant="light" color="yellow" size="md" onClick={handleUnpublish}>
                  <Send size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </>
        )}

        {/* ── Group 3: Destructive ── */}
        <Divider orientation="vertical" size="xs" h={20} style={{ alignSelf: 'center' }} />
        <Tooltip label={t.documentDetail.deleteDocument}>
          <ActionIcon
            variant="subtle"
            color="red"
            size="md"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [
      showUploadZone,
      pendingChanges,
      isSaving,
      handleSaveChanges,
      assignment.status,
      visibleItems.length,
      isPublishing,
      handlePublish,
      handleUnpublish,
      t,
    ],
  );

  /* -- header: left = info, right = actions -- */
  const headerNode = useMemo(
    () => (
      <Group justify="space-between" align="center" wrap="nowrap" w="100%">
        {/* Left: back + name + badges */}
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
                {nameValue}
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setEditingName(true)}
              >
                <Pencil size={14} />
              </ActionIcon>
            </Group>
          )}

          <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Badge variant="light" color="indigo" size="sm">
              {(t.knowledge.docTypeLabel as Record<string, string>)?.assignment ?? 'Assignment'}
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
            <Badge variant="light" color={statusColor(assignment.status)} size="sm">
              {assignment.status}
            </Badge>
          </Group>
        </Group>

        {/* Right: actions */}
        {headerActions}
      </Group>
    ),
    [editingName, nameValue, handleSaveName, school, course, assignment.status, headerActions, t],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
        <Stack gap="md" p="lg" maw={900} mx="auto">
          {/* Upload zone (shown by default when empty, toggled via header) */}
          {showUploadZone && (
            <PdfUploadZone
              documentId={assignment.id}
              docType="assignment"
              existingItemCount={visibleItems.length}
              courseId={courseId || undefined}
              onParseComplete={() => {
                invalidateItems();
                router.refresh();
                setShowUploadZone(false);
              }}
            />
          )}

          {/* Assignment outline view */}
          <AssignmentOutlineView
            items={visibleItems}
            selectedIds={selectedIds}
            editedItems={editedChunks}
            deletedItemIds={deletedChunkIds}
            editingItemId={editingChunkId}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onStartEdit={(id) => setEditingChunkId(id)}
            onCancelEdit={() => setEditingChunkId(null)}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onBulkSetDifficulty={handleBulkSetDifficulty}
            onBulkSetPoints={handleBulkSetPoints}
            onAddItem={handleAddItem}
            isAddingItem={isAddingItem}
            addFormOpen={addFormOpen}
            onAddFormOpenChange={setAddFormOpen}
            onMerge={handleMerge}
            onSplit={handleSplit}
          />
        </Stack>
      </ScrollArea>

      {/* Delete confirmation modal */}
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
              background: 'light-dark(var(--mantine-color-red-0), var(--mantine-color-red-9))',
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
              handleDeleteDoc();
            }}
            radius="md"
          >
            {t.common.delete}
          </Button>
        </Group>
      </Modal>

      {/* Batch answer matching modal */}
      <Modal
        opened={answerModalOpen}
        onClose={() => setAnswerModalOpen(false)}
        title={t.knowledge.batchAnswers}
        centered
        size="lg"
        radius="lg"
      >
        <Stack gap="md">
          <Textarea
            placeholder={t.knowledge.pasteAnswersHere}
            minRows={6}
            maxRows={12}
            autosize
            value={answerText}
            onChange={(e) => setAnswerText(e.currentTarget.value)}
          />
          {parsedAnswers.length > 0 && (
            <>
              <Text fz="sm" fw={600}>
                {t.knowledge.matchPreview}
              </Text>
              <Stack gap={4}>
                {parsedAnswers.map((p, i) => (
                  <Group key={i} gap="xs" wrap="nowrap">
                    <Badge
                      variant="light"
                      color={p.matched ? 'green' : 'red'}
                      size="sm"
                      style={{ flexShrink: 0 }}
                    >
                      Q{p.orderNum}
                    </Badge>
                    <Text fz="xs" truncate style={{ flex: 1 }}>
                      {p.answer.slice(0, 100)}
                      {p.answer.length > 100 ? '…' : ''}
                    </Text>
                    {!p.matched && (
                      <Badge variant="light" color="red" size="xs" style={{ flexShrink: 0 }}>
                        {t.knowledge.unmatched}
                      </Badge>
                    )}
                  </Group>
                ))}
              </Stack>
            </>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setAnswerModalOpen(false)} radius="md">
              {t.common.cancel}
            </Button>
            <Button
              color="indigo"
              radius="md"
              disabled={parsedAnswers.filter((p) => p.matched).length === 0}
              onClick={handleApplyAnswers}
            >
              {t.knowledge.applyMatches} ({parsedAnswers.filter((p) => p.matched).length})
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
