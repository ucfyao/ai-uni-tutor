# Knowledge Page Notion-Style Interaction Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the knowledge page from a simple doc-type-tabbed list into a Notion-style database view with search, compound filters, sorting, row selection, batch operations, inline progress, and a modal upload flow.

**Architecture:** Keep existing backend (server actions → services → repositories → Supabase) untouched except adding `fetchAllDocuments` and `batchDeleteDocuments` actions. All filtering/sorting/search is client-side via `useMemo`. New components: `KnowledgeFilterBar`, `UploadModal`, `BulkActionToolbar`, `InlineProgress`. Modify `KnowledgeClient` and `KnowledgeTable` to support selection, inline progress, and sortable columns. Remove `ParsePanel`, `ParseTimeline`, `ParsedItemCard` (progress moves inline).

**Tech Stack:** Next.js 16 (App Router), React 19, Mantine v8, TanStack Query, Lucide icons, Vitest for tests

**Design doc:** `docs/plans/2026-02-15-knowledge-page-notion-redesign.md`

---

### Task 1: Add `fetchAllDocuments` Server Action + Service Method

**Files:**

- Modify: `src/lib/services/DocumentService.ts:28-30` (add `getAllDocuments` method)
- Modify: `src/app/actions/documents.ts:28-49` (add `fetchAllDocuments` action)
- Test: `src/lib/services/DocumentService.test.ts` (add test)
- Test: `src/app/actions/documents.test.ts` (add test)

**Step 1: Write failing test for DocumentService.getAllDocuments**

Add to `src/lib/services/DocumentService.test.ts`:

```typescript
describe('getAllDocuments', () => {
  it('returns all documents for user without type filter', async () => {
    const docs = [
      makeDocEntity({ docType: 'lecture' }),
      makeDocEntity({ id: 'doc-2', docType: 'exam' }),
    ];
    mockDocRepo.findByUserId.mockResolvedValue(docs);

    const result = await service.getAllDocuments('user-1');

    expect(mockDocRepo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(docs);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/DocumentService.test.ts`
Expected: FAIL — `service.getAllDocuments is not a function`

**Step 3: Add `getAllDocuments` to DocumentService**

In `src/lib/services/DocumentService.ts`, add after line 30:

```typescript
async getAllDocuments(userId: string): Promise<DocumentEntity[]> {
  return this.docRepo.findByUserId(userId);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/DocumentService.test.ts`
Expected: PASS

**Step 5: Write failing test for fetchAllDocuments server action**

Add to `src/app/actions/documents.test.ts`:

```typescript
describe('fetchAllDocuments', () => {
  it('returns all documents for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    const entities: DocumentEntity[] = [
      makeDocEntity({ docType: 'lecture' }),
      makeDocEntity({ id: 'doc-2', docType: 'exam' }),
    ];
    mockDocumentService.getAllDocuments = vi.fn().mockResolvedValue(entities);

    const { fetchAllDocuments } = await import('./documents');
    const result = await fetchAllDocuments();

    expect(result).toHaveLength(2);
    expect(result[0].doc_type).toBe('lecture');
    expect(result[1].doc_type).toBe('exam');
  });

  it('throws when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { fetchAllDocuments } = await import('./documents');
    await expect(fetchAllDocuments()).rejects.toThrow('Unauthorized');
  });
});
```

**Step 6: Run test to verify it fails**

Run: `npx vitest run src/app/actions/documents.test.ts`
Expected: FAIL — `fetchAllDocuments is not exported`

**Step 7: Add `fetchAllDocuments` server action**

In `src/app/actions/documents.ts`, add after the existing `fetchDocuments` function (after line 49):

```typescript
export async function fetchAllDocuments(): Promise<DocumentListItem[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const service = getDocumentService();
  const entities = await service.getAllDocuments(user.id);

  return entities.map((doc) => ({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    status_message: doc.statusMessage,
    created_at: doc.createdAt.toISOString(),
    doc_type: doc.docType ?? 'lecture',
    metadata:
      doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as DocumentListItem['metadata'])
        : null,
  }));
}
```

Also add `getAllDocuments` to the `mockDocumentService` object in the test file.

**Step 8: Run tests to verify they pass**

Run: `npx vitest run src/app/actions/documents.test.ts`
Expected: PASS

