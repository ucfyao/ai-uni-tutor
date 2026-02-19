# Assignment Manual Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable manual assignment creation and item editing so users can create assignments without PDF upload, add items individually, and upload PDFs to append items to existing assignments.

**Architecture:** New `AssignmentService` orchestrates creation/item-add. New `assignments.ts` action file keeps assignment logic separate from `documents.ts`. Detail page gets a collapsible `AssignmentUploadArea` component and an "Add Item" button in the table toolbar. Parse route modified to append (not replace) with content deduplication.

**Tech Stack:** Next.js 16 App Router, Mantine v8, TanStack Query, Supabase, Gemini embeddings

---

### Task 1: Add `draft` to AssignmentStatus type

**Files:**

- Modify: `src/lib/domain/models/Assignment.ts:1` (AssignmentStatus type)
- Modify: `src/app/(protected)/admin/knowledge/[id]/types.ts:40-50` (statusColor function)

**Step 1: Update domain model**

In `src/lib/domain/models/Assignment.ts`, change:

```typescript
type AssignmentStatus = 'parsing' | 'ready' | 'error';
```

to:

```typescript
type AssignmentStatus = 'draft' | 'parsing' | 'ready' | 'error';
```

**Step 2: Add draft color to statusColor**

In `src/app/(protected)/admin/knowledge/[id]/types.ts`, add a `draft` case to `statusColor()`:

```typescript
export function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'green';
    case 'processing':
      return 'yellow';
    case 'draft':
      return 'gray';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/lib/domain/models/Assignment.ts src/app/\(protected\)/admin/knowledge/\[id\]/types.ts
git commit -m "feat(rag): add draft status to assignment model"
```

---

### Task 2: Add repository methods — `getMaxOrderNum` and `insertSingleItem`

**Files:**

- Modify: `src/lib/domain/interfaces/IAssignmentRepository.ts`
- Modify: `src/lib/repositories/AssignmentRepository.ts`

**Step 1: Add interface methods**

In `src/lib/domain/interfaces/IAssignmentRepository.ts`, add before the closing `}`:

```typescript
  getMaxOrderNum(assignmentId: string): Promise<number>;
  insertSingleItem(
    assignmentId: string,
    data: {
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      embedding?: number[] | null;
    },
  ): Promise<string>;
```

**Step 2: Implement `getMaxOrderNum` in AssignmentRepository**

Add after the `deleteItem` method:

```typescript
async getMaxOrderNum(assignmentId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assignment_items')
    .select('order_num')
    .eq('assignment_id', assignmentId)
    .order('order_num', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new DatabaseError('Failed to get max order_num', error);
  return data?.order_num ?? 0;
}
```

**Step 3: Implement `insertSingleItem` in AssignmentRepository**

Add after `getMaxOrderNum`:

```typescript
async insertSingleItem(
  assignmentId: string,
  data: {
    orderNum: number;
    type?: string;
    content: string;
    referenceAnswer?: string;
    explanation?: string;
    points?: number;
    difficulty?: string;
    embedding?: number[] | null;
  },
): Promise<string> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('assignment_items')
    .insert({
      assignment_id: assignmentId,
      order_num: data.orderNum,
      type: data.type || '',
      content: data.content,
      reference_answer: data.referenceAnswer || '',
      explanation: data.explanation || '',
      points: data.points || 0,
      difficulty: data.difficulty || '',
      metadata: {},
      embedding: data.embedding ?? null,
    })
    .select('id')
    .single();

  if (error || !row) throw new DatabaseError('Failed to insert assignment item', error);
  return row.id;
}
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/domain/interfaces/IAssignmentRepository.ts src/lib/repositories/AssignmentRepository.ts
git commit -m "feat(rag): add getMaxOrderNum and insertSingleItem to assignment repo"
```

---

### Task 3: Create `AssignmentService`

**Files:**

- Create: `src/lib/services/AssignmentService.ts`

**Step 1: Implement service**

