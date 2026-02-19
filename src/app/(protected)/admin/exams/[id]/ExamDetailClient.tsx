'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ScrollArea, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  addExamQuestion,
  deleteDocument,
  publishDocument,
  unpublishDocument,
} from '@/app/actions/documents';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { ExamPaper, ExamQuestion } from '@/types/exam';
import { ChunkActionBar } from '../../knowledge/[id]/ChunkActionBar';
import { ChunkTable } from '../../knowledge/[id]/ChunkTable';
import { DocumentDetailHeader } from '../../knowledge/[id]/DocumentDetailHeader';
import type { Chunk, DocType } from '../../knowledge/[id]/types';

interface ExamDetailClientProps {
  paper: ExamPaper;
  questions: ExamQuestion[];
}

export function ExamDetailClient({ paper, questions }: ExamDetailClientProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const docType: DocType = 'exam';
  const school = paper.school || '';
  const course = paper.course || '';
  const courseId = paper.courseId || '';

  /* -- Convert questions to Chunk format for ChunkTable -- */
  const chunks: Chunk[] = useMemo(
    () =>
      questions.map((q) => ({
        id: q.id,
        content: q.content,
        metadata: {
          type: 'question',
          questionNumber: String(q.orderNum),
          options: q.options ? Object.values(q.options) : undefined,
          answer: q.answer,
          referenceAnswer: q.answer,
          score: q.points,
          explanation: q.explanation,
        },
        embedding: null,
      })),
    [questions],
  );

  /* -- chunk editing state -- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* -- publishing state -- */
  const [isPublishing, setIsPublishing] = useState(false);

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

  /* -- publish / unpublish / delete handlers -- */
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const result = await publishDocument(paper.id, 'exam');
      if (result.success) {
        showNotification({ message: t.toast.changesSaved, color: 'green' });
        router.refresh();
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
      }
    } finally {
      setIsPublishing(false);
    }
  }, [paper.id, router, t]);

  const handleUnpublish = useCallback(async () => {
    const result = await unpublishDocument(paper.id, 'exam');
    if (result.success) {
      showNotification({ message: t.toast.changesSaved, color: 'green' });
      router.refresh();
    } else {
      showNotification({ title: t.common.error, message: result.error, color: 'red' });
    }
  }, [paper.id, router, t]);

  const handleDeleteDoc = useCallback(async () => {
    try {
      await deleteDocument(paper.id, 'exam');
      for (const dt of DOC_TYPES) {
        queryClient.setQueryData<KnowledgeDocument[]>(
          queryKeys.documents.byType(dt.value),
          (prev) => prev?.filter((d) => d.id !== paper.id),
        );
      }
      showNotification({ message: t.toast.changesSaved, color: 'green' });
      router.push('/admin/knowledge');
    } catch {
      showNotification({ title: t.common.error, message: 'Failed to delete', color: 'red' });
    }
  }, [paper.id, queryClient, router, t]);

  // Add exam question
  const handleAddItem = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const result = await addExamQuestion({
        paperId: paper.id,
        content: (data.content as string) || '',
        answer: (data.referenceAnswer as string) || '',
        explanation: (data.explanation as string) || '',
        points: (data.points as number) || 0,
        type: (data.type as string) || 'short_answer',
      });
      if (result.success) {
        showNotification({ message: t.toast.changesSaved, color: 'green' });
        router.refresh();
        return true;
      } else {
        showNotification({ title: t.common.error, message: result.error, color: 'red' });
        return false;
      }
    },
    [paper.id, router, t],
  );

  const headerNode = useMemo(
    () => (
      <DocumentDetailHeader
        docId={paper.id}
        initialName={paper.title}
        docType="exam"
        school={school}
        course={course}
        status={paper.status}
        backHref="/admin/knowledge"
        onSaveName={async () => {
          // Exam title rename not yet supported
        }}
      />
    ),
    [paper.id, paper.title, school, course, paper.status],
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
          <PdfUploadZone
            documentId={paper.id}
            docType={docType}
            existingItemCount={visibleChunks.length}
            courseId={courseId || undefined}
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
            docId={paper.id}
            docType={docType}
            pendingChanges={pendingChanges}
            editedChunks={editedChunks}
            deletedChunkIds={deletedChunkIds}
            onSaved={handleSaved}
            status={paper.status}
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
