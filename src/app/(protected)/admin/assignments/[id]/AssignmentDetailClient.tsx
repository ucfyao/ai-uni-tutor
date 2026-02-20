'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ScrollArea, Stack } from '@mantine/core';
import { addAssignmentItem } from '@/app/actions/assignments';
import { useIsMobile } from '@/hooks/use-mobile';
import { deleteDocument, publishDocument, unpublishDocument } from '@/app/actions/documents';
import { AssignmentUploadArea } from '@/components/rag/AssignmentUploadArea';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import { ChunkActionBar } from '../../knowledge/[id]/ChunkActionBar';
import { ChunkTable } from '../../knowledge/[id]/ChunkTable';
import { DocumentDetailHeader } from '../../knowledge/[id]/DocumentDetailHeader';
import type { Chunk, DocType } from '../../knowledge/[id]/types';

interface AssignmentDetailClientProps {
  assignment: AssignmentEntity;
  items: AssignmentItemEntity[];
}

export function AssignmentDetailClient({ assignment, items }: AssignmentDetailClientProps) {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const docType: DocType = 'assignment';
  const school = assignment.school || '';
  const course = assignment.course || '';
  const courseId = assignment.courseId || '';

  /* -- chunk editing state -- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPublishing, setIsPublishing] = useState(false);

  /* -- convert items to Chunk format -- */
  const chunks: Chunk[] = items.map((item) => ({
    id: item.id,
    content: item.content,
    metadata: {
      type: 'question',
      questionNumber: String(item.orderNum),
      content: item.content,
      referenceAnswer: item.referenceAnswer,
      explanation: item.explanation,
      points: item.points,
      difficulty: item.difficulty,
      itemType: item.type,
    },
    embedding: null,
  }));

  /* -- derived -- */
  const visibleChunks = chunks.filter((c) => !deletedChunkIds.has(c.id));
  const pendingChanges = editedChunks.size + deletedChunkIds.size;

  /* -- chunk helpers -- */
  const getEffectiveMetadata = useCallback(
    (chunk: Chunk): Record<string, unknown> => {
      const edited = editedChunks.get(chunk.id);
      if (edited) return edited.metadata;
      if (chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)) {
        return chunk.metadata as Record<string, unknown>;
      }
      return {};
    },
    [editedChunks],
  );

  const getEffectiveContent = useCallback(
    (chunk: Chunk): string => {
      const edited = editedChunks.get(chunk.id);
      return edited ? edited.content : chunk.content;
    },
    [editedChunks],
  );

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

  const handleToggleAnswer = useCallback((chunkId: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

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
      if (prev.size === visibleChunks.length) return new Set();
      return new Set(visibleChunks.map((c) => c.id));
    });
  }, [visibleChunks]);

  const handleBulkDelete = useCallback(() => {
    setDeletedChunkIds((prev) => {
      const next = new Set(prev);
      for (const id of selectedIds) next.add(id);
      return next;
    });
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleSaved = useCallback(() => {
    setEditedChunks(new Map());
    setDeletedChunkIds(new Set());
    setSelectedIds(new Set());
  }, []);

  /* -- add item handler -- */
  const handleAddItem = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const result = await addAssignmentItem({
        assignmentId: assignment.id,
        type: (data.type as string) || '',
        content: (data.content as string) || '',
        referenceAnswer: (data.referenceAnswer as string) || '',
        explanation: (data.explanation as string) || '',
        points: (data.points as number) || 0,
        difficulty: (data.difficulty as string) || '',
      });
      if (result.success) {
        showNotification({ message: t.documentDetail.saved, color: 'green' });
        router.refresh();
        return true;
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
        return false;
      }
    },
    [assignment.id, router, t],
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
        onSaveName={async () => {
          // Assignment title rename not yet supported
        }}
      />
    ),
    [assignment.id, assignment.title, school, course, assignment.status],
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
          {/* Collapsible upload area */}
          <AssignmentUploadArea
            assignmentId={assignment.id}
            universityId={null}
            courseId={courseId || null}
            school={school}
            course={course}
            itemCount={visibleChunks.length}
            onParseComplete={() => router.refresh()}
          />
          <ChunkTable
            chunks={visibleChunks}
            docType={docType}
            editingChunkId={editingChunkId}
            expandedAnswers={expandedAnswers}
            selectedIds={selectedIds}
            getEffectiveContent={getEffectiveContent}
            getEffectiveMetadata={getEffectiveMetadata}
            onStartEdit={(chunk) => setEditingChunkId(chunk.id)}
            onCancelEdit={() => setEditingChunkId(null)}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            onToggleAnswer={handleToggleAnswer}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onBulkDelete={handleBulkDelete}
            onAddItem={handleAddItem}
          />
          <ChunkActionBar
            docId={assignment.id}
            docType={docType}
            pendingChanges={pendingChanges}
            editedChunks={editedChunks}
            deletedChunkIds={deletedChunkIds}
            onSaved={handleSaved}
            status={assignment.status}
            itemCount={visibleChunks.length}
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
