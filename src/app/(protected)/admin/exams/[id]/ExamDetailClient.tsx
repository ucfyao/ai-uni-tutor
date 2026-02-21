'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Send, Trash2, Upload } from 'lucide-react';
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
  ScrollArea,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { deleteDocument, publishDocument, unpublishDocument } from '@/app/actions/documents';
import { AdminContent } from '@/components/admin/AdminContent';
import { ExamQuestionList } from '@/components/rag/ExamQuestionList';
import type { KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { DOC_TYPES, getDocColor } from '@/constants/doc-types';
import { useHeader } from '@/context/HeaderContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useExamQuestions } from '@/hooks/useExamQuestions';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';
import type { ExamPaper, ExamQuestion } from '@/types/exam';

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

interface ExamDetailClientProps {
  paper: ExamPaper;
  questions: ExamQuestion[];
}

export function ExamDetailClient({ paper, questions: initialQuestions }: ExamDetailClientProps) {
  const isMobile = useIsMobile();
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const school = paper.school || '';
  const course = paper.course || '';
  const courseId = paper.courseId || '';

  /* -- use hook for data management -- */
  const {
    questions,
    addQuestion,
    isAddingQuestion,
    updateQuestion,
    deleteQuestion,
    rename,
    invalidateQuestions,
  } = useExamQuestions(paper.id, initialQuestions);

  /* -- UI state -- */
  const [showUploadZone, setShowUploadZone] = useState(initialQuestions.length === 0);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(paper.title);
  const [isPublishing, setIsPublishing] = useState(false);

  /* -- question handlers (delegate to hook mutations) -- */
  const handleSaveQuestion = useCallback(
    async (
      questionId: string,
      fields: {
        content?: string;
        answer?: string;
        explanation?: string;
        points?: number;
        type?: string;
        options?: Record<string, string> | null;
        orderNum?: number;
      },
    ) => {
      await updateQuestion({ questionId, ...fields });
    },
    [updateQuestion],
  );

  const handleDeleteQuestion = useCallback(
    async (questionId: string) => {
      await deleteQuestion(questionId);
    },
    [deleteQuestion],
  );

  const handleAddQuestion = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      try {
        await addQuestion({
          content: (data.content as string) || '',
          answer: (data.referenceAnswer as string) || '',
          explanation: (data.explanation as string) || '',
          points: (data.points as number) || 0,
          type: (data.type as string) || 'short_answer',
        });
        return true;
      } catch {
        return false;
      }
    },
    [addQuestion],
  );

  /* -- publish / unpublish / delete handlers -- */
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const result = await publishDocument(paper.id, 'exam');
      if (result.success) {
        showNotification({ message: t.documentDetail.publish, color: 'green' });
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
      showNotification({ message: t.documentDetail.unpublish, color: 'green' });
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
      showNotification({ message: t.toast.deletedSuccessfully, color: 'green' });
      router.push('/admin/knowledge?tab=exam');
    } catch {
      showNotification({ title: t.common.error, message: 'Failed to delete', color: 'red' });
    }
  }, [paper.id, queryClient, router, t]);

  /* -- rename handler -- */
  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== paper.title) {
      await rename(trimmed);
    }
    setEditingName(false);
  }, [nameValue, paper.title, rename]);

  /* -- header action buttons (right side) -- */
  const headerActions = useMemo(
    () => (
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        {/* Group 1: Content creation */}
        <Tooltip label={t.documentDetail.addManually}>
          <ActionIcon variant="default" color="gray" size="md" onClick={() => setAddFormOpen(true)}>
            <Plus size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t.documentDetail.uploadPdf}>
          <ActionIcon
            variant={showUploadZone ? 'filled' : 'default'}
            color={showUploadZone ? getDocColor('exam') : 'gray'}
            size="md"
            onClick={() => setShowUploadZone((v) => !v)}
          >
            <Upload size={16} />
          </ActionIcon>
        </Tooltip>

        {/* Group 2: Publish */}
        {(paper.status === 'draft' || paper.status === 'ready') && (
          <>
            <Divider orientation="vertical" size="xs" h={20} style={{ alignSelf: 'center' }} />
            {paper.status === 'draft' && (
              <Tooltip
                label={
                  questions.length === 0
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
                    disabled={questions.length === 0}
                    onClick={handlePublish}
                  >
                    <Send size={16} />
                  </ActionIcon>
                </span>
              </Tooltip>
            )}
            {paper.status === 'ready' && (
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
      paper.status,
      questions.length,
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
            href="/admin/knowledge?tab=exam"
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
            <Badge variant="light" color={getDocColor('exam')} size="sm">
              {(t.knowledge.docTypeLabel as Record<string, string>)?.exam ?? 'Exam'}
            </Badge>
            <Badge variant="light" color={statusColor(paper.status)} size="sm">
              {paper.status}
            </Badge>
          </Group>
        </Group>

        {/* Right: actions */}
        {headerActions}
      </Group>
    ),
    [editingName, nameValue, handleSaveName, school, course, paper.status, headerActions, t],
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
          {showUploadZone && (
            <PdfUploadZone
              documentId={paper.id}
              docType="exam"
              existingItemCount={questions.length}
              courseId={courseId || undefined}
              onParseComplete={() => {
                invalidateQuestions();
                router.refresh();
                setShowUploadZone(false);
              }}
            />
          )}

          <ExamQuestionList
            questions={questions}
            onSaveQuestion={handleSaveQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onAddQuestion={handleAddQuestion}
            isAddingQuestion={isAddingQuestion}
            addFormOpen={addFormOpen}
            onAddFormOpenChange={setAddFormOpen}
          />
        </AdminContent>
      </ScrollArea>
    </Box>
  );
}
