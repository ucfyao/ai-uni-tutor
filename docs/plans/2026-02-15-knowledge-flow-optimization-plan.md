# Knowledge Flow Complete Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the entire Knowledge Base flow — detail page refactor (ChatPageLayout + table + inline edit + component split + i18n), list page enhancement (search, sort, skeleton, empty state), and UX coherence (upload completion guidance, unified notification i18n).

**Architecture:** Split the 1017-line `DocumentDetailClient.tsx` into 5 focused components using the ChatPageLayout pattern (52px header + ScrollArea + sticky footer). Replace card-based chunk display with a Table driven by `doc_type`. Enhance the list page with search/sort and better loading states. All hardcoded English becomes i18n-ready.

**Tech Stack:** Next.js 16, React 19, Mantine v8, TanStack Query, `useLanguage()` i18n, `useHeader()` context, lucide-react icons

**Design doc:** `docs/plans/2026-02-15-knowledge-flow-optimization.md`

---

## Task 1: Add i18n Translation Keys

Add all translation keys needed by the detail page refactor, list page enhancements, and UX coherence features.

**Files:**

- Modify: `src/i18n/translations.ts`

**Step 1: Add `documentDetail` namespace to ZH translations**

Find the closing `},` of the `knowledge` block in the `zh` section (around line 252). Add a new `documentDetail` block **after** the `knowledge` block:

```typescript
    documentDetail: {
      backToKnowledge: '返回知识库',
      pendingChanges: '个待保存的更改',
      noChanges: '暂无更改',
      knowledgePoints: '个知识点',
      questions: '个问题',
      chunks: '个片段',
      title: '标题',
      definition: '定义',
      keyFormulas: '关键公式',
      keyConcepts: '关键概念',
      examples: '示例',
      questionNumber: '题号',
      content: '内容',
      options: '选项',
      answer: '参考答案',
      score: '分值',
      saveChanges: '保存更改',
      regenerateEmbeddings: '重新生成嵌入向量',
      editChunk: '编辑',
      deleteChunk: '删除',
      cancel: '取消',
      save: '保存',
      updated: '已更新',
      saved: '已保存',
      nameUpdated: '文档名称已更新',
      showAnswer: '显示答案',
      hideAnswer: '隐藏答案',
      untitled: '无标题',
      chunk: '片段',
      uploaded: '上传于',
      done: '完成',
      failedToRegenerate: '重新生成嵌入向量失败',
      failedToSave: '保存更改失败',
      onePerLine: '每行一个',
    },
```

**Step 2: Add `documentDetail` namespace to EN translations**

Same position in the `en` section (after `knowledge` block):

```typescript
    documentDetail: {
      backToKnowledge: 'Back to Knowledge Base',
      pendingChanges: 'pending changes',
      noChanges: 'No changes',
      knowledgePoints: 'knowledge points',
      questions: 'questions',
      chunks: 'chunks',
      title: 'Title',
      definition: 'Definition',
      keyFormulas: 'Key Formulas',
      keyConcepts: 'Key Concepts',
      examples: 'Examples',
      questionNumber: 'Question Number',
      content: 'Content',
      options: 'Options',
      answer: 'Reference Answer',
      score: 'Score',
      saveChanges: 'Save Changes',
      regenerateEmbeddings: 'Regenerate Embeddings',
      editChunk: 'Edit',
      deleteChunk: 'Delete',
      cancel: 'Cancel',
      save: 'Save',
      updated: 'Updated',
      saved: 'Saved',
      nameUpdated: 'Document name updated',
      showAnswer: 'Show Answer',
      hideAnswer: 'Hide Answer',
      untitled: 'Untitled',
      chunk: 'Chunk',
      uploaded: 'Uploaded',
      done: 'Done',
      failedToRegenerate: 'Failed to regenerate embeddings',
      failedToSave: 'Failed to save changes',
      onePerLine: 'one per line',
    },
```

**Step 3: Add new keys to `knowledge` namespace (both ZH and EN)**

Add these keys to the **end** of each `knowledge` block (before its closing `}`):

ZH additions:

```typescript
      searchDocuments: '搜索文档...',
      uploadGuide: '拖拽 PDF 到上方开始构建知识库',
      viewDetailsLink: '查看详情',
```

EN additions:

```typescript
      searchDocuments: 'Search documents...',
      uploadGuide: 'Drop a PDF above to start building your knowledge base',
      viewDetailsLink: 'View Details',
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (the `TranslationKey` type is auto-inferred from the `translations` object structure via `typeof translations.en`)

**Step 5: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n keys for document detail and list page enhancements"
```

---

## Task 2: Extract Shared Types for Detail Page

