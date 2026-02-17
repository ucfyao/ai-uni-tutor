# Knowledge: Three-Domain Table Separation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate lecture, exam, and assignment into independent domains with their own tables, so each parsing pipeline writes to the correct table and the knowledge page reads from the correct source per tab.

**Architecture:** Keep lecture flow unchanged (documents + document_chunks + knowledge_cards). Route exam parsing to existing exam_papers + exam_questions. Create new assignments + assignment_items tables for assignment. Normalize data in the server component so frontend detail page components need minimal changes.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), Mantine v8, TanStack Query, Zod

---

### Task 1: Database migration — create `assignments` + `assignment_items` tables

**Files:**

- Create: `supabase/migrations/YYYYMMDD_create_assignments_tables.sql`

**Step 1: Write migration SQL**

```sql
-- Create assignments table (parent for assignment domain)
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  school text,
  course text,
  status text not null default 'parsing',
  status_message text,
  created_at timestamptz default now()
);

alter table assignments enable row level security;
create policy "Users can manage own assignments"
  on assignments for all using (auth.uid() = user_id);

-- Create assignment_items table
create table if not exists assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  order_num int not null,
  type text not null default '',
  content text not null,
  reference_answer text not null default '',
  explanation text not null default '',
  points int not null default 0,
  difficulty text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table assignment_items enable row level security;
create policy "Users can manage own assignment items"
  on assignment_items for all
  using (exists (
    select 1 from assignments
    where assignments.id = assignment_items.assignment_id
      and assignments.user_id = auth.uid()
  ));
```

**Step 2: Apply migration via Supabase dashboard or CLI**

Run in Supabase SQL editor or `supabase db push`.

**Step 3: Commit**

```
feat(db): create assignments and assignment_items tables
```

---

### Task 2: Update `database.ts` types

**Files:**

- Modify: `src/types/database.ts`

**Step 1: Add `assignments` and `assignment_items` table types**

Add after the `mock_exams` table block (before the closing `}` of `Tables`):

```typescript
assignments: {
  Row: {
    id: string;
    user_id: string;
    title: string;
    school: string | null;
    course: string | null;
    status: string;
    status_message: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    title: string;
    school?: string | null;
    course?: string | null;
    status?: string;
    status_message?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    title?: string;
    school?: string | null;
    course?: string | null;
    status?: string;
    status_message?: string | null;
    created_at?: string;
  };
  Relationships: [];
};
assignment_items: {
  Row: {
    id: string;
    assignment_id: string;
    order_num: number;
    type: string;
    content: string;
    reference_answer: string;
    explanation: string;
    points: number;
    difficulty: string;
    metadata: Json;
    created_at: string;
  };
  Insert: {
    id?: string;
    assignment_id: string;
    order_num: number;
    type?: string;
    content: string;
    reference_answer?: string;
    explanation?: string;
    points?: number;
    difficulty?: string;
    metadata?: Json;
    created_at?: string;
  };
  Update: {
    id?: string;
    assignment_id?: string;
    order_num?: number;
    type?: string;
    content?: string;
    reference_answer?: string;
    explanation?: string;
    points?: number;
    difficulty?: string;
    metadata?: Json;
    created_at?: string;
  };
  Relationships: [];
};
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat(db): add assignments and assignment_items types to database.ts
```

---

### Task 3: Create Assignment domain model + interface

**Files:**

- Create: `src/lib/domain/models/Assignment.ts`
- Create: `src/lib/domain/interfaces/IAssignmentRepository.ts`

**Step 1: Create domain model**

`src/lib/domain/models/Assignment.ts`:

```typescript
/**
 * Domain Models - Assignment Entity
 */

export type AssignmentStatus = 'parsing' | 'ready' | 'error';

export interface AssignmentEntity {
  id: string;
  userId: string;
  title: string;
  school: string | null;
  course: string | null;
  status: AssignmentStatus;
  statusMessage: string | null;
  createdAt: string;
}

export interface AssignmentItemEntity {
  id: string;
  assignmentId: string;
  orderNum: number;
  type: string;
  content: string;
  referenceAnswer: string;
  explanation: string;
  points: number;
  difficulty: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

**Step 2: Create repository interface**

`src/lib/domain/interfaces/IAssignmentRepository.ts`:

```typescript
/**
 * Repository Interface - Assignment Repository
 */

import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';