**Step 9: Commit**

```bash
git add src/lib/services/DocumentService.ts src/lib/services/DocumentService.test.ts src/app/actions/documents.ts src/app/actions/documents.test.ts
git commit -m "feat(rag): add fetchAllDocuments server action and service method"
```

---

### Task 2: Add `batchDeleteDocuments` Server Action

**Files:**

- Modify: `src/lib/services/DocumentService.ts` (add `batchDelete` method)
- Modify: `src/app/actions/documents.ts` (add `batchDeleteDocuments` action)
- Test: `src/lib/services/DocumentService.test.ts` (add test)
- Test: `src/app/actions/documents.test.ts` (add test)

**Step 1: Write failing test for DocumentService.batchDelete**

```typescript
describe('batchDelete', () => {
  it('deletes multiple documents owned by user', async () => {
    mockDocRepo.verifyOwnership.mockResolvedValue(true);
    mockDocRepo.delete.mockResolvedValue(undefined);

    await service.batchDelete(['doc-1', 'doc-2'], 'user-1');

    expect(mockDocRepo.verifyOwnership).toHaveBeenCalledTimes(2);
    expect(mockDocRepo.delete).toHaveBeenCalledTimes(2);
  });

  it('throws ForbiddenError when user does not own a document', async () => {
    mockDocRepo.verifyOwnership.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(service.batchDelete(['doc-1', 'doc-2'], 'user-1')).rejects.toThrow(ForbiddenError);
  });
});
```

**Step 2: Run test to verify failure**

Run: `npx vitest run src/lib/services/DocumentService.test.ts`

**Step 3: Implement `batchDelete` in DocumentService**

```typescript
async batchDelete(docIds: string[], userId: string): Promise<number> {
  let deletedCount = 0;
  for (const id of docIds) {
    const isOwner = await this.docRepo.verifyOwnership(id, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this document');
    await this.docRepo.delete(id, userId);
    deletedCount++;
  }
  return deletedCount;
}
```

**Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/services/DocumentService.test.ts`

**Step 5: Write failing test for batchDeleteDocuments action**

```typescript
describe('batchDeleteDocuments', () => {
  it('batch deletes documents for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockDocumentService.batchDelete = vi.fn().mockResolvedValue(2);

    const { batchDeleteDocuments } = await import('./documents');
    const result = await batchDeleteDocuments(['doc-1', 'doc-2']);

    expect(result).toEqual({ status: 'success', message: expect.any(String), deletedCount: 2 });
  });

  it('returns error when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { batchDeleteDocuments } = await import('./documents');
    const result = await batchDeleteDocuments(['doc-1']);

    expect(result.status).toBe('error');
  });
});
```

**Step 6: Run test to verify failure**

Run: `npx vitest run src/app/actions/documents.test.ts`

**Step 7: Implement `batchDeleteDocuments` action**

```typescript
export async function batchDeleteDocuments(
  ids: string[],
): Promise<{ status: 'success' | 'error'; message: string; deletedCount: number }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized', deletedCount: 0 };

  if (!ids.length) return { status: 'error', message: 'No document IDs provided', deletedCount: 0 };

  try {
    const service = getDocumentService();
    const deletedCount = await service.batchDelete(ids, user.id);
    revalidatePath('/knowledge');
    return { status: 'success', message: `${deletedCount} document(s) deleted`, deletedCount };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to delete documents';
    return { status: 'error', message: msg, deletedCount: 0 };
  }
}
```

**Step 8: Run tests**

Run: `npx vitest run src/app/actions/documents.test.ts`

**Step 9: Commit**

```bash
git add src/lib/services/DocumentService.ts src/lib/services/DocumentService.test.ts src/app/actions/documents.ts src/app/actions/documents.test.ts
git commit -m "feat(rag): add batchDeleteDocuments server action"
```

---

### Task 3: Add i18n Keys for New UI Elements

**Files:**

- Modify: `src/i18n/translations.ts:201-259` (zh knowledge section) and `src/i18n/translations.ts:575-633` (en knowledge section)

**Step 1: Add new i18n keys**

Add the following keys to BOTH `zh.knowledge` and `en.knowledge` sections:

**English (after `confirmDeleteSuffix` ~line 632):**

```typescript
// Filter bar
searchPlaceholder: 'Search documents...',
allTypes: 'All types',
allUniversities: 'All universities',
allCourses: 'All courses',
allStatuses: 'All statuses',
sortBy: 'Sort',
newestFirst: 'Newest first',
oldestFirst: 'Oldest first',
nameAZ: 'Name A-Z',
nameZA: 'Name Z-A',
clearFilters: 'Clear filters',
// Batch operations
nSelected: 'selected',
batchDelete: 'Delete selected',
batchReprocess: 'Re-process selected',
clearSelection: 'Clear',
batchDeleteConfirm: 'Delete selected documents?',
batchDeleteConfirmMessage: 'This will permanently delete the selected documents. This action cannot be undone.',
// Upload modal
uploadTitle: 'Upload Document',
docType: 'Type',
uploadButton: 'Upload',
// Inline progress
processingProgress: 'Processing',
// Document count
documentCount: 'documents',
```

**Chinese (after `confirmDeleteSuffix` ~line 258):**

```typescript
searchPlaceholder: '搜索文档...',
allTypes: '所有类型',
allUniversities: '所有大学',
allCourses: '所有课程',
allStatuses: '所有状态',
sortBy: '排序',
newestFirst: '最新优先',
oldestFirst: '最早优先',
nameAZ: '名称 A-Z',
nameZA: '名称 Z-A',
clearFilters: '清除筛选',
nSelected: '已选中',
batchDelete: '批量删除',
batchReprocess: '批量重新处理',
clearSelection: '清除',
batchDeleteConfirm: '删除选中的文档？',
batchDeleteConfirmMessage: '这将永久删除选中的文档。此操作不可撤销。',
uploadTitle: '上传文档',
docType: '类型',
uploadButton: '上传',
processingProgress: '处理中',
documentCount: '个文档',
```

**Step 2: Run type check to verify no errors**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n keys for knowledge page redesign"
```