Extract the types used by all detail page sub-components into a shared file so each component can import them independently.

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/types.ts`

**Step 1: Create types file**

```typescript
import type { Json } from '@/types/database';

export interface SerializedDocument {
  id: string;
  userId: string;
  name: string;
  status: string;
  statusMessage: string | null;
  metadata: Json;
  createdAt: string;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}

export type DocType = 'lecture' | 'exam' | 'assignment';

/** Safely read a string field from Json metadata */
export function metaStr(meta: Json, key: string): string {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const val = (meta as Record<string, Json | undefined>)[key];
    return typeof val === 'string' ? val : '';
  }
  return '';
}

/** Resolve doc_type from document metadata */
export function resolveDocType(metadata: Json): DocType {
  const raw = metaStr(metadata, 'doc_type') || metaStr(metadata, 'docType');
  if (raw === 'exam' || raw === 'assignment') return raw;
  return 'lecture';
}

/** Status color mapping */
export function statusColor(status: string): string {
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
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/types.ts
git commit -m "refactor(rag): extract shared types for document detail page"
```

---

## Task 3: Create DocumentDetailHeader Component

The header bar for the detail page: back button, editable document name, doc_type/school/course/status badges.

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/DocumentDetailHeader.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Text, TextInput } from '@mantine/core';
import { updateDocumentMeta } from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { statusColor } from './types';

interface DocumentDetailHeaderProps {
  docId: string;
  initialName: string;
  docType: string;
  school: string;
  course: string;
  status: string;
  /** Called after name is successfully saved server-side */
  onNameChanged: (newName: string) => void;
}

export function DocumentDetailHeader({
  docId,
  initialName,
  docType,
  school,
  course,
  status,
  onNameChanged,
}: DocumentDetailHeaderProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialName);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      const result = await updateDocumentMeta(docId, { name: trimmed });
      if (result.status === 'success') {
        onNameChanged(trimmed);
        showNotification({
          title: t.documentDetail.updated,
          message: t.documentDetail.nameUpdated,
          color: 'green',
        });
      }
    }
    setEditing(false);
  };

  return (
    <Group justify="space-between" align="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
      {/* Left: back + name */}
      <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
        <Button
          component={Link}
          href="/knowledge"
          variant="subtle"
          color="gray"
          size="compact-sm"
          px={4}
          aria-label={t.documentDetail.backToKnowledge}
        >
          <ArrowLeft size={16} />
        </Button>

        {editing ? (
          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
            <TextInput
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              size="sm"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
            <Button size="compact-sm" onClick={handleSave}>
              {t.documentDetail.done}
            </Button>
          </Group>
        ) : (
          <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
            <Text fw={600} size="sm" truncate>
              {value}
            </Text>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {/* Right: badges */}
      <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Badge variant="light" color="indigo" size="sm">
          {docType}
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
        <Badge variant="light" color={statusColor(status)} size="sm">
          {status}
        </Badge>
      </Group>
    </Group>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/DocumentDetailHeader.tsx
git commit -m "feat(rag): create DocumentDetailHeader component"
```

---

## Task 4: Create ChunkEditForm Component

Inline edit form that switches fields by `doc_type`. Renders below the table row when editing.

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/ChunkEditForm.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { Button, Card, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Chunk, DocType } from './types';

interface ChunkEditFormProps {
  chunk: Chunk;
  docType: DocType;
  content: string;
  metadata: Record<string, unknown>;
  onSave: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ChunkEditForm({
  chunk,
  docType,
  content: initialContent,
  metadata: meta,
  onSave,
  onCancel,
}: ChunkEditFormProps) {
  const { t } = useLanguage();

  if (docType === 'lecture') {
    return (
      <LectureEditForm
        chunkId={chunk.id}
        meta={meta}
        initialContent={initialContent}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (docType === 'exam') {
    return (
      <ExamEditForm
        chunkId={chunk.id}
        meta={meta}
        initialContent={initialContent}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  return (
    <FallbackEditForm
      chunkId={chunk.id}
      meta={meta}
      initialContent={initialContent}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

/* ── Lecture Edit ── */

function LectureEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState((meta.title as string) || '');
  const [definition, setDefinition] = useState((meta.definition as string) || initialContent);
  const [formulas, setFormulas] = useState(
    Array.isArray(meta.keyFormulas) ? (meta.keyFormulas as string[]).join('\n') : '',
  );
  const [concepts, setConcepts] = useState(
    Array.isArray(meta.keyConcepts) ? (meta.keyConcepts as string[]).join('\n') : '',
  );
  const [examples, setExamples] = useState(
    Array.isArray(meta.examples) ? (meta.examples as string[]).join('\n') : '',
  );

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      title,
      definition,
      keyFormulas: formulas.split('\n').map((s) => s.trim()).filter(Boolean),
      keyConcepts: concepts.split('\n').map((s) => s.trim()).filter(Boolean),
      examples: examples.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    onSave(chunkId, definition, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <TextInput
          label={t.documentDetail.title}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
        <Textarea
          label={t.documentDetail.definition}
          value={definition}
          onChange={(e) => setDefinition(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.keyFormulas} (${t.documentDetail.onePerLine})`}
          value={formulas}
          onChange={(e) => setFormulas(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.keyConcepts} (${t.documentDetail.onePerLine})`}
          value={concepts}
          onChange={(e) => setConcepts(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.examples} (${t.documentDetail.onePerLine})`}
          value={examples}
          onChange={(e) => setExamples(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ── Exam Edit ── */

function ExamEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [questionNumber, setQuestionNumber] = useState((meta.questionNumber as string) || '');
  const [content, setContent] = useState((meta.content as string) || initialContent);
  const [options, setOptions] = useState(
    Array.isArray(meta.options) ? (meta.options as string[]).join('\n') : '',
  );
  const [answer, setAnswer] = useState(
    (meta.answer as string) || (meta.referenceAnswer as string) || '',
  );
  const [score, setScore] = useState(meta.score != null ? String(meta.score) : '');

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      questionNumber,
      content,
      options: options.split('\n').map((s) => s.trim()).filter(Boolean),
      answer,
      score: score ? Number(score) : undefined,
    };
    onSave(chunkId, content, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label={t.documentDetail.questionNumber}
            value={questionNumber}
            onChange={(e) => setQuestionNumber(e.currentTarget.value)}
          />
          <TextInput
            label={t.documentDetail.score}
            value={score}
            onChange={(e) => setScore(e.currentTarget.value)}
            type="number"
          />
        </Group>
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={`${t.documentDetail.options} (${t.documentDetail.onePerLine})`}
          value={options}
          onChange={(e) => setOptions(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={t.documentDetail.answer}
          value={answer}
          onChange={(e) => setAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

/* ── Fallback Edit ── */

function FallbackEditForm({
  chunkId,
  meta,
  initialContent,
  onSave,
  onCancel,
}: {
  chunkId: string;
  meta: Record<string, unknown>;
  initialContent: string;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    onSave(chunkId, content, meta);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={4}
          autosize
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="sm" onClick={onCancel} radius="md">
            {t.documentDetail.cancel}
          </Button>
          <Button color="indigo" size="sm" onClick={handleSave} radius="md">
            {t.documentDetail.save}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkEditForm.tsx
git commit -m "feat(rag): create ChunkEditForm component with doc_type-driven fields"
```

---

## Task 5: Create ChunkTable Component

Table display of chunks with columns driven by `doc_type`. Includes inline edit (renders `ChunkEditForm` in an expanded row). Supports answer expand/collapse for exam questions.

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/ChunkTable.tsx`

**Key patterns:**

- Use Mantine `<Table>` with `layout="fixed"`
- Desktop: Table rows. Mobile: Stack of compact cards.
- When editing a chunk, render a `<Table.Tr>` with `colSpan={fullColCount}` containing `<ChunkEditForm>`
- Doc type determines columns (see design doc section 1.2)
- Chunk count badge above table
- Use `useMediaQuery('(max-width: 48em)', false)` for responsive

**Step 1: Create the component**

```typescript
'use client';

import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { type CSSProperties } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChunkEditForm } from './ChunkEditForm';
import type { Chunk, DocType } from './types';

interface ChunkTableProps {
  chunks: Chunk[];
  docType: DocType;
  editingChunkId: string | null;
  expandedAnswers: Set<string>;
  getEffectiveContent: (chunk: Chunk) => string;
  getEffectiveMetadata: (chunk: Chunk) => Record<string, unknown>;
  onStartEdit: (chunk: Chunk) => void;
  onCancelEdit: () => void;
  onSaveEdit: (chunkId: string, content: string, metadata: Record<string, unknown>) => void;
  onDelete: (chunkId: string) => void;
  onToggleAnswer: (chunkId: string) => void;
}

const thStyle: CSSProperties = {
  color: 'var(--mantine-color-gray-5)',
  fontWeight: 500,
  fontSize: 'var(--mantine-font-size-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export function ChunkTable({
  chunks,
  docType,
  editingChunkId,
  expandedAnswers,
  getEffectiveContent,
  getEffectiveMetadata,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onToggleAnswer,
}: ChunkTableProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery('(max-width: 48em)', false);

  // Label for count badge
  const countLabel =
    docType === 'lecture'
      ? t.documentDetail.knowledgePoints
      : docType === 'exam'
        ? t.documentDetail.questions
        : t.documentDetail.chunks;

  if (isMobile) {
    return (
      <Stack gap="md">
        <Badge variant="filled" color="indigo" size="lg">
          {chunks.length} {countLabel}
        </Badge>
        {chunks.map((chunk, index) => (
          <MobileChunkRow
            key={chunk.id}
            chunk={chunk}
            index={index}
            docType={docType}
            isEditing={editingChunkId === chunk.id}
            isExpanded={expandedAnswers.has(chunk.id)}
            content={getEffectiveContent(chunk)}
            metadata={getEffectiveMetadata(chunk)}
            onEdit={() => onStartEdit(chunk)}
            onCancel={onCancelEdit}
            onSave={onSaveEdit}
            onDelete={() => onDelete(chunk.id)}
            onToggleAnswer={() => onToggleAnswer(chunk.id)}
          />
        ))}
      </Stack>
    );
  }

  // Desktop table
  return (
    <Stack gap="md">
      <Badge variant="filled" color="indigo" size="lg">
        {chunks.length} {countLabel}
      </Badge>
      <Card withBorder radius="lg" p={0} style={{ overflow: 'auto' }}>
        <Table verticalSpacing="sm" layout="fixed" highlightOnHover highlightOnHoverColor="var(--mantine-color-gray-0)">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w="5%" style={thStyle}>#</Table.Th>
              {docType === 'lecture' && (
                <>
                  <Table.Th w="25%" style={thStyle}>{t.documentDetail.title}</Table.Th>
                  <Table.Th w="50%" style={thStyle}>{t.documentDetail.definition}</Table.Th>
                </>
              )}
              {docType === 'exam' && (
                <>
                  <Table.Th w="10%" style={thStyle}>Q#</Table.Th>
                  <Table.Th w="45%" style={thStyle}>{t.documentDetail.content}</Table.Th>
                  <Table.Th w="10%" style={thStyle}>{t.documentDetail.score}</Table.Th>
                </>
              )}
              {docType === 'assignment' && (
                <Table.Th w="75%" style={thStyle}>{t.documentDetail.content}</Table.Th>
              )}
              <Table.Th w="10%" style={thStyle}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {chunks.map((chunk, index) => {
              const meta = getEffectiveMetadata(chunk);
              const content = getEffectiveContent(chunk);
              const isEditing = editingChunkId === chunk.id;
              const colCount = docType === 'lecture' ? 4 : docType === 'exam' ? 5 : 3;

              return (
                <DesktopChunkRows
                  key={chunk.id}
                  chunk={chunk}
                  index={index}
                  docType={docType}
                  colCount={colCount}
                  isEditing={isEditing}
                  isExpanded={expandedAnswers.has(chunk.id)}
                  content={content}
                  metadata={meta}
                  onEdit={() => onStartEdit(chunk)}
                  onCancel={onCancelEdit}
                  onSave={onSaveEdit}
                  onDelete={() => onDelete(chunk.id)}
                  onToggleAnswer={() => onToggleAnswer(chunk.id)}
                />
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

/* ── Desktop rows ── */

function DesktopChunkRows({
  chunk,
  index,
  docType,
  colCount,
  isEditing,
  isExpanded,
  content,
  metadata: meta,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleAnswer,
}: {
  chunk: Chunk;
  index: number;
  docType: DocType;
  colCount: number;
  isEditing: boolean;
  isExpanded: boolean;
  content: string;
  metadata: Record<string, unknown>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleAnswer: () => void;
}) {
  const { t } = useLanguage();
  const answer = (meta.answer as string) || (meta.referenceAnswer as string) || '';

  return (
    <>
      <Table.Tr style={{ opacity: isEditing ? 0.5 : 1, transition: 'opacity 0.15s ease' }}>
        <Table.Td>
          <Text size="sm" c="dimmed">{index + 1}</Text>
        </Table.Td>

        {docType === 'lecture' && (
          <>
            <Table.Td>
              <Text size="sm" fw={500} truncate>
                {(meta.title as string) || t.documentDetail.untitled}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {(meta.definition as string) || content}
              </Text>
            </Table.Td>
          </>
        )}

        {docType === 'exam' && (
          <>
            <Table.Td>
              {(meta.questionNumber as string) && (
                <Badge variant="filled" color="indigo" size="sm">
                  Q{meta.questionNumber as string}
                </Badge>
              )}
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {(meta.content as string) || content}
              </Text>
            </Table.Td>
            <Table.Td>
              {meta.score != null && (
                <Badge variant="light" color="orange" size="sm">
                  {String(meta.score)} pts
                </Badge>
              )}
            </Table.Td>
          </>
        )}

        {docType === 'assignment' && (
          <Table.Td>
            <Text size="sm" c="dimmed" lineClamp={2}>{content}</Text>
          </Table.Td>
        )}

        <Table.Td>
          <Group gap={4}>
            {docType === 'exam' && answer && (
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleAnswer}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ActionIcon>
            )}
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>

      {/* Expanded answer row (exam only) */}
      {docType === 'exam' && answer && isExpanded && !isEditing && (
        <Table.Tr>
          <Table.Td colSpan={colCount} p={0}>
            <Box px="md" py="sm" bg="var(--mantine-color-gray-0)">
              <Text size="xs" fw={600} mb={4}>{t.documentDetail.answer}</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{answer}</Text>
            </Box>
          </Table.Td>
        </Table.Tr>
      )}

      {/* Inline edit row */}
      {isEditing && (
        <Table.Tr>
          <Table.Td colSpan={colCount} p="md">
            <ChunkEditForm
              chunk={chunk}
              docType={docType}
              content={content}
              metadata={meta}
              onSave={onSave}
              onCancel={onCancel}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

/* ── Mobile row ── */

function MobileChunkRow({
  chunk,
  index,
  docType,
  isEditing,
  isExpanded,
  content,
  metadata: meta,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleAnswer,
}: {
  chunk: Chunk;
  index: number;
  docType: DocType;
  isEditing: boolean;
  isExpanded: boolean;
  content: string;
  metadata: Record<string, unknown>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (id: string, content: string, meta: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleAnswer: () => void;
}) {
  const { t } = useLanguage();
  const answer = (meta.answer as string) || (meta.referenceAnswer as string) || '';

  if (isEditing) {
    return (
      <ChunkEditForm
        chunk={chunk}
        docType={docType}
        content={content}
        metadata={meta}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  const title =
    docType === 'lecture'
      ? (meta.title as string) || t.documentDetail.untitled
      : docType === 'exam'
        ? `Q${(meta.questionNumber as string) || index + 1}`
        : `${t.documentDetail.chunk} ${index + 1}`;

  const preview =
    docType === 'lecture'
      ? (meta.definition as string) || content
      : (meta.content as string) || content;

  return (
    <Card withBorder radius="lg" p="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
            {title}
          </Text>
          <Group gap={4} wrap="nowrap">
            {docType === 'exam' && answer && (
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={onToggleAnswer}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ActionIcon>
            )}
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
              <Pencil size={14} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>
          {preview}
        </Text>
        {docType === 'exam' && meta.score != null && (
          <Badge variant="light" color="orange" size="xs">
            {String(meta.score)} pts
          </Badge>
        )}
        {docType === 'exam' && answer && (
          <Collapse in={isExpanded}>
            <Card bg="var(--mantine-color-gray-0)" p="sm" radius="sm">
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{answer}</Text>
            </Card>
          </Collapse>
        )}
      </Stack>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkTable.tsx
git commit -m "feat(rag): create ChunkTable component with doc_type-driven columns"
```

---

## Task 6: Create ChunkActionBar Component

Sticky footer showing pending changes count, Save Changes button, and Regenerate Embeddings button.

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/ChunkActionBar.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Group, Text } from '@mantine/core';
import {
  regenerateEmbeddings,
  updateDocumentChunks,
} from '@/app/actions/documents';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface ChunkActionBarProps {
  docId: string;
  pendingChanges: number;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedChunkIds: Set<string>;
  onSaved: () => void;
}

export function ChunkActionBar({
  docId,
  pendingChanges,
  editedChunks,
  deletedChunkIds,
  onSaved,
}: ChunkActionBarProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
        id,
        content: data.content,
        metadata: data.metadata,
      }));
      const result = await updateDocumentChunks(docId, updates, Array.from(deletedChunkIds));
      if (result.status === 'success') {
        showNotification({
          title: t.documentDetail.saved,
          message: result.message,
          color: 'green',
        });
        onSaved();
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
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateEmbeddings(docId);
      if (result.status === 'success') {
        showNotification({
          title: t.knowledge.success,
          message: result.message,
          color: 'green',
        });
      } else {
        showNotification({ title: t.knowledge.error, message: result.message, color: 'red' });
      }
    } catch {
      showNotification({
        title: t.knowledge.error,
        message: t.documentDetail.failedToRegenerate,
        color: 'red',
      });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card
      withBorder
      radius="lg"
      p="md"
      style={{ position: 'sticky', bottom: 0, zIndex: 10 }}
      bg="var(--mantine-color-body)"
    >
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {pendingChanges > 0
            ? `${pendingChanges} ${t.documentDetail.pendingChanges}`
            : t.documentDetail.noChanges}
        </Text>
        <Group gap="sm">
          <Button
            variant="light"
            color="gray"
            leftSection={<RefreshCw size={16} />}
            loading={regenerating}
            disabled={regenerating}
            onClick={handleRegenerate}
            radius="md"
          >
            {t.documentDetail.regenerateEmbeddings}
          </Button>
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
      </Group>
    </Card>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkActionBar.tsx
git commit -m "feat(rag): create ChunkActionBar sticky footer component"
```

---

## Task 7: Rewrite DocumentDetailClient + Update page.tsx

Replace the 1017-line monolith with a ~120-line container using ChatPageLayout pattern. Compose the sub-components from Tasks 3-6. Add mobile header injection via HeaderContext. Full i18n.

**Files:**

- Rewrite: `src/app/(protected)/knowledge/[id]/DocumentDetailClient.tsx`
- Modify: `src/app/(protected)/knowledge/[id]/page.tsx` (pass `docType`)

**Step 1: Rewrite DocumentDetailClient.tsx**

Replace the **entire file** with:

```typescript
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

  /* ── derived from document metadata ── */
  const docType: DocType = resolveDocType(doc.metadata);
  const school = metaStr(doc.metadata, 'school');
  const course = metaStr(doc.metadata, 'course');

  /* ── document name ── */
  const [currentName, setCurrentName] = useState(doc.name);

  /* ── chunk editing state ── */
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editedChunks, setEditedChunks] = useState<
    Map<string, { content: string; metadata: Record<string, unknown> }>
  >(new Map());
  const [deletedChunkIds, setDeletedChunkIds] = useState<Set<string>>(new Set());
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  /* ── derived ── */
  const visibleChunks = chunks.filter((c) => !deletedChunkIds.has(c.id));
  const pendingChanges =
    editedChunks.size + deletedChunkIds.size + (currentName !== doc.name ? 1 : 0);

  /* ── chunk helpers ── */
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

  /* ── Header (mirrors ChatPageLayout pattern) ── */
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

  /* ── Layout: 52px header + ScrollArea + sticky footer ── */
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
```

**Step 2: Update page.tsx**

The server component at `src/app/(protected)/knowledge/[id]/page.tsx` currently passes `document` and `chunks` to `DocumentDetailClient`. The props interface hasn't changed, so **no changes needed** to `page.tsx`. The `SerializedDocument` type is now imported from `./types` inside the client component, and the server-side serialization format already matches.

Verify that the server component's `serializedDoc` structure matches the `SerializedDocument` interface in `types.ts`:

- `id` ✓, `userId` ✓, `name` ✓, `status` ✓, `statusMessage` ✓, `metadata` ✓, `createdAt` ✓

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 4: Run lint**

Run: `npm run lint`
Expected: Pass (or only pre-existing warnings)

**Step 5: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/DocumentDetailClient.tsx
git commit -m "feat(rag): rewrite DocumentDetailClient with ChatPageLayout pattern and i18n"
```

---

## Task 8: Add Search Box to Knowledge List Page

Add a search input between the SegmentedControl and the drop bar. Client-side debounced filter on document name.

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Add import**

Add `useDebouncedValue` to the `@mantine/hooks` import, and `TextInput` to the `@mantine/core` import. Add `Search` to lucide-react imports.

```typescript
// In @mantine/core import, add TextInput:

// In lucide-react import, add Search:
import { BookOpen, FileText, Play, Search, Upload, X } from 'lucide-react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Progress,
  rem,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput, // ← add
} from '@mantine/core';
// In @mantine/hooks import, add useDebouncedValue:
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
```

**Step 2: Add search state**

Inside the `KnowledgeClient` component, after `const [activeTab, ...]` (around line 84), add:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
```

**Step 3: Derive filtered documents**

After the `documents` query (around line 95), add a `useMemo` for filtered docs:

```typescript
const filteredDocuments = useMemo(
  () =>
    debouncedSearch
      ? documents.filter((d) => d.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
      : documents,
  [documents, debouncedSearch],
);
```

Note: `useMemo` is already imported.

**Step 4: Add search input in JSX**

Between the `SegmentedControl` and the Upload Bar (`{/* ── Upload Bar */}`), add:

```tsx
{
  /* ── Search Box ── */
}
<TextInput
  placeholder={t.knowledge.searchDocuments}
  leftSection={<Search size={16} />}
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.currentTarget.value)}
  size="sm"
  radius="md"
/>;
```

**Step 5: Use `filteredDocuments` instead of `documents`**

In the document list section (around line 481), change from:

```tsx
<KnowledgeTable documents={documents} onDeleted={handleDocumentDeleted} />
```

to:

```tsx
<KnowledgeTable documents={filteredDocuments} onDeleted={handleDocumentDeleted} />
```

Also update the empty check:

```tsx
          ) : filteredDocuments.length > 0 ? (
```

**Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass

**Step 7: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "feat(rag): add search box to knowledge list page"
```

---

## Task 9: Add Sortable Headers to KnowledgeTable

Make Name and Date column headers clickable to toggle sort direction.

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx`

**Step 1: Add imports**

Add `ArrowDown`, `ArrowUp` to lucide-react imports. Add `useMemo` to React imports.

```typescript
import { AlertCircle, ArrowDown, ArrowUp, Eye, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
```

**Step 2: Add sort state and types**

Inside `KnowledgeTable`, before the existing state declarations, add:

```typescript
type SortField = 'name' | 'date' | null;
type SortDir = 'asc' | 'desc';

const [sortField, setSortField] = useState<SortField>('date');
const [sortDir, setSortDir] = useState<SortDir>('desc');

const toggleSort = (field: SortField) => {
  if (sortField === field) {
    if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      // Reset: desc → none
      setSortField(null);
    }
  } else {
    setSortField(field);
    setSortDir('asc');
  }
};

const sortedDocuments = useMemo(() => {
  if (!sortField) return documents;
  const sorted = [...documents].sort((a, b) => {
    if (sortField === 'name') {
      return a.name.localeCompare(b.name);
    }
    // date
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sortDir === 'desc' ? sorted.reverse() : sorted;
}, [documents, sortField, sortDir]);
```

**Step 3: Create SortIcon helper**

Add a small inline helper above the desktop table JSX:

```typescript
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ marginLeft: 4 }} />
    ) : (
      <ArrowDown size={12} style={{ marginLeft: 4 }} />
    );
  };
```

**Step 4: Make Name and Date headers clickable**

Replace the Name `Table.Th`:

```tsx
<Table.Th
  w="26%"
  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
  onClick={() => toggleSort('name')}
>
  <Group gap={2} wrap="nowrap">
    {t.knowledge.name}
    <SortIcon field="name" />
  </Group>
</Table.Th>
```

Replace the Date `Table.Th`:

```tsx
<Table.Th
  w="12%"
  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
  onClick={() => toggleSort('date')}
>
  <Group gap={2} wrap="nowrap">
    {t.knowledge.date}
    <SortIcon field="date" />
  </Group>
</Table.Th>
```

**Step 5: Use `sortedDocuments` in rendering**

Replace all instances of `documents.map(...)` with `sortedDocuments.map(...)` and `documents.length === 0` with `sortedDocuments.length === 0` in both mobile and desktop views.

In the mobile section:

```tsx
{sortedDocuments.length === 0 ? (
```

and:

```tsx
sortedDocuments.map((doc) => (
```

In the desktop table body:

```tsx
{sortedDocuments.map((doc) => (
```

and:

```tsx
{sortedDocuments.length === 0 && (
```

**Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass

**Step 7: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx
git commit -m "feat(rag): add sortable Name and Date headers to KnowledgeTable"
```

---

## Task 10: Add Skeleton Loading to Knowledge List

Replace the `<Loader size="sm" />` with skeleton rows matching the table/card layout.

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Add Skeleton import**

Add `Skeleton` to the `@mantine/core` import:

```typescript
import {
  // ... existing imports
  Skeleton,
  // ...
} from '@mantine/core';
```

**Step 2: Replace the loading section**

Find the loading section (around line 476):

```tsx
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
```

Replace with skeleton content:

```tsx
          {isLoading ? (
            isMobile ? (
              <Stack gap="sm">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={100} radius="lg" />
                ))}
              </Stack>
            ) : (
              <Skeleton height={200} radius="lg" />
            )
```

**Step 3: Clean up unused import**

Remove `Loader` from the `@mantine/core` import if it's no longer used elsewhere in the file (check first — it shouldn't be used elsewhere since this was the only usage).

**Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass

**Step 5: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "feat(rag): replace loading spinner with skeleton rows"
```

---

## Task 11: Add Empty State Guidance

Replace the plain "No documents" text with a larger icon + two-line message guiding users to the drop bar.

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Update the empty state section**

Find the current empty state (around line 482):

```tsx
          ) : (
            <Stack align="center" gap="xs" py="xl">
              <Text size="sm" c="dimmed">
                {t.knowledge.noDocuments}
              </Text>
            </Stack>
          )}
```

Replace with:

```tsx
          ) : (
            <Stack align="center" gap="xs" py={48}>
              <FileText size={40} color="var(--mantine-color-gray-4)" />
              <Text size="sm" fw={500} c="dimmed">
                {t.knowledge.noDocuments}
              </Text>
              <Text size="xs" c="dimmed">
                {t.knowledge.uploadGuide}
              </Text>
            </Stack>
          )}
```

Note: `FileText` is already imported from lucide-react in KnowledgeClient.

**Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "feat(rag): add empty state with icon and guidance text"
```

---

## Task 12: Upload Completion Guidance

After parsing completes, show a "View Details" link instead of auto-dismissing. The progress bar stays visible until manually dismissed or after an opacity fade.

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Remove auto-dismiss timer**

Find the auto-dismiss effect (around line 209):

```tsx
// Auto-dismiss progress bar 3s after completion
useEffect(() => {
  if (parseState.status === 'complete') {
    const timer = setTimeout(() => {
      handleDismissParse();
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [parseState.status, handleDismissParse]);
```

**Delete this entire `useEffect` block.** The progress bar should stay visible after completion until the user clicks dismiss or View Details.

**Step 2: Add "View Details" link**

In the inline progress bar section, find the dismiss button area for `complete` status (around line 448):

```tsx
{
  (parseState.status === 'complete' || parseState.status === 'error') && (
    <ActionIcon
      variant="subtle"
      color={parseState.status === 'complete' ? 'green' : 'red'}
      size="xs"
      onClick={handleDismissParse}
      aria-label="Dismiss"
    >
      <X size={12} />
    </ActionIcon>
  );
}
```

Replace with:

```tsx
{
  parseState.status === 'complete' && parseState.documentId && (
    <Group gap="xs" wrap="nowrap">
      <Button
        variant="subtle"
        color="indigo"
        size="compact-xs"
        onClick={() => {
          handleDismissParse();
          router.push(`/knowledge/${parseState.documentId}`);
        }}
      >
        {t.knowledge.viewDetailsLink}
      </Button>
      <ActionIcon
        variant="subtle"
        color="green"
        size="xs"
        onClick={handleDismissParse}
        aria-label="Dismiss"
      >
        <X size={12} />
      </ActionIcon>
    </Group>
  );
}
{
  parseState.status === 'error' && (
    <ActionIcon
      variant="subtle"
      color="red"
      size="xs"
      onClick={handleDismissParse}
      aria-label="Dismiss"
    >
      <X size={12} />
    </ActionIcon>
  );
}
```

**Step 3: Add router import**

Check if `useRouter` is already imported. If not, add:

```typescript
import { useRouter } from 'next/navigation';
```

And inside the component:

```typescript
const router = useRouter();
```

**Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: Pass

**Step 5: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "feat(rag): add View Details link after upload completion"
```

---

## Task 13: Final Build Verification

Run the full build to verify everything compiles and works together.

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: Pass with no errors

**Step 2: Lint**

Run: `npm run lint`
Expected: Pass

**Step 3: Build**

Run: `npm run build`
Expected: Build succeeds. Some pages may show warnings about missing env vars (Supabase, Stripe) which is expected in local dev.

**Step 4: Fix any issues**

If there are build failures, fix them. Common issues:

- Import order (Prettier auto-fixes via `npm run format`)
- Unused imports (remove them)
- Missing translation keys (add to both EN and ZH)
- Type mismatches between server component and client props

**Step 5: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(rag): resolve build issues from knowledge flow optimization"
```

---

## Summary

| Task | Description                  | Files                         | Depends On    |
| ---- | ---------------------------- | ----------------------------- | ------------- |
| 1    | i18n translation keys        | translations.ts               | —             |
| 2    | Shared types file            | [id]/types.ts                 | —             |
| 3    | DocumentDetailHeader         | [id]/DocumentDetailHeader.tsx | 1, 2          |
| 4    | ChunkEditForm                | [id]/ChunkEditForm.tsx        | 1, 2          |
| 5    | ChunkTable                   | [id]/ChunkTable.tsx           | 1, 2, 4       |
| 6    | ChunkActionBar               | [id]/ChunkActionBar.tsx       | 1             |
| 7    | Rewrite DocumentDetailClient | [id]/DocumentDetailClient.tsx | 2, 3, 4, 5, 6 |
| 8    | Search box                   | KnowledgeClient.tsx           | 1             |
| 9    | Sortable headers             | KnowledgeTable.tsx            | —             |
| 10   | Skeleton loading             | KnowledgeClient.tsx           | —             |
| 11   | Empty state                  | KnowledgeClient.tsx           | 1             |
| 12   | Upload completion guidance   | KnowledgeClient.tsx           | 1             |
| 13   | Final build verification     | —                             | All           |