```typescript
import type { AssignmentItemEntity } from '@/lib/domain/models/Assignment';

export class AssignmentService {
  async createEmpty(data: {
    userId: string;
    title: string;
    school: string | null;
    course: string | null;
    courseId: string;
  }): Promise<string> {
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const repo = getAssignmentRepository();
    return repo.create({
      userId: data.userId,
      title: data.title,
      school: data.school,
      course: data.course,
      courseId: data.courseId,
      status: 'draft',
    });
  }

  async addItem(
    assignmentId: string,
    data: {
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
    },
  ): Promise<{ id: string; orderNum: number }> {
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const repo = getAssignmentRepository();

    const maxOrder = await repo.getMaxOrderNum(assignmentId);
    const orderNum = maxOrder + 1;

    // Generate embedding
    let embedding: number[] | null = null;
    try {
      const { generateEmbeddingWithRetry } = await import('@/lib/rag/embedding');
      embedding = await generateEmbeddingWithRetry(`Question ${orderNum}: ${data.content}`);
    } catch (e) {
      console.error('Embedding generation failed for manual item:', e);
      // Continue without embedding — item still saves
    }

    const itemId = await repo.insertSingleItem(assignmentId, {
      orderNum,
      type: data.type,
      content: data.content,
      referenceAnswer: data.referenceAnswer,
      explanation: data.explanation,
      points: data.points,
      difficulty: data.difficulty,
      embedding,
    });

    return { id: itemId, orderNum };
  }
}

let _service: AssignmentService | null = null;

export function getAssignmentService(): AssignmentService {
  if (!_service) {
    _service = new AssignmentService();
  }
  return _service;
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/services/AssignmentService.ts
git commit -m "feat(rag): add AssignmentService with createEmpty and addItem"
```

---

### Task 4: Create `assignments.ts` server actions

**Files:**

- Create: `src/app/actions/assignments.ts`

**Step 1: Implement actions**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAnyAdmin, requireCourseAdmin } from '@/lib/supabase/server';

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  universityShortName: z.string().trim().max(100),
  courseCode: z.string().trim().max(100),
  courseId: z.string().uuid(),
});

const addItemSchema = z.object({
  assignmentId: z.string().uuid(),
  type: z.string().max(50).optional().default(''),
  content: z.string().trim().min(1),
  referenceAnswer: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  points: z.number().min(0).optional().default(0),
  difficulty: z.string().optional().default(''),
});

async function requireAssignmentAccess(assignmentId: string, role: string): Promise<void> {
  if (role === 'super_admin') return;
  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const repo = getAssignmentRepository();
  const courseId = await repo.findCourseId(assignmentId);
  if (courseId) {
    await requireCourseAdmin(courseId);
  } else {
    throw new Error('No access to this assignment');
  }
}

export async function createEmptyAssignment(
  input: z.input<typeof createSchema>,
): Promise<{ status: 'success' | 'error'; message: string; assignmentId?: string }> {
  try {
    const { user } = await requireAnyAdmin();
    const parsed = createSchema.parse(input);

    const { getAssignmentService } = await import('@/lib/services/AssignmentService');
    const service = getAssignmentService();

    const assignmentId = await service.createEmpty({
      userId: user.id,
      title: parsed.title,
      school: parsed.universityShortName || null,
      course: parsed.courseCode || null,
      courseId: parsed.courseId,
    });

    revalidatePath('/admin/knowledge');
    return { status: 'success', message: 'Assignment created', assignmentId };
  } catch (e) {
    console.error('createEmptyAssignment failed:', e);
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Failed to create assignment',
    };
  }
}

