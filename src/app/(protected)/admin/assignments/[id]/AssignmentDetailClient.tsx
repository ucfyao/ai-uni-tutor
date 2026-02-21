'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Hash,
  Pencil,
  Plus,
  Send,
  Trash2,
  Trophy,
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
  Card,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  deleteAssignment,
  publishAssignment,
  unpublishAssignment,
} from '@/app/actions/assignments';
import { AdminContent } from '@/components/admin/AdminContent';
import { FullScreenModal } from '@/components/FullScreenModal';
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
  const { items, addItem, isAddingItem, updateItem, deleteItem, rename, invalidateItems } =
    useAssignmentItems(assignment.id, initialItems);

  /* -- UI state -- */
  const [showUploadZone, setShowUploadZone] = useState(initialItems.length === 0);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(assignment.title);
  const [isPublishing, setIsPublishing] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  /* -- item handlers (delegate to hook mutations) -- */
  const handleSaveItem = useCallback(
    async (itemId: string, content: string, metadata: Record<string, unknown>) => {
      await updateItem({ itemId, content, metadata });
    },
    [updateItem],
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      await deleteItem(itemId);
    },
    [deleteItem],
  );

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
          parentItemId: (data.parentItemId as string) || null,
          orderNum: data.orderNum as number | undefined,
          title: (data.title as string) || '',
        });
        setDefaultParentId(null);
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
        {/* Group 1: Content creation (high frequency) */}
        <Tooltip label={t.documentDetail.addManually}>
          <ActionIcon variant="default" color="gray" size="md" onClick={() => setAddFormOpen(true)}>
            <Plus size={16} />
          </ActionIcon>
        </Tooltip>
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

        {/* Group 2: Publish */}
        {(assignment.status === 'draft' || assignment.status === 'ready') && (
          <>
            <Divider orientation="vertical" size="xs" h={20} style={{ alignSelf: 'center' }} />
            {assignment.status === 'draft' && (
              <Tooltip
                label={
                  items.length === 0 ? t.knowledge.publishDisabledTooltip : t.documentDetail.publish
                }
              >
                <span style={{ display: 'inline-flex' }}>
                  <ActionIcon
                    variant="light"
                    color="green"
                    size="md"
                    loading={isPublishing}
                    disabled={items.length === 0}
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

        {/* Group 3: Destructive */}
        <Divider orientation="vertical" size="xs" h={20} style={{ alignSelf: 'center' }} />
        <Tooltip label={t.documentDetail.deleteDocument}>
          <ActionIcon
            variant="subtle"
            color="red"
            size="md"
            onClick={() =>
              modals.openConfirmModal({
                title: t.documentDetail.deleteDocument,
                children: <Text size="sm">{t.documentDetail.deleteDocConfirm}</Text>,
                labels: { confirm: t.common.delete, cancel: t.common.cancel },
                confirmProps: { color: 'red' },
                onConfirm: handleDeleteDoc,
              })
            }
          >
            <Trash2 size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [
      showUploadZone,
      assignment.status,
      items.length,
      isPublishing,
      handlePublish,
      handleUnpublish,
      handleDeleteDoc,
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

          <Box
            style={{
              width: 1,
              height: 14,
              background: 'var(--mantine-color-default-border)',
              flexShrink: 0,
            }}
          />

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
            <Badge variant="light" color="indigo" size="sm">
              {(t.knowledge.docTypeLabel as Record<string, string>)?.assignment ?? 'Assignment'}
            </Badge>
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
        <AdminContent gap="md">
          {/* Upload zone (shown by default when empty, toggled via header) */}
          {showUploadZone && (
            <PdfUploadZone
              documentId={assignment.id}
              docType="assignment"
              existingItemCount={items.length}
              courseId={courseId || undefined}
              onParseComplete={() => {
                invalidateItems();
                router.refresh();
                setShowUploadZone(false);
              }}
            />
          )}

          {/* Metadata info bar */}
          {assignment.metadata && Object.values(assignment.metadata).some(Boolean) && (
            <Card withBorder radius="lg" p="md">
              <Group gap="sm" mb={assignment.metadata.instructions ? 'xs' : 0}>
                {assignment.metadata.totalPoints != null && (
                  <Badge variant="light" color="blue" size="lg" leftSection={<Trophy size={14} />}>
                    {t.documentDetail.totalPoints}: {assignment.metadata.totalPoints}
                  </Badge>
                )}
                {assignment.metadata.totalQuestions != null && (
                  <Badge variant="light" color="blue" size="lg" leftSection={<Hash size={14} />}>
                    {t.documentDetail.totalQuestions}: {assignment.metadata.totalQuestions}
                  </Badge>
                )}
                {assignment.metadata.duration && (
                  <Badge variant="light" color="blue" size="lg" leftSection={<Clock size={14} />}>
                    {t.documentDetail.metaDuration}: {assignment.metadata.duration}
                  </Badge>
                )}
                {assignment.metadata.examDate && (
                  <Badge
                    variant="light"
                    color="gray"
                    size="lg"
                    leftSection={<Calendar size={14} />}
                  >
                    {t.documentDetail.examDate}: {assignment.metadata.examDate}
                  </Badge>
                )}
              </Group>
              {assignment.metadata.instructions && (
                <Text size="sm" c="dimmed">
                  {t.documentDetail.instructions}: {assignment.metadata.instructions}
                </Text>
              )}
            </Card>
          )}

          {/* Assignment outline view */}
          <AssignmentOutlineView
            items={items}
            onSaveItem={handleSaveItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            isAddingItem={isAddingItem}
            addFormOpen={addFormOpen}
            onAddFormOpenChange={setAddFormOpen}
            defaultParentId={defaultParentId}
            onDefaultParentIdChange={setDefaultParentId}
          />
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
