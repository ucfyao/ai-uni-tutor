'use client';

import { ArrowLeft, ChevronDown, ChevronUp, Pencil, RefreshCw, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Collapse,
  Container,
  Divider,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  regenerateEmbeddings,
  updateDocumentChunks,
  updateDocumentMeta,
} from '@/app/actions/documents';
import { showNotification } from '@/lib/notifications';
import type { Json } from '@/types/database';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SerializedDocument {
  id: string;
  userId: string;
  name: string;
  status: string;
  statusMessage: string | null;
  metadata: Json;
  createdAt: string;
}

interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

interface DocumentDetailClientProps {
  document: SerializedDocument;
  chunks: Chunk[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Safely read a string field from Json metadata */
function metaStr(meta: Json, key: string): string {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    return typeof val === 'string' ? val : '';
  }
  return '';
}

/** Safely read a string[] field from Json metadata */
function metaStrArr(meta: Json, key: string): string[] {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

/** Safely read the numeric score from Json metadata */
function metaNum(meta: Json, key: string): number | null {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    }
  }
  return null;
}

/** Get the metadata type of the first chunk that has one */
function detectChunkType(chunks: Chunk[]): 'knowledge_point' | 'question' | null {
  for (const c of chunks) {
    const t = metaStr(c.metadata, 'type');
    if (t === 'knowledge_point' || t === 'question') return t;
  }
  return null;
}