export async function addAssignmentItem(
  input: z.input<typeof addItemSchema>,
): Promise<{ status: 'success' | 'error'; message: string; itemId?: string }> {
  try {
    const { role } = await requireAnyAdmin();
    const parsed = addItemSchema.parse(input);

    await requireAssignmentAccess(parsed.assignmentId, role);

    const { getAssignmentService } = await import('@/lib/services/AssignmentService');
    const service = getAssignmentService();

    const result = await service.addItem(parsed.assignmentId, {
      type: parsed.type,
      content: parsed.content,
      referenceAnswer: parsed.referenceAnswer,
      explanation: parsed.explanation,
      points: parsed.points,
      difficulty: parsed.difficulty,
    });

    revalidatePath(`/admin/knowledge/${parsed.assignmentId}`);
    revalidatePath('/admin/knowledge');
    return { status: 'success', message: 'Item added', itemId: result.id };
  } catch (e) {
    console.error('addAssignmentItem failed:', e);
    return { status: 'error', message: e instanceof Error ? e.message : 'Failed to add item' };
  }
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/actions/assignments.ts
git commit -m "feat(rag): add createEmptyAssignment and addAssignmentItem server actions"
```

---

### Task 5: Add i18n keys

**Files:**

- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/zh.ts`

**Step 1: Add English keys**

In the `knowledge` section of `en.ts`, add:

```typescript
createAssignment: 'New Assignment',
assignmentTitle: 'Assignment Title',
createAssignmentSubmit: 'Create',
addItem: 'Add Item',
uploadPdfToImport: 'Upload PDF to import questions',
noItemsYet: 'No items yet. Upload a PDF or add items manually.',
questionType: 'Question Type',
questionTypes: {
  multiple_choice: 'Multiple Choice',
  short_answer: 'Short Answer',
  fill_in_blank: 'Fill in the Blank',
  true_false: 'True / False',
  essay: 'Essay',
},
```

**Step 2: Add Chinese keys**

In the `knowledge` section of `zh.ts`, add:

```typescript
createAssignment: '新建作业',
assignmentTitle: '作业标题',
createAssignmentSubmit: '创建',
addItem: '添加题目',
uploadPdfToImport: '上传 PDF 导入题目',
noItemsYet: '暂无题目，上传 PDF 或手动添加。',
questionType: '题型',
questionTypes: {
  multiple_choice: '选择题',
  short_answer: '简答题',
  fill_in_blank: '填空题',
  true_false: '判断题',
  essay: '论述题',
},
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (ensure both language objects match shape)

**Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/zh.ts
git commit -m "feat(ui): add i18n keys for assignment manual creation"
```

---

### Task 6: Create `AssignmentUploadArea` component

**Files:**

- Create: `src/components/rag/AssignmentUploadArea.tsx`

**Step 1: Implement component**

This component wraps a Mantine `Collapse` with a Dropzone + SSE parse progress. It reuses `useStreamingParse` from the existing codebase.

```typescript
'use client';

import { FileText, Play, Upload, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Progress,
  rem,
  Stack,
  Text,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { deleteDocument } from '@/app/actions/documents';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface AssignmentUploadAreaProps {
  assignmentId: string;
  school: string;
  course: string;
  courseId: string;
  itemCount: number;
  onParseComplete: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  parsing_pdf: 'indigo',
  extracting: 'blue',
  embedding: 'teal',
  complete: 'green',
  error: 'red',
};

function getProgressPercent(
  status: string,
  progress: { current: number; total: number },
  savedCount: number,
): number {
  if (status === 'complete') return 100;
  if (status === 'parsing_pdf') return 5;
  if (status === 'extracting') {
    const extractPct = progress.total > 0 ? progress.current / progress.total : 0;
    return 10 + extractPct * 55;
  }
  if (status === 'embedding') {
    const embedPct = progress.total > 0 ? savedCount / progress.total : 0;
    return 65 + embedPct * 35;
  }
  return 0;
}

export function AssignmentUploadArea({
  assignmentId,
  school,
  course,
  courseId,
  itemCount,
  onParseComplete,
}: AssignmentUploadAreaProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(itemCount === 0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const parseState = useStreamingParse();
  const isParsing = parseState.status !== 'idle';

  const handleStartParse = () => {
    if (!selectedFile) return;
    parseState.startParse(selectedFile, {
      docType: 'assignment',
      school,
      course,
      courseId,
      hasAnswers: false,
    });
  };

  const handleDismiss = useCallback(async () => {
    if (parseState.status === 'error' && parseState.documentId) {
      try {
        await deleteDocument(parseState.documentId, 'assignment');
      } catch {
        // Ignore
      }
    }
    setSelectedFile(null);
    parseState.reset();
    if (parseState.status === 'complete') {
      onParseComplete();
    }
  }, [parseState, onParseComplete]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Stack gap="xs">
      <Group
        gap="xs"
        style={{ cursor: 'pointer' }}
        onClick={() => !isParsing && setExpanded((v) => !v)}
      >
        <Text size="sm" fw={500} c="dimmed">
          {t.knowledge.uploadPdfToImport}
        </Text>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </Group>

      <Collapse in={expanded}>
        <Card withBorder radius="lg" p="md">
          {!isParsing ? (
            <Stack gap="sm">
              {/* Dropzone */}
              <Box
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  border: selectedFile
                    ? '1px solid var(--mantine-color-gray-3)'
                    : '1.5px dashed var(--mantine-color-gray-3)',
                  overflow: 'hidden',
                }}
              >
                {selectedFile ? (
                  <Group
                    gap="sm"
                    px="md"
                    py="sm"
                    style={{ background: 'var(--mantine-color-default-hover)' }}
                  >
                    <FileText size={16} color="var(--mantine-color-indigo-5)" />
                    <Text size="sm" fw={500} truncate style={{ flex: 1, minWidth: 0 }}>
                      {selectedFile.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(selectedFile.size)}
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X size={12} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Dropzone
                    onDrop={(files) => setSelectedFile(files[0])}
                    onReject={() =>
                      showNotification({
                        title: 'File rejected',
                        message: 'Please upload a valid PDF.',
                        color: 'red',
                      })
                    }
                    maxSize={
                      parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10') *
                      1024 *
                      1024
                    }
                    accept={PDF_MIME_TYPE}
                    multiple={false}
                    styles={{
                      root: {
                        border: 'none',
                        background: 'transparent',
                        '&:hover': {
                          background: 'var(--mantine-color-default-hover)',
                        },
                      },
                    }}
                  >
                    <Group
                      justify="center"
                      gap="sm"
                      style={{ minHeight: rem(60), pointerEvents: 'none' }}
                    >
                      <Upload
                        size={20}
                        color="var(--mantine-color-indigo-4)"
                        style={{ flexShrink: 0 }}
                      />
                      <Text size="sm" c="dimmed">
                        {t.knowledge.dropPdfHere}{' '}
                        <Text span c="indigo" fw={600}>
                          {t.knowledge.browse}
                        </Text>
                      </Text>
                    </Group>
                  </Dropzone>
                )}
              </Box>

              {/* Parse button */}
              <Button
                leftSection={<Play size={14} />}
                disabled={!selectedFile}
                onClick={handleStartParse}
                color="indigo"
                size="sm"
                radius="md"
                fullWidth
              >
                {t.knowledge.startParsing}
              </Button>
            </Stack>
          ) : (
            /* Progress view */
            <Stack gap="sm">
              <Text size="sm" fw={500} c={STAGE_COLORS[parseState.status]}>
                {parseState.status === 'parsing_pdf' && t.knowledge.parsingPdf}
                {parseState.status === 'extracting' && t.knowledge.extracting}
                {parseState.status === 'embedding' &&
                  `${t.knowledge.savingToDatabase.replace('...', '')} ${parseState.savedChunkIds.size}/${parseState.progress.total}`}
                {parseState.status === 'complete' &&
                  `${parseState.items.length} ${t.knowledge.questions}`}
                {parseState.status === 'error' &&
                  (parseState.error || t.knowledge.parsingError)}
              </Text>

              <Progress
                value={getProgressPercent(
                  parseState.status,
                  parseState.progress,
                  parseState.savedChunkIds.size,
                )}
                color={STAGE_COLORS[parseState.status] || 'indigo'}
                size="md"
                radius="xl"
                animated={
                  parseState.status !== 'complete' && parseState.status !== 'error'
                }
              />

              {(parseState.status === 'complete' || parseState.status === 'error') && (
                <Button
                  variant={parseState.status === 'error' ? 'light' : 'filled'}
                  color={parseState.status === 'error' ? 'red' : 'indigo'}
                  size="sm"
                  radius="md"
                  fullWidth
                  onClick={handleDismiss}
                >
                  {parseState.status === 'complete'
                    ? t.documentDetail.done
                    : t.knowledge.retryProcessing}
                </Button>
              )}
            </Stack>
          )}
        </Card>
      </Collapse>
    </Stack>
  );
}
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/rag/AssignmentUploadArea.tsx
git commit -m "feat(rag): add AssignmentUploadArea collapsible component"
```

---

### Task 7: Modify `KnowledgeClient` — Assignment tab uses lightweight creation modal

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx`

**Step 1: Add assignment creation state and modal**

Add new state variables near line 98:

```typescript
// Assignment creation modal state
const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
const [assignmentTitle, setAssignmentTitle] = useState('');
const [assignmentCreating, setAssignmentCreating] = useState(false);
```

**Step 2: Change "+" button behavior**

Replace the existing `onClick={() => setUploadModalOpen(true)}` on the `ActionIcon` (around line 395) with:

```typescript
onClick={() => {
  if (activeTab === 'assignment') {
    setAssignmentModalOpen(true);
  } else {
    setUploadModalOpen(true);
  }
}}
```

**Step 3: Add assignment creation handler**

Add a `handleCreateAssignment` function:

```typescript
const handleCreateAssignment = async () => {
  if (!assignmentTitle.trim() || !selectedUniId || !selectedCourseId) return;
  setAssignmentCreating(true);
  try {
    const { createEmptyAssignment } = await import('@/app/actions/assignments');
    const uniObj = universities.find((u) => u.id === selectedUniId);
    const courseObj = allCourses.find((c) => c.id === selectedCourseId);
    const result = await createEmptyAssignment({
      title: assignmentTitle.trim(),
      universityShortName: uniObj?.shortName ?? '',
      courseCode: courseObj?.code ?? '',
      courseId: selectedCourseId,
    });
    if (result.status === 'success' && result.assignmentId) {
      setAssignmentModalOpen(false);
      setAssignmentTitle('');
      router.push(`/admin/knowledge/${result.assignmentId}?type=assignment`);
    } else {
      showNotification({ title: 'Error', message: result.message, color: 'red' });
    }
  } finally {
    setAssignmentCreating(false);
  }
};
```

**Step 4: Add assignment creation modal JSX**

Add after the existing `FullScreenModal` (upload modal), before closing `</Box>`:

```tsx
{
  /* Assignment Creation Modal */
}
<FullScreenModal
  opened={assignmentModalOpen}
  onClose={() => {
    setAssignmentModalOpen(false);
    setAssignmentTitle('');
  }}
  title={t.knowledge.createAssignment}
  centered
  size="sm"
  radius="lg"
  overlayProps={{ backgroundOpacity: 0.3, blur: 8, color: '#1a1b1e' }}
  styles={{
    content: {
      border: '1px solid var(--mantine-color-default-border)',
      background: 'var(--mantine-color-body)',
    },
  }}
>
  <Stack gap="md">
    <TextInput
      label={t.knowledge.assignmentTitle}
      placeholder={t.knowledge.assignmentTitle}
      value={assignmentTitle}
      onChange={(e) => setAssignmentTitle(e.currentTarget.value)}
      size="sm"
      radius="md"
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCreateAssignment();
      }}
      autoFocus
    />
    <Select
      placeholder={t.knowledge.university}
      data={universities.map((u) => ({ value: u.id, label: u.name }))}
      value={selectedUniId}
      onChange={(val) => {
        setSelectedUniId(val);
        setSelectedCourseId(null);
      }}
      searchable
      size="sm"
      radius="md"
    />
    <Select
      placeholder={t.knowledge.course}
      data={filteredCourses.map((c) => ({
        value: c.id,
        label: `${c.code}: ${c.name}`,
      }))}
      value={selectedCourseId}
      onChange={setSelectedCourseId}
      disabled={!selectedUniId}
      searchable
      size="sm"
      radius="md"
    />
    <Button
      disabled={!assignmentTitle.trim() || !selectedUniId || !selectedCourseId}
      loading={assignmentCreating}
      onClick={handleCreateAssignment}
      color="indigo"
      size="md"
      radius="md"
      fullWidth
    >
      {t.knowledge.createAssignmentSubmit}
    </Button>
  </Stack>