export interface IAssignmentRepository {
  create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    status?: string;
  }): Promise<string>;

  findById(id: string): Promise<AssignmentEntity | null>;
  findByUserId(userId: string): Promise<AssignmentEntity[]>;
  findOwner(id: string): Promise<string | null>;
  updateStatus(id: string, status: string, statusMessage?: string): Promise<void>;
  delete(id: string): Promise<void>;

  insertItems(
    items: Array<{
      assignmentId: string;
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void>;

  findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]>;
  updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat(db): add Assignment domain model and repository interface
```

---

### Task 4: Create `AssignmentRepository` + add missing methods to `ExamPaperRepository`

**Files:**

- Create: `src/lib/repositories/AssignmentRepository.ts`
- Modify: `src/lib/repositories/ExamPaperRepository.ts`
- Modify: `src/lib/domain/interfaces/IExamPaperRepository.ts`
- Modify: `src/lib/repositories/index.ts`

**Step 1: Implement AssignmentRepository**

`src/lib/repositories/AssignmentRepository.ts` — follow the same pattern as `ExamPaperRepository.ts`:

```typescript
/**
 * Assignment Repository Implementation
 */

import type { IAssignmentRepository } from '@/lib/domain/interfaces/IAssignmentRepository';
import type { AssignmentEntity, AssignmentItemEntity } from '@/lib/domain/models/Assignment';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

function mapAssignmentRow(row: Record<string, unknown>): AssignmentEntity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    school: (row.school as string) ?? null,
    course: (row.course as string) ?? null,
    status: row.status as 'parsing' | 'ready' | 'error',
    statusMessage: (row.status_message as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapItemRow(row: Record<string, unknown>): AssignmentItemEntity {
  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    orderNum: row.order_num as number,
    type: (row.type as string) || '',
    content: row.content as string,
    referenceAnswer: (row.reference_answer as string) || '',
    explanation: (row.explanation as string) || '',
    points: (row.points as number) || 0,
    difficulty: (row.difficulty as string) || '',
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

export class AssignmentRepository implements IAssignmentRepository {
  async create(data: {
    userId: string;
    title: string;
    school?: string | null;
    course?: string | null;
    status?: string;
  }): Promise<string> {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('assignments')
      .insert({
        user_id: data.userId,
        title: data.title,
        school: data.school ?? null,
        course: data.course ?? null,
        status: data.status ?? 'parsing',
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new DatabaseError(`Failed to create assignment: ${error?.message}`, error);
    }
    return row.id as string;
  }

  async findById(id: string): Promise<AssignmentEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('assignments').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment: ${error.message}`, error);
    }
    if (!data) return null;
    return mapAssignmentRow(data as Record<string, unknown>);
  }

  async findByUserId(userId: string): Promise<AssignmentEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignments: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => mapAssignmentRow(r));
  }

  async findOwner(id: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignments')
      .select('user_id')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(`Failed to fetch assignment owner: ${error.message}`, error);
    }
    return (data?.user_id as string) ?? null;
  }

  async updateStatus(id: string, status: string, statusMessage?: string): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = { status };
    if (statusMessage !== undefined) updates.status_message = statusMessage;

    const { error } = await supabase.from('assignments').update(updates).eq('id', id);
    if (error) {
      throw new DatabaseError(`Failed to update assignment status: ${error.message}`, error);
    }
  }

  async delete(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) {
      throw new DatabaseError(`Failed to delete assignment: ${error.message}`, error);
    }
  }

  async insertItems(
    items: Array<{
      assignmentId: string;
      orderNum: number;
      type?: string;
      content: string;
      referenceAnswer?: string;
      explanation?: string;
      points?: number;
      difficulty?: string;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const supabase = await createClient();
    const rows = items.map((item) => ({
      assignment_id: item.assignmentId,
      order_num: item.orderNum,
      type: item.type ?? '',
      content: item.content,
      reference_answer: item.referenceAnswer ?? '',
      explanation: item.explanation ?? '',
      points: item.points ?? 0,
      difficulty: item.difficulty ?? '',
      metadata: (item.metadata ?? {}) as Json,
    }));

    const { error } = await supabase.from('assignment_items').insert(rows);
    if (error) {
      throw new DatabaseError(`Failed to insert assignment items: ${error.message}`, error);
    }
  }

  async findItemsByAssignmentId(assignmentId: string): Promise<AssignmentItemEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('assignment_items')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('order_num', { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to fetch assignment items: ${error.message}`, error);
    }
    return (data ?? []).map((r: Record<string, unknown>) => mapItemRow(r));
  }

  async updateItem(
    itemId: string,
    data: Partial<Omit<AssignmentItemEntity, 'id' | 'assignmentId' | 'createdAt'>>,
  ): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (data.orderNum !== undefined) updates.order_num = data.orderNum;
    if (data.type !== undefined) updates.type = data.type;
    if (data.content !== undefined) updates.content = data.content;
    if (data.referenceAnswer !== undefined) updates.reference_answer = data.referenceAnswer;
    if (data.explanation !== undefined) updates.explanation = data.explanation;
    if (data.points !== undefined) updates.points = data.points;
    if (data.difficulty !== undefined) updates.difficulty = data.difficulty;
    if (data.metadata !== undefined) updates.metadata = data.metadata as Json;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase.from('assignment_items').update(updates).eq('id', itemId);
    if (error) {
      throw new DatabaseError(`Failed to update assignment item: ${error.message}`, error);
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('assignment_items').delete().eq('id', itemId);
    if (error) {
      throw new DatabaseError(`Failed to delete assignment item: ${error.message}`, error);
    }
  }
}

let _assignmentRepository: AssignmentRepository | null = null;

export function getAssignmentRepository(): AssignmentRepository {
  if (!_assignmentRepository) {
    _assignmentRepository = new AssignmentRepository();
  }
  return _assignmentRepository;
}
```

**Step 2: Add missing methods to `ExamPaperRepository`**

`ExamPaperRepository` is missing `findByUserId` and `deleteQuestion` methods needed by server actions. Add them:

In `src/lib/domain/interfaces/IExamPaperRepository.ts`, add to the interface:

```typescript
findByUserId(userId: string): Promise<ExamPaper[]>;
deleteQuestion(questionId: string): Promise<void>;
```

In `src/lib/repositories/ExamPaperRepository.ts`, add these methods to the class:

```typescript
async findByUserId(userId: string): Promise<ExamPaper[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('exam_papers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new DatabaseError(`Failed to fetch exam papers: ${error.message}`, error);
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapPaperRow(row));
}

async deleteQuestion(questionId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('exam_questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    throw new DatabaseError(`Failed to delete question: ${error.message}`, error);
  }
}
```

**Step 3: Export from index**

Add to `src/lib/repositories/index.ts`:

```typescript
export { AssignmentRepository, getAssignmentRepository } from './AssignmentRepository';
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
feat(db): add AssignmentRepository and ExamPaperRepository.findByUserId/deleteQuestion
```

---

### Task 5: Update SSE parsing route — branch by docType

**Files:**

- Modify: `src/app/api/documents/parse/route.ts`

This is the largest single change. The route currently creates a `documents` record and saves everything to `document_chunks` with embeddings. After this change:

- **lecture**: No change to existing behavior — creates `documents` record, embeds, saves to `document_chunks`
- **exam**: Creates `exam_papers` record, saves parsed questions to `exam_questions` (no embedding)
- **assignment**: Creates `assignments` record, saves parsed items to `assignment_items` (no embedding)

> **Important — lecture path stays unchanged:** The current SSE route does NOT call `KnowledgeCardService`. That happens separately via `DocumentProcessingService.processWithLLM()` (the non-streaming `uploadDocument` server action path). Do NOT add `KnowledgeCardService` calls here — keep the lecture branch identical to the existing code.

**Step 1: Add imports**

Add at top of the file (note: `KnowledgePoint` and `ParsedQuestion` are already imported):

```typescript
import { getAssignmentRepository } from '@/lib/repositories/AssignmentRepository';
import { getExamPaperRepository } from '@/lib/repositories/ExamPaperRepository';
```

**Step 2: Hoist `recordId` and `recordDocType` for error cleanup**

At the top of the pipeline IIFE, add alongside `docId`:

```typescript
let docId: string | undefined;
let recordId: string | undefined; // NEW — tracks any domain record
let recordDocType: string | undefined; // NEW — tracks which domain
const documentService = getDocumentService();
```

**Step 3: Branch record creation by docType**

Replace the entire section from `// ── Duplicate check ──` through `send('document_created', ...)` (lines 128–143 of current route):

```typescript
// ── Create record in the correct domain table ──
let effectiveRecordId: string;
recordDocType = doc_type;

if (doc_type === 'lecture') {
  // Lecture → documents table (existing flow, unchanged)
  const isDuplicate = await documentService.checkDuplicate(user.id, file.name);
  if (isDuplicate) {
    send('error', { message: `File "${file.name}" already exists.`, code: 'DUPLICATE' });
    return;
  }
  const doc = await documentService.createDocument(
    user.id,
    file.name,
    { school: school || 'Unspecified', course: course || 'General' },
    doc_type,
  );
  effectiveRecordId = doc.id;
  docId = doc.id; // for existing lecture error cleanup
} else if (doc_type === 'exam') {
  // Exam → exam_papers table
  const examRepo = getExamPaperRepository();
  effectiveRecordId = await examRepo.create({
    userId: user.id,
    title: file.name,
    school: school || null,
    course: course || null,
    status: 'parsing',
  });
} else {
  // Assignment → assignments table
  const assignmentRepo = getAssignmentRepository();
  effectiveRecordId = await assignmentRepo.create({
    userId: user.id,
    title: file.name,
    school: school || null,
    course: course || null,
    status: 'parsing',
  });
}
recordId = effectiveRecordId;
send('document_created', { documentId: effectiveRecordId });
```

**Step 4: Update PDF parsing section to use `effectiveRecordId`**

Replace all references to `doc.id` in the PDF parsing section (status updates, error handlers) with `effectiveRecordId`. For lecture, `docId` is still set for backward-compat.

For the `// ── Parse PDF ──` section, update status calls:

```typescript
send('status', { stage: 'parsing_pdf', message: 'Parsing PDF...' });
if (doc_type === 'lecture') {
  await documentService.updateStatus(effectiveRecordId, 'processing', 'Parsing PDF...');
}
```

For PDF validation errors and parse failures, dispatch status update by type:

```typescript
// Helper — update status on correct table
async function updateRecordStatus(status: string, msg: string) {
  if (doc_type === 'lecture') {
    await documentService.updateStatus(
      effectiveRecordId,
      status as 'processing' | 'ready' | 'error',
      msg,
    );
  } else if (doc_type === 'exam') {
    await getExamPaperRepository().updateStatus(
      effectiveRecordId,
      status as 'parsing' | 'ready' | 'error',
      msg,
    );
  } else {
    await getAssignmentRepository().updateStatus(effectiveRecordId, status as string, msg);
  }
}
```

Use `updateRecordStatus('error', ...)` in the PDF validation, empty text, and LLM extraction error paths (replacing the direct `documentService.updateStatus` calls).

**Step 5: Branch the save step by docType**

After LLM extraction, replace the entire `// ── Stream items + batch save ──` section through `// ── Complete ──`:

```typescript
const totalItems = items.length;
if (totalItems === 0) {
  await updateRecordStatus('ready', '');
  send('progress', { current: 0, total: 0 });
  send('status', { stage: 'complete', message: 'No content extracted' });
  return;
}

if (doc_type === 'lecture') {
  // ── LECTURE: Embed + save chunks (existing flow, unchanged) ──
  send('status', { stage: 'embedding', message: 'Generating embeddings & saving...' });
  await documentService.updateStatus(
    effectiveRecordId,
    'processing',
    'Generating embeddings & saving...',
  );

  let batch: CreateDocumentChunkDTO[] = [];
  let batchIndex = 0;

  for (let i = 0; i < items.length; i++) {
    if (signal.aborted) {
      if (batch.length > 0) await documentService.saveChunksAndReturn(batch);
      await documentService.updateStatus(effectiveRecordId, 'ready');
      return;
    }

    const { type, data } = items[i];
    send('item', { index: i, type, data });
    send('progress', { current: i + 1, total: totalItems });

    const content = buildChunkContent(type, data);
    const embedding = await generateEmbeddingWithRetry(content);
    batch.push({ documentId: effectiveRecordId, content, embedding, metadata: { type, ...data } });

    if (batch.length >= BATCH_SIZE || i === items.length - 1) {
      const savedChunks = await documentService.saveChunksAndReturn(batch);
      send('batch_saved', { chunkIds: savedChunks.map((c) => c.id), batchIndex });
      batch = [];
      batchIndex++;
    }
  }

  await documentService.updateStatus(effectiveRecordId, 'ready');
} else if (doc_type === 'exam') {
  // ── EXAM: Save to exam_questions (no embedding) ──
  send('status', { stage: 'embedding', message: 'Saving questions...' });
  const examRepo = getExamPaperRepository();

  // Send items to client for display
  for (let i = 0; i < items.length; i++) {
    send('item', { index: i, type: items[i].type, data: items[i].data });
    send('progress', { current: i + 1, total: totalItems });
  }

  // Build exam_questions rows from ParsedQuestion data
  const questions = items.map((item, idx) => {
    const q = item.data as ParsedQuestion;
    return {
      paperId: effectiveRecordId,
      orderNum: idx + 1,
      type: '',
      content: q.content,
      options: q.options
        ? Object.fromEntries(q.options.map((opt, j) => [String.fromCharCode(65 + j), opt]))
        : null,
      answer: q.referenceAnswer || '',
      explanation: '',
      points: q.score || 0,
      metadata: { sourcePage: q.sourcePage },
    };
  });

  await examRepo.insertQuestions(questions);
  send('batch_saved', { chunkIds: questions.map((_, i) => `q-${i}`), batchIndex: 0 });

  const questionTypes = [...new Set(questions.map((q) => q.type).filter(Boolean))];
  if (questionTypes.length > 0) {
    await examRepo.updatePaper(effectiveRecordId, { questionTypes });
  }

  await examRepo.updateStatus(effectiveRecordId, 'ready');
} else {
  // ── ASSIGNMENT: Save to assignment_items (no embedding) ──
  send('status', { stage: 'embedding', message: 'Saving items...' });
  const assignmentRepo = getAssignmentRepository();

  for (let i = 0; i < items.length; i++) {
    send('item', { index: i, type: items[i].type, data: items[i].data });
    send('progress', { current: i + 1, total: totalItems });
  }

  const assignmentItems = items.map((item, idx) => {
    const q = item.data as ParsedQuestion;
    return {
      assignmentId: effectiveRecordId,
      orderNum: idx + 1,
      type: '',
      content: q.content,
      referenceAnswer: q.referenceAnswer || '',
      explanation: '',
      points: q.score || 0,
      difficulty: '',
      metadata: { sourcePage: q.sourcePage },
    };
  });

  await assignmentRepo.insertItems(assignmentItems);
  send('batch_saved', { chunkIds: assignmentItems.map((_, i) => `a-${i}`), batchIndex: 0 });

  await assignmentRepo.updateStatus(effectiveRecordId, 'ready');
}

send('status', { stage: 'complete', message: `Done! ${totalItems} items extracted.` });
```

**Step 6: Fix outer error handling — clean up ALL domain types**

Replace the outer `catch` block with proper cleanup for all three types:

```typescript
} catch (error) {
  console.error('Parse pipeline error:', error);
  // Clean up the correct domain table based on which record was created
  if (recordId) {
    try {
      if (recordDocType === 'exam') {
        await getExamPaperRepository().updateStatus(recordId, 'error', 'Processing failed unexpectedly');
      } else if (recordDocType === 'assignment') {
        await getAssignmentRepository().updateStatus(recordId, 'error', 'Processing failed unexpectedly');
      } else if (docId) {
        await documentService.updateStatus(docId, 'error', 'Processing failed unexpectedly');
      }
    } catch {
      /* ignore cleanup errors */
    }
  }
  send('error', { message: 'Internal server error', code: 'INTERNAL_ERROR' });
}
```

**Step 7: Run type check**

Run: `npx tsc --noEmit`

**Step 8: Commit**

```
feat(rag): route exam/assignment parsing to dedicated tables
```

---

### Task 6: Update server actions — type-aware fetch, delete, and update

**Files:**

- Modify: `src/app/actions/documents.ts`

> **Note on architecture:** Server actions should go through Services per project rules. Exam/assignment don't have dedicated services yet. This PR uses Repositories directly as a pragmatic choice — creating full service layers for exam/assignment is deferred to a follow-up.

**Step 1: Update `fetchDocuments` to dispatch by type (using repositories)**

Replace the `fetchDocuments` function body:

```typescript
export async function fetchDocuments(docType: string): Promise<DocumentListItem[]> {
  const user = await requireAdmin();
  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) throw new Error('Invalid document type');

  if (parsed.data === 'lecture') {
    const service = getDocumentService();
    const entities = await service.getDocumentsByType(user.id, 'lecture');
    return entities.map((doc) => ({
      id: doc.id,
      name: doc.name,
      status: doc.status,
      status_message: doc.statusMessage,
      created_at: doc.createdAt.toISOString(),
      doc_type: 'lecture',
      metadata:
        doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
          ? (doc.metadata as DocumentListItem['metadata'])
          : null,
    }));
  }

  if (parsed.data === 'exam') {
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const papers = await examRepo.findByUserId(user.id);
    return papers.map((paper) => ({
      id: paper.id,
      name: paper.title,
      status: paper.status === 'parsing' ? 'processing' : paper.status,
      status_message: paper.statusMessage,
      created_at: paper.createdAt,
      doc_type: 'exam',
      metadata: {
        school: paper.school ?? undefined,
        course: paper.course ?? undefined,
      },
    }));
  }

  // assignment
  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const assignmentRepo = getAssignmentRepository();
  const assignments = await assignmentRepo.findByUserId(user.id);
  return assignments.map((a) => ({
    id: a.id,
    name: a.title,
    status: a.status === 'parsing' ? 'processing' : a.status,
    status_message: a.statusMessage,
    created_at: a.createdAt,
    doc_type: 'assignment',
    metadata: {
      school: a.school ?? undefined,
      course: a.course ?? undefined,
    },
  }));
}
```

**Step 2: Guard `uploadDocument` to lecture-only**

The `uploadDocument` server action always creates records in the `documents` table and processes via `DocumentProcessingService`. After this refactor, exam/assignment should only go through the SSE route. Add a guard at the top of `uploadDocument`:

```typescript
export async function uploadDocument(
  prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  // ...existing parse...
  const { file, doc_type, school, course, has_answers } = parsed.data;

  // Exam/assignment must use the SSE route (/api/documents/parse) which routes to correct tables
  if (doc_type !== 'lecture') {
    return { status: 'error', message: 'Use the streaming upload for exam/assignment documents' };
  }

  // ...rest of existing function unchanged...
```

**Step 3: Update `deleteDocument` to dispatch by type**

```typescript
export async function deleteDocument(documentId: string, docType?: string) {
  const user = await requireAdmin();

  if (docType === 'exam') {
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const owner = await examRepo.findOwner(documentId);
    if (owner !== user.id) throw new ForbiddenError('Not authorized');
    await examRepo.delete(documentId);
  } else if (docType === 'assignment') {
    const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
    const assignmentRepo = getAssignmentRepository();
    const owner = await assignmentRepo.findOwner(documentId);
    if (owner !== user.id) throw new ForbiddenError('Not authorized');
    await assignmentRepo.delete(documentId);
  } else {
    // Default: lecture (documents table)
    const documentService = getDocumentService();
    await documentService.deleteDocument(documentId, user.id);
  }

  revalidatePath('/admin/knowledge');
}
```

**Step 4: Add `updateExamQuestions` server action (using repository)**

```typescript
export async function updateExamQuestions(
  paperId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
  const examRepo = getExamPaperRepository();
  const owner = await examRepo.findOwner(paperId);
  if (owner !== user.id) return { status: 'error', message: 'Not authorized' };

  // Delete via repository
  for (const id of deletedIds) {
    await examRepo.deleteQuestion(id);
  }

  // Update via repository
  for (const update of updates) {
    const meta = update.metadata;
    await examRepo.updateQuestion(update.id, {
      content: (meta.content as string) || update.content,
      options: meta.options
        ? Object.fromEntries(
            (meta.options as string[]).map((opt: string, j: number) => [
              String.fromCharCode(65 + j),
              opt,
            ]),
          )
        : undefined,
      answer: (meta.answer as string) || undefined,
      explanation: (meta.explanation as string) || undefined,
      points: meta.score != null ? Number(meta.score) : undefined,
      type: (meta.type as string) || undefined,
    });
  }

  revalidatePath(`/admin/knowledge/${paperId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}
```

**Step 5: Add `updateAssignmentItems` server action**

```typescript
export async function updateAssignmentItems(
  assignmentId: string,
  updates: { id: string; content: string; metadata: Record<string, unknown> }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await requireAdmin();

  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const assignmentRepo = getAssignmentRepository();
  const owner = await assignmentRepo.findOwner(assignmentId);
  if (owner !== user.id) return { status: 'error', message: 'Not authorized' };

  for (const id of deletedIds) {
    await assignmentRepo.deleteItem(id);
  }

  for (const update of updates) {
    const meta = update.metadata;
    await assignmentRepo.updateItem(update.id, {
      content: (meta.content as string) || update.content,
      referenceAnswer: (meta.referenceAnswer as string) || undefined,
      explanation: (meta.explanation as string) || undefined,
      points: meta.points != null ? Number(meta.points) : undefined,
      difficulty: (meta.difficulty as string) || undefined,
      type: (meta.type as string) || undefined,
    });
  }

  revalidatePath(`/admin/knowledge/${assignmentId}`);
  revalidatePath('/admin/knowledge');
  return { status: 'success', message: 'Changes saved' };
}
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```
feat(rag): add type-aware fetch, delete, and update server actions
```

---

### Task 7: Update KnowledgeTable — type-aware links and delete

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx`

**Step 1: Change `deleteTarget` state from `string | null` to `KnowledgeDocument | null`**

This is a complete audit of all `deleteTarget` usages:

```typescript
// State declaration (line 82)
const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);