/** Status color mapping */
function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'green';
    case 'processing':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DocumentDetailClient({ document: doc, chunks }: DocumentDetailClientProps) {
  /* ---- document name editing ---- */
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(doc.name);

  /* ---- chunk editing / deleting ---- */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());

  /* ---- save / regenerate placeholders ---- */
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  /* ---- expand / collapse answer sections ---- */
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  /* ---- derived ---- */
  const chunkType = detectChunkType(chunks);
  const visibleChunks = chunks.filter((c) => !deletedChunkIds.has(c.id));
  const pendingChanges =
    editedChunks.size + deletedChunkIds.size + (nameValue !== doc.name ? 1 : 0);

  const docMeta = doc.metadata;
  const docType = metaStr(docMeta, 'doc_type') || metaStr(docMeta, 'docType') || 'lecture';
  const school = metaStr(docMeta, 'school');
  const course = metaStr(docMeta, 'course');

  /* ---- helpers for chunk editing ---- */
  function getEffectiveMetadata(chunk: Chunk): Record<string, unknown> {
    const edited = editedChunks.get(chunk.id);
    if (edited) return edited.metadata;
    if (chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)) {
      return chunk.metadata as Record<string, unknown>;
    }
    return {};
  }

  function getEffectiveContent(chunk: Chunk): string {
    const edited = editedChunks.get(chunk.id);
    return edited ? edited.content : chunk.content;
  }

  function startEditing(chunk: Chunk) {
    setEditingChunkId(chunk.id);
  }

  function cancelEditing() {
    setEditingChunkId(null);
  }

  function saveChunkEdit(chunkId: string, content: string, metadata: Record<string, unknown>) {
    setEditedChunks((prev) => {
      const next = new Map(prev);
      next.set(chunkId, { content, metadata });
      return next;
    });
    setEditingChunkId(null);
  }

  function markDeleted(chunkId: string) {
    setDeletedChunkIds((prev) => {
      const next = new Set(prev);
      next.add(chunkId);
      return next;
    });
    if (editingChunkId === chunkId) setEditingChunkId(null);
  }

  function toggleAnswer(chunkId: string) {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <Container size="md" py={48}>
      <Stack gap="xl">
        {/* ---- Top bar: back link ---- */}
        <Group>
          <Button
            component={Link}
            href="/knowledge"
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            color="gray"
            size="sm"
          >
            Back to Knowledge Base
          </Button>
        </Group>

        {/* ---- Document metadata card ---- */}
        <Card withBorder radius="lg" p="lg">
          <Stack gap="sm">
            {editingName ? (
              <Group>
                <TextInput
                  value={nameValue}
                  onChange={(e) => setNameValue(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="md"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    if (nameValue.trim() && nameValue !== doc.name) {
                      const result = await updateDocumentMeta(doc.id, { name: nameValue.trim() });
                      if (result.status === 'success') {
                        showNotification({
                          title: 'Updated',
                          message: 'Document name updated',
                          color: 'green',
                        });
                      }
                    }
                    setEditingName(false);
                  }}
                >
                  Done
                </Button>
              </Group>
            ) : (
              <Group justify="space-between">
                <Title order={2} fw={700}>
                  {nameValue}
                </Title>
                <ActionIcon variant="subtle" color="gray" onClick={() => setEditingName(true)}>
                  <Pencil size={16} />
                </ActionIcon>
              </Group>
            )}

            <Group gap="xs">
              <Badge variant="light" color="indigo">
                {docType}
              </Badge>
              {school && (
                <Badge variant="light" color="gray">
                  {school}
                </Badge>
              )}
              {course && (
                <Badge variant="light" color="gray">
                  {course}
                </Badge>
              )}
              <Badge variant="light" color={statusColor(doc.status)}>
                {doc.status}
              </Badge>
            </Group>

            <Text size="sm" c="dimmed">
              Uploaded {new Date(doc.createdAt).toLocaleDateString()}
            </Text>

            {doc.statusMessage && (
              <Text size="sm" c="red">
                {doc.statusMessage}
              </Text>
            )}
          </Stack>
        </Card>

        <Divider />

        {/* ---- Content section ---- */}
        {chunkType === 'knowledge_point' && (
          <KnowledgePointSection
            chunks={visibleChunks}
            editingChunkId={editingChunkId}
            editedChunks={editedChunks}
            getEffectiveMetadata={getEffectiveMetadata}
            getEffectiveContent={getEffectiveContent}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveChunkEdit}
            onDelete={markDeleted}
          />
        )}

        {chunkType === 'question' && (
          <QuestionSection
            chunks={visibleChunks}
            editingChunkId={editingChunkId}
            editedChunks={editedChunks}
            expandedAnswers={expandedAnswers}
            getEffectiveMetadata={getEffectiveMetadata}
            getEffectiveContent={getEffectiveContent}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveChunkEdit}
            onDelete={markDeleted}
            onToggleAnswer={toggleAnswer}
          />
        )}

        {chunkType === null && (
          <FallbackSection
            chunks={visibleChunks}
            editingChunkId={editingChunkId}
            getEffectiveContent={getEffectiveContent}
            onStartEdit={startEditing}
            onCancelEdit={cancelEditing}
            onSaveEdit={saveChunkEdit}
            onDelete={markDeleted}
          />
        )}

        {/* ---- Bottom action bar ---- */}
        <Card
          withBorder
          radius="lg"
          p="md"
          style={{ position: 'sticky', bottom: 16, zIndex: 10 }}
          bg="var(--mantine-color-body)"
        >
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {pendingChanges > 0
                ? `${pendingChanges} pending change${pendingChanges > 1 ? 's' : ''}`
                : 'No changes'}
            </Text>
            <Group gap="sm">
              <Button
                variant="light"
                color="gray"
                leftSection={<RefreshCw size={16} />}
                loading={regenerating}
                disabled={regenerating}
                onClick={async () => {
                  setRegenerating(true);
                  try {
                    const result = await regenerateEmbeddings(doc.id);
                    if (result.status === 'success') {
                      showNotification({ title: 'Done', message: result.message, color: 'green' });
                    } else {
                      showNotification({ title: 'Error', message: result.message, color: 'red' });
                    }
                  } catch {
                    showNotification({
                      title: 'Error',
                      message: 'Failed to regenerate embeddings',
                      color: 'red',
                    });
                  } finally {
                    setRegenerating(false);
                  }
                }}
              >
                Regenerate Embeddings
              </Button>
              <Button
                color="indigo"
                leftSection={<Save size={16} />}
                loading={saving}
                disabled={pendingChanges === 0 || saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
                      id,
                      content: data.content,
                      metadata: data.metadata,
                    }));
                    const result = await updateDocumentChunks(
                      doc.id,
                      updates,
                      Array.from(deletedChunkIds),
                    );
                    if (result.status === 'success') {
                      showNotification({ title: 'Saved', message: result.message, color: 'green' });
                      setEditedChunks(new Map());
                      setDeletedChunkIds(new Set());
                    } else {
                      showNotification({ title: 'Error', message: result.message, color: 'red' });
                    }
                  } catch {
                    showNotification({
                      title: 'Error',
                      message: 'Failed to save changes',
                      color: 'red',
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save Changes
              </Button>
            </Group>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}

/* ================================================================== */
/*  Knowledge Point Section                                            */
/* ================================================================== */

interface KnowledgePointSectionProps {
  chunks: Chunk[];
  editingChunkId: string | null;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  getEffectiveMetadata: (chunk: Chunk) => Record<string, unknown>;
  getEffectiveContent: (chunk: Chunk) => string;
  onStartEdit: (chunk: Chunk) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (chunkId: string) => void;
}

function KnowledgePointSection({
  chunks,
  editingChunkId,
  getEffectiveMetadata,
  getEffectiveContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: KnowledgePointSectionProps) {
  return (
    <Stack gap="md">
      <Group gap="sm">
        <Title order={3}>Knowledge Points</Title>
        <Badge variant="filled" color="indigo" size="lg">
          {chunks.length}
        </Badge>
      </Group>

      {chunks.map((chunk) => {
        const meta = getEffectiveMetadata(chunk);
        const isEditing = editingChunkId === chunk.id;

        if (isEditing) {
          return (
            <KnowledgePointEditCard
              key={chunk.id}
              chunk={chunk}
              meta={meta}
              content={getEffectiveContent(chunk)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          );
        }

        return (
          <KnowledgePointViewCard
            key={chunk.id}
            chunk={chunk}
            meta={meta}
            onEdit={() => onStartEdit(chunk)}
            onDelete={() => onDelete(chunk.id)}
          />
        );
      })}
    </Stack>
  );
}

/* ---- Knowledge Point View Card ---- */

function KnowledgePointViewCard({
  chunk,
  meta,
  onEdit,
  onDelete,
}: {
  chunk: Chunk;
  meta: Record<string, unknown>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const title = (meta.title as string) || '';
  const definition = (meta.definition as string) || chunk.content;
  const keyFormulas = Array.isArray(meta.keyFormulas) ? (meta.keyFormulas as string[]) : [];
  const keyConcepts = Array.isArray(meta.keyConcepts) ? (meta.keyConcepts as string[]) : [];
  const examples = Array.isArray(meta.examples) ? (meta.examples as string[]) : [];
  const sourcePages = (meta.sourcePages as string) || (meta.source_pages as string) || '';

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Text fw={700} size="lg">
            {title || 'Untitled'}
          </Text>
          <Group gap={4}>
            <ActionIcon variant="subtle" color="gray" onClick={onEdit}>
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={onDelete}>
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Group>

        <Text size="sm">{definition}</Text>

        {keyFormulas.length > 0 && (
          <Box>
            <Text size="xs" fw={600} mb={4}>
              Key Formulas
            </Text>
            <Code block>{keyFormulas.join('\n')}</Code>
          </Box>
        )}

        {keyConcepts.length > 0 && (
          <Group gap={4}>
            {keyConcepts.map((concept, i) => (
              <Badge key={i} variant="outline" color="indigo" size="sm">
                {concept}
              </Badge>
            ))}
          </Group>
        )}

        {examples.length > 0 && (
          <Box>
            <Text size="xs" fw={600} mb={4}>
              Examples
            </Text>
            <Stack gap={2}>
              {examples.map((ex, i) => (
                <Text key={i} size="sm" c="dimmed">
                  {'\u2022'} {ex}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {sourcePages && (
          <Text size="xs" c="dimmed">
            Source: {sourcePages}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

/* ---- Knowledge Point Edit Card ---- */

function KnowledgePointEditCard({
  chunk,
  meta,
  content,
  onSave,
  onCancel,
}: {
  chunk: Chunk;
  meta: Record<string, unknown>;
  content: string;
  onSave: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState((meta.title as string) || '');
  const [definition, setDefinition] = useState((meta.definition as string) || content);
  const [formulas, setFormulas] = useState(
    Array.isArray(meta.keyFormulas) ? (meta.keyFormulas as string[]).join('\n') : '',
  );
  const [concepts, setConcepts] = useState(
    Array.isArray(meta.keyConcepts) ? (meta.keyConcepts as string[]).join('\n') : '',
  );
  const [examples, setExamples] = useState(
    Array.isArray(meta.examples) ? (meta.examples as string[]).join('\n') : '',
  );

  function handleSave() {
    const updatedMeta: Record<string, unknown> = {
      ...meta,
      title,
      definition,
      keyFormulas: formulas
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      keyConcepts: concepts
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      examples: examples
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    onSave(chunk.id, definition, updatedMeta);
  }

  return (
    <Card withBorder radius="md" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea
          label="Definition"
          value={definition}
          onChange={(e) => setDefinition(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label="Key Formulas (one per line)"
          value={formulas}
          onChange={(e) => setFormulas(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label="Key Concepts (one per line)"
          value={concepts}
          onChange={(e) => setConcepts(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label="Examples (one per line)"
          value={examples}
          onChange={(e) => setExamples(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ================================================================== */
/*  Question Section                                                   */
/* ================================================================== */

interface QuestionSectionProps {
  chunks: Chunk[];
  editingChunkId: string | null;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  expandedAnswers: Set<string>;
  getEffectiveMetadata: (chunk: Chunk) => Record<string, unknown>;
  getEffectiveContent: (chunk: Chunk) => string;
  onStartEdit: (chunk: Chunk) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (chunkId: string) => void;
  onToggleAnswer: (chunkId: string) => void;
}

function QuestionSection({
  chunks,
  editingChunkId,
  expandedAnswers,
  getEffectiveMetadata,
  getEffectiveContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleAnswer,
}: QuestionSectionProps) {
  return (
    <Stack gap="md">
      <Group gap="sm">
        <Title order={3}>Questions</Title>
        <Badge variant="filled" color="indigo" size="lg">
          {chunks.length}
        </Badge>
      </Group>

      {chunks.map((chunk) => {
        const meta = getEffectiveMetadata(chunk);
        const isEditing = editingChunkId === chunk.id;

        if (isEditing) {
          return (
            <QuestionEditCard
              key={chunk.id}
              chunk={chunk}
              meta={meta}
              content={getEffectiveContent(chunk)}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          );
        }

        return (
          <QuestionViewCard
            key={chunk.id}
            chunk={chunk}
            meta={meta}
            expanded={expandedAnswers.has(chunk.id)}
            onEdit={() => onStartEdit(chunk)}
            onDelete={() => onDelete(chunk.id)}
            onToggleAnswer={() => onToggleAnswer(chunk.id)}
          />
        );
      })}
    </Stack>
  );
}

/* ---- Question View Card ---- */

function QuestionViewCard({
  chunk,
  meta,
  expanded,
  onEdit,
  onDelete,
  onToggleAnswer,
}: {
  chunk: Chunk;
  meta: Record<string, unknown>;
  expanded: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAnswer: () => void;
}) {
  const questionNumber = (meta.questionNumber as string) || '';
  const content = (meta.content as string) || chunk.content;
  const options = Array.isArray(meta.options) ? (meta.options as string[]) : [];
  const answer = (meta.answer as string) || (meta.referenceAnswer as string) || '';
  const score = meta.score != null ? String(meta.score) : '';

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            {questionNumber && (
              <Badge variant="filled" color="indigo">
                Q{questionNumber}
              </Badge>
            )}
            {score && (
              <Badge variant="light" color="orange">
                {score} pts
              </Badge>
            )}
          </Group>
          <Group gap={4}>
            <ActionIcon variant="subtle" color="gray" onClick={onEdit}>
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={onDelete}>
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Group>

        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Text>

        {options.length > 0 && (
          <Stack gap={2}>
            {options.map((opt, i) => (
              <Text key={i} size="sm" c="dimmed">
                {String.fromCharCode(65 + i)}. {opt}
              </Text>
            ))}
          </Stack>
        )}

        {answer && (
          <>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onToggleAnswer}
              rightSection={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              style={{ alignSelf: 'flex-start' }}
            >
              {expanded ? 'Hide Answer' : 'Show Answer'}
            </Button>
            <Collapse in={expanded}>
              <Card bg="var(--mantine-color-gray-0)" p="sm" radius="sm">
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {answer}
                </Text>
              </Card>
            </Collapse>
          </>
        )}
      </Stack>
    </Card>
  );
}

/* ---- Question Edit Card ---- */

function QuestionEditCard({
  chunk,
  meta,
  content: initialContent,
  onSave,
  onCancel,
}: {
  chunk: Chunk;
  meta: Record<string, unknown>;
  content: string;
  onSave: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [questionNumber, setQuestionNumber] = useState((meta.questionNumber as string) || '');
  const [content, setContent] = useState((meta.content as string) || initialContent);
  const [options, setOptions] = useState(
    Array.isArray(meta.options) ? (meta.options as string[]).join('\n') : '',
  );
  const [answer, setAnswer] = useState(
    (meta.answer as string) || (meta.referenceAnswer as string) || '',
  );
  const [score, setScore] = useState(meta.score != null ? String(meta.score) : '');

  function handleSave() {
    const updatedMeta: Record<string, unknown> = {
      ...meta,
      questionNumber,
      content,
      options: options
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      answer,
      score: score ? Number(score) : undefined,
    };
    onSave(chunk.id, content, updatedMeta);
  }

  return (
    <Card withBorder radius="md" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Question Number"
            value={questionNumber}
            onChange={(e) => setQuestionNumber(e.currentTarget.value)}
          />
          <TextInput
            label="Score"
            value={score}
            onChange={(e) => setScore(e.currentTarget.value)}
            type="number"
          />
        </Group>
        <Textarea
          label="Question Content"
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label="Options (one per line)"
          value={options}
          onChange={(e) => setOptions(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label="Reference Answer"
          value={answer}
          onChange={(e) => setAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ================================================================== */
/*  Fallback Section (raw chunks)                                      */
/* ================================================================== */

interface FallbackSectionProps {
  chunks: Chunk[];
  editingChunkId: string | null;
  getEffectiveContent: (chunk: Chunk) => string;
  onStartEdit: (chunk: Chunk) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (chunkId: string) => void;
}

function FallbackSection({
  chunks,
  editingChunkId,
  getEffectiveContent,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: FallbackSectionProps) {
  return (
    <Stack gap="md">
      <Group gap="sm">
        <Title order={3}>Document Chunks</Title>
        <Badge variant="filled" color="gray" size="lg">
          {chunks.length}
        </Badge>
      </Group>

      {chunks.map((chunk, index) => {
        const isEditing = editingChunkId === chunk.id;
        const content = getEffectiveContent(chunk);

        if (isEditing) {
          return (
            <FallbackEditCard
              key={chunk.id}
              chunk={chunk}
              content={content}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          );
        }

        return (
          <Card key={chunk.id} withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Text fw={600} size="sm" c="dimmed">
                  Chunk {index + 1}
                </Text>
                <Group gap={4}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => onStartEdit(chunk)}>
                    <Pencil size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => onDelete(chunk.id)}>
                    <Trash2 size={14} />
                  </ActionIcon>
                </Group>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {content}
              </Text>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}

/* ---- Fallback Edit Card ---- */

function FallbackEditCard({
  chunk,
  content: initialContent,
  onSave,
  onCancel,
}: {
  chunk: Chunk;
  content: string;
  onSave: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initialContent);

  function handleSave() {
    const meta =
      chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
        ? (chunk.metadata as Record<string, unknown>)
        : {};
    onSave(chunk.id, content, meta);
  }

  return (
    <Card withBorder radius="md" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Textarea
          label="Content"
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={4}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