</FullScreenModal>;
```

**Step 5: Add `TextInput` to imports if not already imported**

Ensure `TextInput` is in the Mantine imports (it already is at line 21).

**Step 6: Run type check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/\(protected\)/admin/knowledge/KnowledgeClient.tsx
git commit -m "feat(ui): add lightweight assignment creation modal in knowledge page"
```

---

### Task 8: Add "Add Item" button to `ChunkTable`

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/ChunkTable.tsx`

**Step 1: Add `onAddItem` prop**

Add to the ChunkTable props interface:

```typescript
onAddItem?: () => void;
```

**Step 2: Add button in toolbar**

In both mobile (line ~95) and desktop (line ~136) toolbar `<Group>`, add the "+" button next to the badge:

```tsx
<Group justify="space-between" align="center">
  <Group gap="sm">
    <Badge variant="filled" color="indigo" size="lg">
      {chunks.length} {countLabel}
    </Badge>
    {docType === 'assignment' && onAddItem && (
      <ActionIcon
        variant="light"
        color="indigo"
        size="lg"
        radius="xl"
        onClick={onAddItem}
        aria-label={t.knowledge.addItem}
      >
        <Plus size={16} />
      </ActionIcon>
    )}
  </Group>
  {selectedIds.size > 0 && (
    /* ... existing bulk delete ... */
  )}