---

### Task 4: Update Server Page to Fetch All Documents

**Files:**

- Modify: `src/app/(protected)/knowledge/page.tsx`

**Step 1: Update page.tsx to fetch all documents instead of by type**

Replace the current fetch logic. The server page should call `service.getAllDocuments(user.id)` and pass them as `initialDocuments` to the client. Remove the `initialDocType` prop since we no longer filter by type on the server.

```typescript
// Replace line 37-38:
// const service = getDocumentService();
// const entities = await service.getDocumentsByType(user.id, DEFAULT_DOC_TYPE);
// With:
const service = getDocumentService();
const entities = await service.getAllDocuments(user.id);
```

Remove `DEFAULT_DOC_TYPE` constant. Update the `KnowledgeClient` component props — remove `initialDocType`:

```tsx
<KnowledgeClient initialDocuments={initialDocuments} />
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: Errors in `KnowledgeClient` (props changed) — that's fine, we'll fix in Task 5.

**Step 3: Commit**

```bash
git add src/app/(protected)/knowledge/page.tsx
git commit -m "refactor(rag): fetch all documents in knowledge server page"
```

---

### Task 5: Create `KnowledgeFilterBar` Component

**Files:**

- Create: `src/components/rag/KnowledgeFilterBar.tsx`

**Step 1: Create the filter bar component**

This component renders:

- Search input (with debounce)
- Type filter dropdown (multi-select chips)
- University filter dropdown
- Course filter dropdown (cascades from university if data allows)
- Status filter dropdown
- Sort dropdown
- Active filter chips with clear buttons

```typescript
'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  Select,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { DOC_TYPES } from '@/constants/doc-types';
import { useLanguage } from '@/i18n/LanguageContext';

export type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

export interface FilterState {
  search: string;
  docType: string | null;     // null = all
  university: string | null;  // null = all
  course: string | null;      // null = all
  status: string | null;      // null = all
  sort: SortOption;
}

interface KnowledgeFilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  universities: string[];     // Unique university names from documents
  courses: string[];          // Unique course names from documents
}

export const INITIAL_FILTERS: FilterState = {
  search: '',
  docType: null,
  university: null,
  course: null,
  status: null,
  sort: 'newest',
};