// handleDelete — now accepts full doc (line 145)
const handleDelete = (doc: KnowledgeDocument) => setDeleteTarget(doc);

// Delete mutation — now accepts KnowledgeDocument (line 124)
const deleteMutation = useMutation({
  mutationFn: (doc: KnowledgeDocument) => deleteDocument(doc.id, doc.doc_type),
  onSuccess: (_data, doc) => {
    onDeleted?.(doc.id);
    setDeleteTarget(null);
    showNotification({
      title: t.knowledge.deleted,
      message: t.knowledge.documentDeleted,
      color: 'green',
    });
  },
  onError: () => {
    setDeleteTarget(null);
    showNotification({
      title: t.knowledge.error,
      message: t.knowledge.failedToDelete,
      color: 'red',
    });
  },
});

// Remove the deleteTargetDoc lookup (line 217) — no longer needed
// OLD: const deleteTargetDoc = deleteTarget ? documents.find((d) => d.id === deleteTarget) : null;
// DELETE this line entirely

// Delete modal — use deleteTarget directly instead of deleteTargetDoc
// (line 245): {deleteTargetDoc?.name} → {deleteTarget?.name}

// Delete confirm button (line 258):
onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}

// Loading state on delete buttons — compare .id instead of string
// Mobile (line 318):
loading={deleteMutation.isPending && deleteMutation.variables?.id === doc.id}
// Desktop (line 475):
loading={deleteMutation.isPending && deleteMutation.variables?.id === doc.id}