</Group>
```

Add `Plus` to the lucide-react imports.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/\(protected\)/admin/knowledge/\[id\]/ChunkTable.tsx
git commit -m "feat(ui): add 'Add Item' button to assignment chunk table toolbar"
```

---

### Task 9: Add `type` field to `AssignmentEditForm`

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/ChunkEditForm.tsx`

**Step 1: Add question type dropdown**

In the `AssignmentEditForm` component, add a `type` state variable and a `Select` field for question type before the content textarea:

```typescript
const [itemType, setItemType] = useState((meta.itemType as string) || '');
```

Add a `Select` as the first field in the form Stack:

```tsx
<Select
  label={t.knowledge.questionType}
  placeholder={t.knowledge.questionType}
  data={[
    { value: 'multiple_choice', label: t.knowledge.questionTypes.multiple_choice },
    { value: 'short_answer', label: t.knowledge.questionTypes.short_answer },
    { value: 'fill_in_blank', label: t.knowledge.questionTypes.fill_in_blank },
    { value: 'true_false', label: t.knowledge.questionTypes.true_false },
    { value: 'essay', label: t.knowledge.questionTypes.essay },
  ]}
  value={itemType || null}
  onChange={(v) => setItemType(v || '')}
  clearable
  size="sm"
  radius="md"