export function KnowledgeFilterBar({
  filters,
  onFiltersChange,
  universities,
  courses,
}: KnowledgeFilterBarProps) {
  const { t } = useLanguage();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange],
  );

  const hasActiveFilters =
    filters.search || filters.docType || filters.university || filters.course || filters.status;

  const clearAll = () => {
    setSearchInput('');
    onFiltersChange(INITIAL_FILTERS);
  };

  const sortOptions = [
    { value: 'newest', label: t.knowledge.newestFirst },
    { value: 'oldest', label: t.knowledge.oldestFirst },
    { value: 'name-asc', label: t.knowledge.nameAZ },
    { value: 'name-desc', label: t.knowledge.nameZA },
  ];

  const typeOptions = [
    { value: '', label: t.knowledge.allTypes },
    ...DOC_TYPES.map((dt) => ({ value: dt.value, label: dt.label })),
  ];

  const statusOptions = [
    { value: '', label: t.knowledge.allStatuses },
    { value: 'ready', label: t.knowledge.ready },
    { value: 'processing', label: t.knowledge.processing },
    { value: 'error', label: t.knowledge.error },
  ];

  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder={t.knowledge.searchPlaceholder}
        leftSection={<Search size={16} />}
        value={searchInput}
        onChange={(e) => setSearchInput(e.currentTarget.value)}
        rightSection={
          searchInput ? (
            <ActionIcon variant="subtle" size="sm" onClick={() => setSearchInput('')}>
              <X size={14} />
            </ActionIcon>
          ) : null
        }
        style={{ flex: 1, minWidth: 200 }}
        radius="md"
      />

      <Select
        data={typeOptions}
        value={filters.docType ?? ''}
        onChange={(v) => updateFilter('docType', v || null)}
        leftSection={<SlidersHorizontal size={14} />}
        radius="md"
        w={140}
        comboboxProps={{ withinPortal: true }}
      />

      {universities.length > 0 && (
        <Select
          data={[
            { value: '', label: t.knowledge.allUniversities },
            ...universities.map((u) => ({ value: u, label: u })),
          ]}
          value={filters.university ?? ''}
          onChange={(v) => updateFilter('university', v || null)}
          radius="md"
          w={160}
          comboboxProps={{ withinPortal: true }}
        />
      )}

      {courses.length > 0 && (
        <Select
          data={[
            { value: '', label: t.knowledge.allCourses },
            ...courses.map((c) => ({ value: c, label: c })),
          ]}
          value={filters.course ?? ''}
          onChange={(v) => updateFilter('course', v || null)}
          radius="md"
          w={140}
          comboboxProps={{ withinPortal: true }}
        />
      )}

      <Select
        data={statusOptions}
        value={filters.status ?? ''}
        onChange={(v) => updateFilter('status', v || null)}
        radius="md"
        w={130}
        comboboxProps={{ withinPortal: true }}
      />

      <Select
        data={sortOptions}
        value={filters.sort}
        onChange={(v) => updateFilter('sort', (v as SortOption) ?? 'newest')}
        radius="md"
        w={140}
        comboboxProps={{ withinPortal: true }}
      />

      {hasActiveFilters && (
        <Badge
          variant="light"
          color="gray"
          rightSection={
            <ActionIcon variant="transparent" size="xs" onClick={clearAll}>
              <X size={12} />
            </ActionIcon>
          }
          style={{ cursor: 'pointer' }}
          onClick={clearAll}
        >
          {t.knowledge.clearFilters}
        </Badge>
      )}
    </Group>
  );
}
```

**Step 2: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Commit**

```bash
git add src/components/rag/KnowledgeFilterBar.tsx
git commit -m "feat(ui): create KnowledgeFilterBar component"
```

---

### Task 6: Create `UploadModal` Component

**Files:**

- Create: `src/components/rag/UploadModal.tsx`

**Step 1: Create the upload modal component**

This modal replaces the inline collapsible upload panel. Contains: dropzone, doc type select, university select, course select, submit button.

```typescript
'use client';