// Both delete onClick handlers pass full doc:
// Mobile (line 317): onClick={() => handleDelete(doc)}
// Desktop (line 474): onClick={() => handleDelete(doc)}
```

**Step 2: Add `?type=` to all navigation links**

Change all `router.push(\`/admin/knowledge/${doc.id}\`)` to include type:

```typescript
router.push(`/admin/knowledge/${doc.id}?type=${doc.doc_type || 'lecture'}`);
```

There are two instances:

- Mobile card (line 308): `onClick={() => router.push(...)}`
- Desktop table (line 466): `onClick={() => router.push(...)}`

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat(ui): add type-aware links and delete in KnowledgeTable
```

---

### Task 8: Update detail page — type-aware data fetching

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/page.tsx`
- Modify: `src/app/(protected)/admin/knowledge/[id]/types.ts`

**Step 1: Update `types.ts` to include `docType` in `SerializedDocument`**

Add `docType` field:

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
}
```

**Step 2: Update `page.tsx` to read `type` from searchParams and fetch from correct table**

```typescript
export default async function DocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to view this document.
        </Alert>
      </Container>
    );
  }

  const docType = (type === 'exam' || type === 'assignment') ? type : 'lecture';

  if (docType === 'lecture') {
    // Existing flow
    const documentService = getDocumentService();
    const doc = await documentService.findById(id);
    if (!doc || doc.userId !== user.id) notFound();

    const chunks = await documentService.getChunks(id);
    const serializedDoc: SerializedDocument = {
      id: doc.id,
      userId: doc.userId,
      name: doc.name,
      status: doc.status,
      statusMessage: doc.statusMessage,
      metadata: doc.metadata,
      docType: 'lecture',
      createdAt: doc.createdAt.toISOString(),
    };
    return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
  }

  if (docType === 'exam') {
    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const examRepo = getExamPaperRepository();
    const paper = await examRepo.findById(id);
    if (!paper || paper.userId !== user.id) notFound();

    const questions = await examRepo.findQuestionsByPaperId(id);

    // Normalize ExamPaper → SerializedDocument
    const serializedDoc: SerializedDocument = {
      id: paper.id,
      userId: paper.userId,
      name: paper.title,
      status: paper.status === 'parsing' ? 'processing' : paper.status,
      statusMessage: paper.statusMessage,
      metadata: { school: paper.school, course: paper.course, doc_type: 'exam' },
      docType: 'exam',
      createdAt: paper.createdAt,
    };

    // Normalize ExamQuestion[] → Chunk[]
    const chunks: Chunk[] = questions.map((q) => ({
      id: q.id,
      content: q.content,
      metadata: {
        type: 'question',
        questionNumber: String(q.orderNum),
        content: q.content,
        options: q.options ? Object.values(q.options) : undefined,
        answer: q.answer,
        referenceAnswer: q.answer,
        score: q.points,
        explanation: q.explanation,
      },
      embedding: null,
    }));

    return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
  }

  // assignment
  const { getAssignmentRepository } = await import('@/lib/repositories/AssignmentRepository');
  const assignmentRepo = getAssignmentRepository();
  const assignment = await assignmentRepo.findById(id);
  if (!assignment || assignment.userId !== user.id) notFound();

  const items = await assignmentRepo.findItemsByAssignmentId(id);

  const serializedDoc: SerializedDocument = {
    id: assignment.id,
    userId: assignment.userId,
    name: assignment.title,
    status: assignment.status === 'parsing' ? 'processing' : assignment.status,
    statusMessage: assignment.statusMessage,
    metadata: { school: assignment.school, course: assignment.course, doc_type: 'assignment' },
    docType: 'assignment',
    createdAt: assignment.createdAt,
  };

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

  return <DocumentDetailClient document={serializedDoc} chunks={chunks} />;
}
```

Import `Chunk` and `SerializedDocument` from `./types`.

**Step 3: Update `resolveDocType` in types.ts**

Since `SerializedDocument` now has a `docType` field directly, components can use it instead of inferring from metadata.

**Step 4: Run type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
feat(ui): type-aware data fetching in knowledge detail page
```