/>
```

Update `handleSave` to include `itemType`:

```typescript
const updated: Record<string, unknown> = {
  ...meta,
  content,
  referenceAnswer,
  explanation,
  points: points ? Number(points) : 0,
  difficulty,
  itemType,
};
```

Add `Select` to the Mantine imports at the top of the file.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/\(protected\)/admin/knowledge/\[id\]/ChunkEditForm.tsx
git commit -m "feat(ui): add question type dropdown to assignment edit form"
```

---

### Task 10: Wire up `DocumentDetailClient` — upload area, add item, pass new props

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/DocumentDetailClient.tsx`
- Modify: `src/app/(protected)/admin/knowledge/[id]/page.tsx`

**Step 1: Add assignment metadata to SerializedDocument**

In `types.ts`, add optional fields to `SerializedDocument`:

```typescript
export interface SerializedDocument {
  id: string;
  userId: string;
  name: string;
  status: string;
  statusMessage: string | null;
  metadata: Json;
  docType: DocType;
  createdAt: string;
  // Assignment-specific metadata for upload area
  courseId?: string | null;
}
```

**Step 2: Pass `courseId` from page.tsx**

In `page.tsx`, line ~80 (assignment block), add `courseId` to `serializedDoc`:

```typescript
const serializedDoc: SerializedDocument = {
  id: assignment.id,
  userId: assignment.userId,
  name: assignment.title,
  status:
    assignment.status === 'parsing'
      ? 'processing'
      : assignment.status === 'draft'
        ? 'draft'
        : assignment.status,
  statusMessage: assignment.statusMessage,
  metadata: { school: assignment.school, course: assignment.course, doc_type: 'assignment' },
  docType: 'assignment',
  createdAt: assignment.createdAt,
  courseId: assignment.courseId,
};
```

**Step 3: Add upload area and add-item handler to DocumentDetailClient**

Import `AssignmentUploadArea` and `useRouter`:

```typescript
import { useRouter } from 'next/navigation';
import { AssignmentUploadArea } from '@/components/rag/AssignmentUploadArea';
```

Add router and new item handler inside the component:

```typescript
const router = useRouter();

