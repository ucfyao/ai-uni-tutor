'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Save, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, Group, Modal, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import {
  addExamQuestion,
  deleteDocument,
  publishDocument,
  unpublishDocument,
  updateExamQuestions,
} from '@/app/actions/documents';
import { AdminContent } from '@/components/admin/AdminContent';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { ExamPaper, ExamQuestion } from '@/types/exam';
import { ChunkTable } from './ChunkTable';
import { DocumentDetailHeader } from './DocumentDetailHeader';
import type { Chunk, DocType } from './types';

interface ExamDetailClientProps {
  paper: ExamPaper;
  questions: ExamQuestion[];
}

export function ExamDetailClient({ paper, questions }: ExamDetailClientProps) {
  const isMobile = useIsMobile();
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

  /* -- save -- */
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
        id,
        content: data.content,
        metadata: data.metadata,
      }));
      const deletedArr = Array.from(deletedChunkIds);
      const result = await updateExamQuestions(paper.id, updates, deletedArr);
      if (result.status === 'success') {
        showNotification({
          message: t.toast.changesSaved,
          color: 'green',
          icon: <Check size={16} />,
          autoClose: 3000,
        });
        setEditedChunks(new Map());
        setDeletedChunkIds(new Set());
        setSelectedIds(new Set());
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
  }, [paper.id, editedChunks, deletedChunkIds, t]);

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
      router.push('/admin/knowledge?tab=exam');
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
        backHref="/admin/knowledge?tab=exam"
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
        <AdminContent gap="md">
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
          <Card
            withBorder
            radius="lg"
            p="md"
            style={{ position: 'sticky', bottom: 0, zIndex: 10 }}
            bg="var(--mantine-color-body)"
          >
            <Group justify="space-between">
              <Group gap="sm">
                {paper.status === 'draft' && (
                  <Tooltip
                    label={
                      visibleChunks.length === 0 ? t.knowledge.publishDisabledTooltip : undefined
                    }
                    disabled={visibleChunks.length !== 0}
                  >
                    <Button
                      variant="light"
                      color="green"
                      size="compact-sm"
                      leftSection={<Send size={14} />}
                      loading={isPublishing}
                      disabled={visibleChunks.length === 0}
                      onClick={handlePublish}
                      radius="md"
                    >
                      {t.documentDetail.publish}
                    </Button>
                  </Tooltip>
                )}
                {paper.status === 'ready' && (
                  <Button
                    variant="light"
                    color="yellow"
                    size="compact-sm"
                    onClick={handleUnpublish}
                    radius="md"
                  >
                    {t.documentDetail.unpublish}
                  </Button>
                )}
                <Button
                  variant="light"
                  color="red"
                  size="compact-sm"
                  onClick={() => setDeleteModalOpen(true)}
                  radius="md"
                >
                  <Trash2 size={14} />
                </Button>
                <Text size="sm" c="dimmed">
                  {pendingChanges > 0
                    ? `${pendingChanges} ${t.documentDetail.pendingChanges}`
                    : t.documentDetail.noChanges}
                </Text>
              </Group>
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
          </Card>

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
                  handleDeleteDoc();
                }}
                radius="md"
              >
                {t.common.delete}
              </Button>
            </Group>
          </Modal>
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
