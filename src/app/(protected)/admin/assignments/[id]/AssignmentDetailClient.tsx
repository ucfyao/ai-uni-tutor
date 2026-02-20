'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ScrollArea, Stack } from '@mantine/core';
import { deleteDocument, publishDocument, unpublishDocument } from '@/app/actions/documents';
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
import { ChunkActionBar } from '../../knowledge/[id]/ChunkActionBar';
import { DocumentDetailHeader } from '../../knowledge/[id]/DocumentDetailHeader';
import type { DocType } from '../../knowledge/[id]/types';

interface AssignmentDetailClientProps {
  assignment: AssignmentEntity;
  initialItems: AssignmentItemEntity[];
}

export function AssignmentDetailClient({
  assignment,
  initialItems,
}: AssignmentDetailClientProps) {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const docType: DocType = 'assignment';
  const school = assignment.school || '';
  const course = assignment.course || '';
  const courseId = assignment.courseId || '';

  /* -- use hook for data management -- */
  const { items, addItem, rename, invalidateItems } = useAssignmentItems(
    assignment.id,
    initialItems,
  );

  /* -- editing state -- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);

  /* -- derived -- */
  const visibleItems = useMemo(
    () => items.filter((item) => !deletedChunkIds.has(item.id)),
    [items, deletedChunkIds],
  );
  const pendingChanges = editedChunks.size + deletedChunkIds.size;

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

  const handleSaved = useCallback(() => {
    setEditedChunks(new Map());
    setDeletedChunkIds(new Set());
    setSelectedIds(new Set());
    invalidateItems();
  }, [invalidateItems]);

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
      const result = await publishDocument(assignment.id, 'assignment');
      if (result.success) {
        showNotification({ message: 'Published', color: 'green' });
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } finally {
      setIsPublishing(false);
    }
  }, [assignment.id, router, t]);

  const handleUnpublish = useCallback(async () => {
    const result = await unpublishDocument(assignment.id, 'assignment');
    if (result.success) {
      showNotification({ message: 'Unpublished', color: 'green' });
      router.refresh();
    } else {
      showNotification({ title: t.common.error, message: result.error, color: 'red' });
    }
  }, [assignment.id, router, t]);

  const handleDeleteDoc = useCallback(async () => {
    try {
      await deleteDocument(assignment.id, 'assignment');
      for (const dt of DOC_TYPES) {
        queryClient.setQueryData<KnowledgeDocument[]>(
          queryKeys.documents.byType(dt.value),
          (prev) => prev?.filter((d) => d.id !== assignment.id),
        );
      }
      showNotification({ message: 'Deleted', color: 'green' });
      router.push('/admin/knowledge');
    } catch {
      showNotification({ title: t.common.error, message: 'Failed to delete', color: 'red' });
    }
  }, [assignment.id, queryClient, router, t]);

  /* -- rename handler -- */
  const handleSaveName = useCallback(
    async (newName: string) => {
      await rename(newName);
    },
    [rename],
  );

  /* -- header -- */
  const headerNode = useMemo(
    () => (
      <DocumentDetailHeader
        docId={assignment.id}
        initialName={assignment.title}
        docType="assignment"
        school={school}
        course={course}
        status={assignment.status}
        backHref="/admin/knowledge"
        onSaveName={handleSaveName}
      />
    ),
    [assignment.id, assignment.title, assignment.status, school, course, handleSaveName],
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
          {/* Upload zone */}
          <PdfUploadZone
            documentId={assignment.id}
            docType="assignment"
            existingItemCount={visibleItems.length}
            courseId={courseId || undefined}
            onParseComplete={() => {
              invalidateItems();
              router.refresh();
            }}
          />

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
          />

          {/* Action bar */}
          <ChunkActionBar
            docId={assignment.id}
            docType={docType}
            pendingChanges={pendingChanges}
            editedChunks={editedChunks}
            deletedChunkIds={deletedChunkIds}
            onSaved={handleSaved}
            status={assignment.status}
            itemCount={visibleItems.length}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onDelete={handleDeleteDoc}
            isPublishing={isPublishing}
          />
        </Stack>
      </ScrollArea>
    </Box>
  );
}