const handleAddItem = useCallback(async () => {
  const { addAssignmentItem } = await import('@/app/actions/assignments');
  const result = await addAssignmentItem({
    assignmentId: doc.id,
    content: '',
    type: '',
  });
  if (result.status === 'success') {
    router.refresh();
  }
}, [doc.id, router]);
```

Wait — per the design, "Add Item" should add a local empty row and auto-enter edit mode, not immediately call the server action. Let me revise:

Instead of calling the server action, add local state for new items. Actually, looking at the existing pattern, the ChunkTable works with `Chunk[]` passed from the server page. The simplest approach that matches the existing edit-then-save pattern:

Add a `handleAddItem` that creates a temporary local chunk and adds it to a local additions list:

```typescript
const [addedChunks, setAddedChunks] = useState<Chunk[]>([]);

const handleAddItem = useCallback(() => {
  const tempId = `new-${Date.now()}`;
  const newChunk: Chunk = {
    id: tempId,
    content: '',
    metadata: {
      type: 'question',
      questionNumber: String(visibleChunks.length + addedChunks.length + 1),
      content: '',
      referenceAnswer: '',
      explanation: '',
      points: 0,
      difficulty: '',
      itemType: '',
    },
    embedding: null,
  };
  setAddedChunks((prev) => [...prev, newChunk]);
  setEditingChunkId(tempId);
}, [visibleChunks.length, addedChunks.length]);
```

Update `visibleChunks` to include added chunks:

```typescript
const allChunks = [...chunks.filter((c) => !deletedChunkIds.has(c.id)), ...addedChunks];
```

Update `pendingChanges` to count added chunks.

Update `ChunkActionBar` save logic: for items with `new-` prefix IDs, call `addAssignmentItem` instead of `updateAssignmentItems`. This requires modifying `ChunkActionBar`.

**This is getting complex — let's keep it simpler.** The "Add Item" button calls `addAssignmentItem` server action immediately with placeholder content, then `router.refresh()` reloads the page, and the new item auto-enters edit mode. This avoids local temp state.

Revised approach:

```typescript
const [newItemId, setNewItemId] = useState<string | null>(null);

const handleAddItem = useCallback(async () => {
  const { addAssignmentItem } = await import('@/app/actions/assignments');
  const result = await addAssignmentItem({
    assignmentId: doc.id,
    content: '(new item)',
    type: '',
  });
  if (result.status === 'success' && result.itemId) {
    setNewItemId(result.itemId);
    router.refresh();
  }
}, [doc.id, router]);
```

Then after refresh, auto-enter edit mode for the new item:

```typescript
useEffect(() => {
  if (newItemId && chunks.some((c) => c.id === newItemId)) {
    setEditingChunkId(newItemId);
    setNewItemId(null);
  }
}, [newItemId, chunks]);
```

**Step 4: Add AssignmentUploadArea above ChunkTable**

In the JSX, inside the `<Stack>` that wraps ChunkTable (line ~175), add before `<ChunkTable>`:

```tsx
{
  docType === 'assignment' && doc.courseId && (
    <AssignmentUploadArea
      assignmentId={doc.id}
      school={school}
      course={course}
      courseId={doc.courseId}
      itemCount={visibleChunks.length}
      onParseComplete={() => router.refresh()}
    />
  );
}
```

**Step 5: Pass `onAddItem` to ChunkTable**

```tsx
<ChunkTable
  chunks={visibleChunks}
  docType={docType}
  /* ...existing props... */
  onAddItem={docType === 'assignment' ? handleAddItem : undefined}
