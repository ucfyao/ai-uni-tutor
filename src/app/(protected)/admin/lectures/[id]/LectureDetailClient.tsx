'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ScrollArea, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  deleteDocument,
  publishDocument,
  unpublishDocument,
  updateDocumentMeta,
} from '@/app/actions/documents';
import { PdfUploadZone } from '@/components/rag/PdfUploadZone';
import { useHeader } from '@/context/HeaderContext';
import { useLanguage } from '@/i18n/LanguageContext';
import type { DocumentStatus } from '@/lib/domain/models/Document';
import { showNotification } from '@/lib/notifications';
import type { Json } from '@/types/database';
import { ChunkActionBar } from '../../knowledge/[id]/ChunkActionBar';
import { ChunkTable } from '../../knowledge/[id]/ChunkTable';
import { DocumentDetailHeader } from '../../knowledge/[id]/DocumentDetailHeader';

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

interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

interface LectureDetailClientProps {
  document: SerializedLectureDocument;
  chunks: Chunk[];
}

export function LectureDetailClient({ document: doc, chunks }: LectureDetailClientProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();
  const router = useRouter();
  const { t } = useLanguage();

  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>(doc.status);
  const [currentName, setCurrentName] = useState(doc.name);
  const [isPublishing, setIsPublishing] = useState(false);

  // Chunk editing state (mirrors DocumentDetailClient)
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleChunks = chunks.filter((c) => !deletedChunkIds.has(c.id));
  const pendingChanges = editedChunks.size + deletedChunkIds.size;

  // Metadata helpers
  const school =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (((doc.metadata as Record<string, unknown>).school as string) ?? '')
      : '';
  const course =
    doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? (((doc.metadata as Record<string, unknown>).course as string) ?? '')
      : '';

  // Handlers (same pattern as DocumentDetailClient)
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

  // Publish/unpublish/delete
  const handlePublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      await publishDocument(doc.id, 'lecture');
      setCurrentStatus('ready');
      showNotification({ message: 'Published', color: 'green' });
    } catch (e) {
      showNotification({
        title: t.common?.error ?? 'Error',
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
      showNotification({ message: 'Unpublished', color: 'blue' });
    } catch (e) {
      showNotification({
        title: t.common?.error ?? 'Error',
        message: e instanceof Error ? e.message : 'Failed',
        color: 'red',
      });
    }
  }, [doc.id, t]);

  const handleDeleteDoc = useCallback(async () => {
    try {
      await deleteDocument(doc.id, 'lecture');
      router.push('/admin/knowledge');
    } catch (e) {
      showNotification({
        title: t.common?.error ?? 'Error',
        message: e instanceof Error ? e.message : 'Failed to delete',
        color: 'red',
      });
    }
  }, [doc.id, router, t]);

  // Header node
  const headerNode = useMemo(
    () => (
      <DocumentDetailHeader
        docId={doc.id}
        initialName={currentName}
        docType="lecture"
        school={school}
        course={course}
        status={currentStatus}
        backHref="/admin/knowledge"
        onSaveName={async (newName) => {
          const result = await updateDocumentMeta(doc.id, { name: newName });
          if (result.status === 'success') {
            setCurrentName(newName);
          }
        }}
      />
    ),
    [doc.id, currentName, school, course, currentStatus],
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
            documentId={doc.id}
            docType="lecture"
            existingItemCount={visibleChunks.length}
            courseId={doc.courseId ?? undefined}
            onParseComplete={() => router.refresh()}
          />
          <ChunkTable
            chunks={visibleChunks}
            docType="lecture"
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
          />
          <ChunkActionBar
            docId={doc.id}
            docType="lecture"
            pendingChanges={pendingChanges}
            editedChunks={editedChunks}
            deletedChunkIds={deletedChunkIds}
            onSaved={handleSaved}
            status={currentStatus}
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