import { FileText, Play, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { Dropzone, PDF_MIME_TYPE } from '@mantine/dropzone';
import { DOC_TYPES } from '@/constants/doc-types';
import { COURSES, UNIVERSITIES } from '@/constants/index';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';

interface UploadModalProps {
  opened: boolean;
  onClose: () => void;
  onUpload: (file: File, metadata: { docType: string; school: string; course: string }) => void;
}

export function UploadModal({ opened, onClose, onUpload }: UploadModalProps) {
  const { t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('lecture');
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const filteredCourses = selectedUniId
    ? COURSES.filter((c) => c.universityId === selectedUniId)
    : [];

  const isFormValid = selectedFile && selectedUniId && selectedCourseId;

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setDocType('lecture');
    setSelectedUniId(null);
    setSelectedCourseId(null);
  }, []);

  const handleSubmit = () => {
    if (!selectedFile || !selectedUniId || !selectedCourseId) return;

    const uniObj = UNIVERSITIES.find((u) => u.id === selectedUniId);
    const courseObj = COURSES.find((c) => c.id === selectedCourseId);

    onUpload(selectedFile, {
      docType,
      school: uniObj?.shortName ?? '',
      course: courseObj?.code ?? '',
    });

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t.knowledge.uploadTitle}
      centered
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        {/* File zone */}
        {selectedFile ? (
          <Group
            gap="sm"
            p="sm"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              background: 'var(--mantine-color-body)',
              border: '1px solid var(--mantine-color-gray-2)',
            }}
          >
            <FileText size={18} color="var(--mantine-color-indigo-5)" />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {selectedFile.name}
              </Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(selectedFile.size)}
              </Text>
            </Box>
            <Tooltip label={t.knowledge.replaceFile}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                <X size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : (
          <Dropzone
            onDrop={(files) => setSelectedFile(files[0])}
            onReject={() =>
              showNotification({
                title: 'File rejected',
                message: `Please upload a valid PDF less than ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB.`,
                color: 'red',
              })
            }
            maxSize={parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5') * 1024 * 1024}
            accept={PDF_MIME_TYPE}
            multiple={false}
            styles={{
              root: {
                borderStyle: 'dashed',
                borderWidth: 1.5,
                borderColor: 'var(--mantine-color-gray-3)',
                background: 'transparent',
                transition: 'all 0.15s ease',
              },
            }}
          >
            <Stack align="center" gap="xs" py="md" style={{ pointerEvents: 'none' }}>
              <FileText size={32} color="var(--mantine-color-indigo-4)" />
              <Text size="sm" fw={500} c="dimmed">
                {t.knowledge.dropPdfHere}{' '}
                <Text span c="indigo" fw={600}>
                  {t.knowledge.browse}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {t.knowledge.upToSize} {process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || 5}MB
              </Text>
            </Stack>
          </Dropzone>
        )}

        {/* Metadata */}
        <Select
          label={t.knowledge.docType}
          data={DOC_TYPES.map((dt) => ({ value: dt.value, label: dt.label }))}
          value={docType}
          onChange={(v) => setDocType(v ?? 'lecture')}
          radius="md"
        />

        <Select
          label={t.knowledge.university}
          placeholder="Select"
          data={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
          value={selectedUniId}
          onChange={(val) => {
            setSelectedUniId(val);
            setSelectedCourseId(null);
          }}
          searchable
          radius="md"
        />

        <Select
          label={t.knowledge.course}
          placeholder={selectedUniId ? 'Select' : 'University first'}
          data={filteredCourses.map((c) => ({
            value: c.id,
            label: `${c.code}: ${c.name}`,
          }))}
          value={selectedCourseId}
          onChange={setSelectedCourseId}
          disabled={!selectedUniId}
          searchable
          radius="md"
        />

        {/* Actions */}
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={handleClose} radius="md">
            {t.knowledge.cancel}
          </Button>
          <Button
            leftSection={<Play size={14} />}
            disabled={!isFormValid}
            onClick={handleSubmit}
            color="indigo"
            radius="md"
          >
            {t.knowledge.uploadButton}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

**Step 2: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Commit**

```bash
git add src/components/rag/UploadModal.tsx
git commit -m "feat(ui): create UploadModal component for knowledge page"
```

---

### Task 7: Create `BulkActionToolbar` Component

**Files:**

- Create: `src/components/rag/BulkActionToolbar.tsx`

**Step 1: Create the toolbar component**

```typescript
'use client';

import { RefreshCw, Trash2, X } from 'lucide-react';
import { ActionIcon, Badge, Button, Group, Paper, Text, Transition } from '@mantine/core';
import { useLanguage } from '@/i18n/LanguageContext';

interface BulkActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onReprocess: () => void;
  onClear: () => void;
  isDeleting?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onDelete,
  onReprocess,
  onClear,
  isDeleting,
}: BulkActionToolbarProps) {
  const { t } = useLanguage();

  return (
    <Transition mounted={selectedCount > 0} transition="slide-down" duration={200}>
      {(styles) => (
        <Paper
          p="xs"
          px="md"
          radius="lg"
          withBorder
          style={{
            ...styles,
            borderColor: 'var(--mantine-color-indigo-2)',
            background: 'var(--mantine-color-indigo-0)',
          }}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <Badge color="indigo" variant="filled" size="lg">
                {selectedCount}
              </Badge>
              <Text size="sm" fw={500}>
                {t.knowledge.nSelected}
              </Text>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={<Trash2 size={14} />}
                onClick={onDelete}
                loading={isDeleting}
                radius="md"
              >
                {t.knowledge.batchDelete}
              </Button>
              <Button
                variant="light"
                color="orange"
                size="xs"
                leftSection={<RefreshCw size={14} />}
                onClick={onReprocess}
                radius="md"
              >
                {t.knowledge.batchReprocess}
              </Button>
              <ActionIcon variant="subtle" color="gray" onClick={onClear}>
                <X size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      )}
    </Transition>
  );
}
```

**Step 2: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Commit**

```bash
git add src/components/rag/BulkActionToolbar.tsx
git commit -m "feat(ui): create BulkActionToolbar component"
```

---

### Task 8: Update `KnowledgeTable` with Checkboxes, Sortable Headers, Inline Progress

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx`
- Modify: `src/components/rag/KnowledgeTable.module.css`

This is the largest UI change. The table needs:

1. Checkbox column (left-most)
2. Sortable column headers with arrow icons
3. Inline progress bar for `processing` status
4. Updated props interface to accept `selectedIds`, `onSelectionChange`, `sort`, `onSortChange`

**Step 1: Update KnowledgeTable interface and add selection + sort props**

Update `KnowledgeTableProps`:

```typescript
import type { SortOption } from './KnowledgeFilterBar';

interface KnowledgeTableProps {
  documents: KnowledgeDocument[];
  readOnly?: boolean;
  onDeleted?: (id: string) => void;
  // New props for Notion-style features
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}
```

**Step 2: Add checkbox column to desktop table**

Add a `Checkbox` column as the first column in both `Table.Thead` and `Table.Tbody`. Header checkbox toggles select-all for visible rows. Row checkboxes toggle individual selection.

**Step 3: Add inline progress for processing status**

Replace the processing Badge with a Mantine `Progress` bar + text:

```typescript
import { Checkbox, Progress } from '@mantine/core';

// In renderStatusBadge:
if (doc.status === 'processing') {
  const pct = doc.status_message?.match(/(\d+)%/)?.[1];
  const percent = pct ? parseInt(pct) : undefined;
  return (
    <Group gap="xs" wrap="nowrap">
      {percent !== undefined ? (
        <>
          <Progress value={percent} size={6} color="indigo" style={{ flex: 1, minWidth: 60 }} />
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{percent}%</Text>
        </>
      ) : (
        <Badge color="blue" variant="dot" size="sm">
          {doc.status_message || t.knowledge.processing}
        </Badge>
      )}
    </Group>
  );
}
```

**Step 4: Add checkbox to mobile cards**

Add `Checkbox` to the left side of each mobile card.

**Step 5: Update CSS module**

Add styles for the checkbox column and sortable headers to `KnowledgeTable.module.css`.

**Step 6: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 7: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx src/components/rag/KnowledgeTable.module.css
git commit -m "feat(ui): add selection, inline progress, sortable headers to KnowledgeTable"
```

---

### Task 9: Rewrite `KnowledgeClient` — Main Orchestrator

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

This is the core rewiring. The client component needs to:

1. Remove `mode` state (no more list/parsing toggle)
2. Remove collapsible upload area
3. Use `fetchAllDocuments` + client-side filtering
4. Add filter state, selection state, upload modal state
5. Compose `KnowledgeFilterBar`, `BulkActionToolbar`, `UploadModal`, `KnowledgeTable`
6. Derive filtered/sorted documents via `useMemo`
7. Extract unique universities/courses from documents for filter dropdowns
8. Wire up batch delete via `batchDeleteDocuments`
9. Wire up upload via `useStreamingParse` with inline progress

**Step 1: Rewrite KnowledgeClient**

Key structure:

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { batchDeleteDocuments, fetchAllDocuments } from '@/app/actions/documents';
import { BulkActionToolbar } from '@/components/rag/BulkActionToolbar';
import { KnowledgeFilterBar, INITIAL_FILTERS, type FilterState, type SortOption } from '@/components/rag/KnowledgeFilterBar';
import { KnowledgeTable, type KnowledgeDocument } from '@/components/rag/KnowledgeTable';
import { UploadModal } from '@/components/rag/UploadModal';
import { useStreamingParse } from '@/hooks/useStreamingParse';
import { useLanguage } from '@/i18n/LanguageContext';
import { showNotification } from '@/lib/notifications';
import { queryKeys } from '@/lib/query-keys';

// ... (empty state component for when no documents exist)

interface KnowledgeClientProps {
  initialDocuments: KnowledgeDocument[];
}

export function KnowledgeClient({ initialDocuments }: KnowledgeClientProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Data
  const { data: documents = [], isLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: queryKeys.documents.all,
    queryFn: async () => (await fetchAllDocuments()) as KnowledgeDocument[],
    initialData: initialDocuments,
  });

  // Filter state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);

  // Streaming parse
  const parseState = useStreamingParse();

  // Derived: unique universities and courses from documents
  const universities = useMemo(
    () => [...new Set(documents.map((d) => d.metadata?.school).filter(Boolean) as string[])],
    [documents],
  );
  const courses = useMemo(
    () => [...new Set(documents.map((d) => d.metadata?.course).filter(Boolean) as string[])],
    [documents],
  );

  // Derived: filtered + sorted documents
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.metadata?.school?.toLowerCase().includes(q) ||
          d.metadata?.course?.toLowerCase().includes(q),
      );
    }

    // Type filter
    if (filters.docType) {
      result = result.filter((d) => d.doc_type === filters.docType);
    }

    // University filter
    if (filters.university) {
      result = result.filter((d) => d.metadata?.school === filters.university);
    }

    // Course filter
    if (filters.course) {
      result = result.filter((d) => d.metadata?.course === filters.course);
    }

    // Status filter
    if (filters.status) {
      result = result.filter((d) => d.status === filters.status);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (filters.sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return result;
  }, [documents, filters]);

  // Batch delete
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => batchDeleteDocuments(ids),
    onSuccess: (result) => {
      if (result.status === 'success') {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
        setSelectedIds(new Set());
        showNotification({ title: t.knowledge.deleted, message: result.message, color: 'green' });
      }
    },
  });

  // Handle upload from modal
  const handleUpload = useCallback(
    (file: File, metadata: { docType: string; school: string; course: string }) => {
      parseState.startParse(file, {
        docType: metadata.docType,
        school: metadata.school,
        course: metadata.course,
        hasAnswers: false,
      });
      // After upload starts, refetch documents periodically to see inline progress
      // The SSE will update the document status in the DB
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      }, 5000);
      // Clean up interval when parse completes
      const checkComplete = setInterval(() => {
        if (parseState.status === 'complete' || parseState.status === 'error') {
          clearInterval(interval);
          clearInterval(checkComplete);
          queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
        }
      }, 1000);
    },
    [parseState, queryClient],
  );

  const handleDocumentDeleted = useCallback(
    (id: string) => {
      queryClient.setQueryData<KnowledgeDocument[]>(queryKeys.documents.all, (prev) =>
        prev?.filter((doc) => doc.id !== id),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [queryClient],
  );

  // Document count summary
  const countSummary = useMemo(() => {
    const total = filteredDocuments.length;
    const byType = filteredDocuments.reduce(
      (acc, d) => {
        const type = d.doc_type ?? 'lecture';
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total, byType };
  }, [filteredDocuments]);

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
            {t.knowledge.knowledgeBase}
          </Title>
          <Text c="dimmed" size="md" fw={400} mt={2}>
            {t.knowledge.knowledgeBaseSubtitle}
          </Text>
        </Box>
        <Button
          variant="filled"
          color="indigo"
          leftSection={<Plus size={16} />}
          onClick={() => setUploadOpen(true)}
          radius="md"
        >
          {t.knowledge.uploadNewDocument}
        </Button>
      </Group>

      {/* Filter bar */}
      <KnowledgeFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        universities={universities}
        courses={courses}
      />

      {/* Bulk action toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.size}
        onDelete={() => batchDeleteMutation.mutate([...selectedIds])}
        onReprocess={() => {/* TODO: batch reprocess */}}
        onClear={() => setSelectedIds(new Set())}
        isDeleting={batchDeleteMutation.isPending}
      />

      {/* Document count */}
      {filteredDocuments.length > 0 && (
        <Text size="sm" c="dimmed">
          {countSummary.total} {t.knowledge.documentCount}
        </Text>
      )}

      {/* Table */}
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : (
        <KnowledgeTable
          documents={filteredDocuments}
          onDeleted={handleDocumentDeleted}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Upload modal */}
      <UploadModal
        opened={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
    </Stack>
  );
}
```

**Step 2: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Fix any type/lint errors that come up**

**Step 4: Commit**

```bash
git add src/app/(protected)/knowledge/KnowledgeClient.tsx
git commit -m "feat(ui): rewrite KnowledgeClient with filters, selection, upload modal"
```

---

### Task 10: Update Empty State for All-Documents View

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx` (update empty state)

**Step 1: Update the empty state in KnowledgeTable**

The empty state should show when `documents.length === 0` and should render a centered card with:

- Large document icon in indigo circle
- "No documents uploaded yet" text
- "Upload your first PDF to get started" subtitle

Keep the existing empty state pattern from `KnowledgeClient` but move it into the table component since `KnowledgeClient` no longer handles the empty case directly.

**Step 2: Run lint and type check**

Run: `npx tsc --noEmit && npm run lint`

**Step 3: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx
git commit -m "feat(ui): update KnowledgeTable empty state for all-documents view"
```

---

### Task 11: Remove Unused Parse Components

**Files:**

- Delete: `src/components/rag/ParsePanel.tsx`
- Delete: `src/components/rag/ParseTimeline.tsx`
- Delete: `src/components/rag/ParseTimeline.module.css`
- Delete: `src/components/rag/ParsedItemCard.tsx`
- Delete: `src/components/rag/ParsedItemCard.module.css`

**Step 1: Verify no other files import these components**

Search for imports of `ParsePanel`, `ParseTimeline`, `ParsedItemCard` across the codebase. If `KnowledgeClient` was correctly rewritten in Task 9, the only import should have been removed.

Run: `grep -r "ParsePanel\|ParseTimeline\|ParsedItemCard" src/ --include="*.tsx" --include="*.ts" -l`

Expected: No files (or only the files being deleted).

**Step 2: Delete the files**

```bash
rm src/components/rag/ParsePanel.tsx
rm src/components/rag/ParseTimeline.tsx
rm src/components/rag/ParseTimeline.module.css
rm src/components/rag/ParsedItemCard.tsx
rm src/components/rag/ParsedItemCard.module.css
```

**Step 3: Run build to verify no broken imports**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(rag): remove ParsePanel, ParseTimeline, ParsedItemCard components"
```

---

### Task 12: Full Integration Test

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run full lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Manual QA checklist**

Run: `npm run dev` and verify in browser:

- [ ] Knowledge page loads with all documents (not filtered by type)
- [ ] Search filters documents by name/university/course in real-time
- [ ] Type, University, Course, Status dropdowns filter correctly
- [ ] Sort by newest/oldest/name works
- [ ] Clear filters resets all filters
- [ ] Row checkboxes work (single select, select all)
- [ ] Bulk action toolbar appears when rows selected
- [ ] Bulk delete works with confirmation
- [ ] Upload button opens modal
- [ ] Upload modal: dropzone accepts PDF, metadata fields work, submit triggers parse
- [ ] After upload: document appears in table with processing status
- [ ] Processing documents show inline progress (badge or progress bar)
- [ ] Individual row delete still works
- [ ] Mobile view: cards with checkboxes, filter bar scrolls horizontally
- [ ] Empty state shows when no documents exist
- [ ] i18n: switch to Chinese and verify new keys display correctly

**Step 6: Commit any fixes found during QA**

```bash
git add -A
git commit -m "fix(ui): knowledge page QA fixes"
```