/>
```

**Step 6: Run type check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/app/\(protected\)/admin/knowledge/\[id\]/DocumentDetailClient.tsx src/app/\(protected\)/admin/knowledge/\[id\]/page.tsx src/app/\(protected\)/admin/knowledge/\[id\]/types.ts
git commit -m "feat(rag): wire up upload area and add-item in assignment detail page"
```

---

### Task 11: Modify parse route — append with deduplication

**Files:**

- Modify: `src/app/api/documents/parse/route.ts`

**Step 1: Before inserting assignment items, query existing items**

In the assignment processing block (around line 409), after getting `assignmentRepo`, add:

```typescript
// Get existing items for order offset and dedup
const existingItems = await assignmentRepo.findItemsByAssignmentId(effectiveRecordId);
const existingContents = new Set(existingItems.map((item) => item.content.trim().toLowerCase()));
const orderOffset =
  existingItems.length > 0 ? Math.max(...existingItems.map((item) => item.orderNum)) : 0;
```

**Step 2: Filter duplicates and adjust order numbers**

Replace the `assignmentItems` mapping:

```typescript
const assignmentItems = items
  .map((item, idx) => {
    const q = item.data as ParsedQuestion;
    return {
      assignmentId: effectiveRecordId,
      orderNum: 0, // placeholder, assigned after dedup
      type: '',
      content: q.content,
      referenceAnswer: q.referenceAnswer || '',
      explanation: '',
      points: q.score || 0,
      difficulty: '',
      metadata: { sourcePage: q.sourcePage },
    };
  })
  .filter((item) => !existingContents.has(item.content.trim().toLowerCase()));

// Assign sequential order numbers after offset
assignmentItems.forEach((item, idx) => {
  item.orderNum = orderOffset + idx + 1;
});
```

**Step 3: Guard empty items array**

After dedup filtering, if no new items remain, skip embedding and insertion:

```typescript
if (assignmentItems.length === 0) {
  send('status', { stage: 'embedding', message: 'No new items to add (all duplicates)' });
  await assignmentRepo.updateStatus(effectiveRecordId, 'ready');
  // skip to complete
} else {
  // ... existing embedding + insert logic
}
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/documents/parse/route.ts
git commit -m "feat(rag): append parsed items with content dedup in assignment parse route"
```

---

### Task 12: Verify, lint, build

**Step 1: Run full lint**

Run: `npm run lint`
Expected: PASS

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS (existing tests should not break)

**Step 5: Format**

Run: `npm run format`

**Step 6: Final commit if any format changes**

```bash
git add -A
git commit -m "style(rag): format assignment manual creation code"
```

---

### Task 13: Create PR

**Step 1: Push branch**

```bash
git push -u origin feature/assignment-manual-creation
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(rag): assignment manual creation & enhanced editing" --body "$(cat <<'EOF'
## Summary
- Add lightweight creation modal for assignments (title + course → redirect to detail page)
- Add collapsible upload area on assignment detail page (default expanded when empty)
- Add "Add Item" button to manually add assignment items with question type selection
- Parse route appends items with content-based deduplication
- New `AssignmentService` + `assignments.ts` server actions following existing architecture

## Test plan
- [ ] Create new assignment via lightweight modal → verify redirect to detail page
- [ ] Upload PDF on empty assignment → verify items populate
- [ ] Upload same PDF again → verify no duplicate items added
- [ ] Manually add item via "+" button → verify edit form opens, item saves with embedding
- [ ] Edit and delete items → verify save works correctly
- [ ] Verify Lecture and Exam flows are unchanged
- [ ] Check mobile responsive layout

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