---

### Task 9: Update DocumentDetailClient — use `docType` from document

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/DocumentDetailClient.tsx`

**Step 1: Read `docType` from `doc.docType` instead of metadata**

Replace:

```typescript
const docType: DocType = resolveDocType(doc.metadata);
```

With:

```typescript
const docType: DocType = doc.docType;
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
refactor(ui): read docType from document prop instead of metadata
```

---

### Task 10: Update ChunkActionBar — type-aware save

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/ChunkActionBar.tsx`
- Modify: `src/app/(protected)/admin/knowledge/[id]/DocumentDetailClient.tsx`

**Step 1: Add `docType` prop to ChunkActionBar**

```typescript
interface ChunkActionBarProps {
  docId: string;
  docType: DocType; // NEW
  pendingChanges: number;
  editedChunks: Map<string, { content: string; metadata: Record<string, unknown> }>;
  deletedChunkIds: Set<string>;
  onSaved: () => void;
}
```

**Step 2: Update `handleSave` to dispatch by type**

```typescript
import {
  regenerateEmbeddings,
  updateAssignmentItems,
  updateDocumentChunks,
  updateExamQuestions,
} from '@/app/actions/documents';
// ...

const handleSave = async () => {
  setSaving(true);
  try {
    const updates = Array.from(editedChunks.entries()).map(([id, data]) => ({
      id,
      content: data.content,
      metadata: data.metadata,
    }));
    const deletedArr = Array.from(deletedChunkIds);

    let result: { status: string; message: string };
    if (docType === 'exam') {
      result = await updateExamQuestions(docId, updates, deletedArr);
    } else if (docType === 'assignment') {
      result = await updateAssignmentItems(docId, updates, deletedArr);
    } else {
      result = await updateDocumentChunks(docId, updates, deletedArr);
    }

    if (result.status === 'success') {
      showNotification({ message: t.toast.changesSaved, color: 'green', icon: <Check size={16} />, autoClose: 3000 });
      onSaved();
    } else {
      showNotification({ title: t.knowledge.error, message: result.message, color: 'red' });
    }
  } catch {
    showNotification({ title: t.knowledge.error, message: t.documentDetail.failedToSave, color: 'red' });
  } finally {
    setSaving(false);
  }
};
```

