'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, ScrollArea, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useHeader } from '@/context/HeaderContext';
import { ChunkActionBar } from './ChunkActionBar';
import { ChunkTable } from './ChunkTable';
import { DocumentDetailHeader } from './DocumentDetailHeader';
import type { Chunk, DocType, SerializedDocument } from './types';
import { metaStr, resolveDocType } from './types';

interface DocumentDetailClientProps {
  document: SerializedDocument;
  chunks: Chunk[];
}

export function DocumentDetailClient({ document: doc, chunks }: DocumentDetailClientProps) {
  const isMobile = useMediaQuery('(max-width: 48em)', false);
  const { setHeaderContent } = useHeader();

  /* -- derived from document metadata -- */
  const docType: DocType = resolveDocType(doc.metadata);
  const school = metaStr(doc.metadata, 'school');
  const course = metaStr(doc.metadata, 'course');

  /* -- document name -- */
  const [currentName, setCurrentName] = useState(doc.name);

  /* -- chunk editing state -- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  /* -- derived -- */
  const visibleChunks = chunks.filter((c) => !deletedChunkIds.has(c.id));
  const pendingChanges =
    editedChunks.size + deletedChunkIds.size + (currentName !== doc.name ? 1 : 0);

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

  const handleSaved = useCallback(() => {
    setEditedChunks(new Map());
    setDeletedChunkIds(new Set());
  }, []);

  /* -- Header (mirrors ChatPageLayout pattern) -- */
  const headerNode = useMemo(
    () => (
      <DocumentDetailHeader
        docId={doc.id}
        initialName={currentName}
        docType={docType}
        school={school}
        course={course}
        status={doc.status}
        onNameChanged={setCurrentName}
      />
    ),
    [doc.id, currentName, docType, school, course, doc.status],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  /* -- Layout: 52px header + ScrollArea + sticky footer -- */
  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Desktop Header */}
      {!isMobile && (
        <Box
          px="md"
          h={52}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            backgroundColor: 'white',
            flexShrink: 0,
          }}
        >
          {headerNode}
        </Box>
      )}

      {/* Scrollable Content */}
      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        <Stack gap="md" p="lg" maw={900} mx="auto">
          <ChunkTable
            chunks={visibleChunks}
            docType={docType}
            editingChunkId={editingChunkId}
            expandedAnswers={expandedAnswers}
            getEffectiveContent={getEffectiveContent}
            getEffectiveMetadata={getEffectiveMetadata}
            onStartEdit={(chunk) => setEditingChunkId(chunk.id)}
            onCancelEdit={() => setEditingChunkId(null)}
            onSaveEdit={handleSaveEdit}
            onDelete={handleDelete}
            onToggleAnswer={handleToggleAnswer}
          />

          {/* Sticky footer */}
          <ChunkActionBar
            docId={doc.id}
            pendingChanges={pendingChanges}
            editedChunks={editedChunks}
            deletedChunkIds={deletedChunkIds}
            onSaved={handleSaved}
          />
        </Stack>
      </ScrollArea>
    </Box>
  );
}