**Step 3: Hide "Regenerate Embeddings" for exam/assignment**

Only show for lecture:

```typescript
{docType === 'lecture' && (
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
)}
```

**Step 4: Pass `docType` from DocumentDetailClient**

In `DocumentDetailClient.tsx`, pass `docType` to `ChunkActionBar`:

```tsx
<ChunkActionBar
  docId={doc.id}
  docType={docType}
  pendingChanges={pendingChanges}
  editedChunks={editedChunks}
  deletedChunkIds={deletedChunkIds}
  onSaved={handleSaved}
/>
```

**Step 5: Run type check**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```
feat(ui): type-aware save and hide embedding regen for exam/assignment
```

---

### Task 11: Add AssignmentEditForm to ChunkEditForm

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/ChunkEditForm.tsx`

**Step 1: Add assignment branch in ChunkEditForm**

Replace the fallback `return` with an assignment-specific form:

```typescript
if (docType === 'assignment') {
  return (
    <AssignmentEditForm
      chunkId={chunk.id}
      meta={meta}
      initialContent={initialContent}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}
```

**Step 2: Implement AssignmentEditForm**

Add after `ExamEditForm`:

```typescript
/* -- Assignment Edit -- */

function AssignmentEditForm({
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
  const [content, setContent] = useState((meta.content as string) || initialContent);
  const [referenceAnswer, setReferenceAnswer] = useState(
    (meta.referenceAnswer as string) || '',
  );
  const [explanation, setExplanation] = useState((meta.explanation as string) || '');
  const [points, setPoints] = useState(meta.points != null ? String(meta.points) : '');
  const [difficulty, setDifficulty] = useState((meta.difficulty as string) || '');

  const handleSave = () => {
    const updated: Record<string, unknown> = {
      ...meta,
      content,
      referenceAnswer,
      explanation,
      points: points ? Number(points) : 0,
      difficulty,
    };
    onSave(chunkId, content, updated);
  };

  return (
    <Card withBorder radius="lg" p="md" bg="var(--mantine-color-indigo-0)">
      <Stack gap="sm">
        <Textarea
          label={t.documentDetail.content}
          value={content}
          onChange={(e) => setContent(e.currentTarget.value)}
          minRows={3}
          autosize
        />
        <Textarea
          label={t.documentDetail.answer}
          value={referenceAnswer}
          onChange={(e) => setReferenceAnswer(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Textarea
          label={t.documentDetail.explanation || 'Explanation'}
          value={explanation}
          onChange={(e) => setExplanation(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group grow>
          <TextInput
            label={t.documentDetail.score}
            value={points}
            onChange={(e) => setPoints(e.currentTarget.value)}
            type="number"
          />
          <TextInput
            label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.currentTarget.value)}
          />
        </Group>
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

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```
feat(ui): add AssignmentEditForm for assignment items
```

---

### Task 12: Update ChunkTable — assignment columns

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/[id]/ChunkTable.tsx`

**Step 1: Update assignment column layout in desktop table header**

Replace the assignment table header section:

```typescript
{docType === 'assignment' && (
  <>
    <Table.Th w="45%" style={thStyle}>
      {t.documentDetail.content}
    </Table.Th>
    <Table.Th w="20%" style={thStyle}>
      {t.documentDetail.answer}
    </Table.Th>
    <Table.Th w="10%" style={thStyle}>
      {t.documentDetail.score}
    </Table.Th>
  </>
)}
```

**Step 2: Update assignment cells in DesktopChunkRows**

Replace the `docType === 'assignment'` render section:

```typescript
{docType === 'assignment' && (
  <>
    <Table.Td>
      <Text size="sm" c="dimmed" lineClamp={2}>
        {(meta.content as string) || content}
      </Text>
    </Table.Td>
    <Table.Td>
      <Text size="sm" c="dimmed" lineClamp={1}>
        {(meta.referenceAnswer as string) || ''}
      </Text>
    </Table.Td>
    <Table.Td>
      {meta.points != null && Number(meta.points) > 0 && (
        <Badge variant="light" color="violet" size="sm">
          {String(meta.points)} pts
        </Badge>
      )}
    </Table.Td>
  </>
)}
```

**Step 3: Update assignment mobile card**

In MobileChunkRow, update the title and add answer toggle for assignment (similar to exam):

```typescript
const title =
  docType === 'lecture'
    ? (meta.title as string) || t.documentDetail.untitled
    : docType === 'exam'
      ? `Q${(meta.questionNumber as string) || index + 1}`
      : `Q${(meta.questionNumber as string) || index + 1}`;
```

Also add answer expand for assignment:

```typescript
{(docType === 'exam' || docType === 'assignment') && answer && (
  // existing expand toggle
)}
```

**Step 4: Update `colCount` for assignment**

Update the colCount calculation:

```typescript
const colCount = (docType === 'lecture' ? 4 : docType === 'exam' ? 5 : 5) + 1;
```

**Step 5: Update `countLabel` for assignment**

Change assignment label from "chunks" to "questions" or "items":

```typescript
const countLabel =
  docType === 'lecture' ? t.documentDetail.knowledgePoints : t.documentDetail.questions;
```

**Step 6: Run type check**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```
feat(ui): update ChunkTable assignment columns and display
```

---

### Task 13: Update KnowledgeClient — SSE documentId handling + fix navigation race

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx`

**Step 1: Capture docType at parse start time**

`activeTab` can change while parsing is in progress (user clicks a different tab). The "View Details" navigation must use the docType that was active when parsing _started_, not the current `activeTab`.

Add a ref to capture the parse-time docType:

```typescript
const parseDocTypeRef = useRef<string>(activeTab);
```

Update `handleStartParse` to capture the type:

```typescript
const handleStartParse = () => {
  if (!selectedFile || !selectedUniId || !selectedCourseId) return;

  parseDocTypeRef.current = activeTab; // capture before parse starts

  const uniObj = universities.find((u) => u.id === selectedUniId);
  const courseObj = allCourses.find((c) => c.id === selectedCourseId);

  parseState.startParse(selectedFile, {
    docType: activeTab,
    school: uniObj?.shortName ?? '',
    course: courseObj?.code ?? '',
    hasAnswers: false,
  });
};
```

**Step 2: Update "View Details" link to use captured docType**

In the complete state handler, use `parseDocTypeRef.current` instead of `activeTab`:

```typescript
{parseState.status === 'complete' && parseState.documentId && (
  <Button
    color="indigo"
    radius="md"
    fullWidth
    onClick={() => {
      const docId = parseState.documentId;
      const parsedType = parseDocTypeRef.current;
      handleDismissParse();
      setUploadModalOpen(false);
      router.push(`/admin/knowledge/${docId}?type=${parsedType}`);
    }}
  >
    {t.knowledge.viewDetailsLink}
  </Button>
)}
```

**Step 3: Update `handleDismissParse` error cleanup to pass docType**

In `handleDismissParse`, the `deleteDocument` call should also pass docType:

```typescript
const handleDismissParse = useCallback(async () => {
  if (parseState.status === 'error' && parseState.documentId) {
    try {
      await deleteDocument(parseState.documentId, parseDocTypeRef.current);
    } catch {
      // Ignore — record may already be gone
    }
  }
  resetForm();
  parseState.reset();
  queryClient.invalidateQueries({ queryKey: queryKeys.documents.byType(activeTab) });
}, [resetForm, parseState, queryClient, activeTab]);
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```
feat(ui): fix post-parse navigation to use captured docType
```

---

### Task 14: Add i18n keys for assignment fields

**Files:**

- Modify: `src/i18n/translations.ts`

**Step 1: Add missing translation keys**

In the `documentDetail` section for both `zh` and `en`, add:

```typescript
// zh
explanation: '解析',
difficulty: '难度',

// en
explanation: 'Explanation',
difficulty: 'Difficulty',
```

Also update the assignment `countLabel` — add to `documentDetail`:

```typescript
// zh
items: '题目',

// en
items: 'Items',
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```
feat(ui): add assignment-related i18n keys
```

---

### Task 15: Verification — type check, lint, build

**Step 1: Run full type check**

Run: `npx tsc --noEmit`

**Step 2: Run linter**

Run: `npm run lint`

**Step 3: Run tests**

Run: `npx vitest run`

**Step 4: Run build**

Run: `npm run build`

**Step 5: Manual smoke test checklist**

- [ ] Lecture tab: shows documents from `documents` table, click navigates to detail with `?type=lecture`
- [ ] Exam tab: shows papers from `exam_papers` table, status shows correctly (parsing→processing mapping)
- [ ] Assignment tab: shows from `assignments` table
- [ ] Upload lecture: creates `documents` record, embeds, saves to `document_chunks` (NO new knowledge_cards call in SSE route — that's handled separately by `DocumentProcessingService`)
- [ ] Upload exam: creates `exam_papers` record, saves to `exam_questions` (no embedding step)
- [ ] Upload assignment: creates `assignments` record, saves to `assignment_items` (no embedding step)
- [ ] Lecture detail: shows knowledge points, save works, regenerate embeddings works
- [ ] Exam detail: shows questions, save calls `updateExamQuestions`, no "Regenerate Embeddings" button
- [ ] Assignment detail: shows items with answer/score/difficulty, save calls `updateAssignmentItems`, no "Regenerate Embeddings" button
- [ ] Delete works for all three types (passes docType correctly)
- [ ] SSE progress works for all three types (parsing_pdf → extracting → saving → complete)
- [ ] Error during parsing marks correct table's record as 'error' (not stuck in 'parsing')
- [ ] Tab switch during parsing doesn't break "View Details" navigation
- [ ] `uploadDocument` server action rejects non-lecture types with clear error

**Step 6: Commit**

```
chore(rag): verify three-domain table separation
```
