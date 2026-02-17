# Knowledge: Three-Domain Table Separation

## Problem

Currently, all three document types (lecture, exam, assignment) share the `documents` table as parent and `document_chunks` as storage. This is problematic because:

1. **Exam** already has dedicated tables (`exam_papers` + `exam_questions`) that aren't used by the knowledge parsing pipeline
2. **Assignment** has no dedicated table — structured question data is crammed into `document_chunks.metadata` JSON
3. **Lecture** uses both `knowledge_cards` (structured) AND `document_chunks` (RAG embedding) — this is correct
4. Exam/assignment data gets unnecessary embeddings (they don't need RAG)

## Goal

Three completely independent business domains, each with its own tables:

| Domain     | Parent Table  | Child Table(s)                        | Embedding | Status                                 |
| ---------- | ------------- | ------------------------------------- | --------- | -------------------------------------- |
| Lecture    | `documents`   | `knowledge_cards` + `document_chunks` | Yes (RAG) | No change                              |
| Exam       | `exam_papers` | `exam_questions`                      | No        | Tables exist, pipeline needs rerouting |
| Assignment | `assignments` | `assignment_items`                    | No        | New tables needed                      |

## Architecture

### Lecture Domain (no change)

- `documents` — parent (becomes lecture-only; no rename needed)
- `knowledge_cards` — structured knowledge points with embedding
- `document_chunks` — RAG chunks with embedding (used by `match_documents`, `hybrid_search`)
- **Upload only** → auto-parse → embedding

### Exam Domain (reroute existing tables)

- `exam_papers` — already exists, self-sufficient parent
  - Has: `user_id`, `title`, `school`, `course`, `year`, `visibility`, `status`, `question_types`
  - Has `document_id` nullable FK — keep but no longer required
- `exam_questions` — already exists
  - Has: `paper_id`, `order_num`, `type`, `content`, `options`, `answer`, `explanation`, `points`, `metadata`
- **Upload or manual create** (manual deferred to later PR)
- **No embedding** — questions are retrieved by paper_id, not semantic search

### Assignment Domain (new tables)

- `assignments` — new parent table (mirrors `exam_papers` structure)
- `assignment_items` — new child table
- **Upload or manual create** (manual deferred to later PR)
- **No embedding**

## New Tables

### `assignments`

```sql
create table assignments (
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
```

### `assignment_items`

```sql
create table assignment_items (
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
    select 1 from assignments where assignments.id = assignment_items.assignment_id
    and assignments.user_id = auth.uid()
  ));
```

## Changes

### 1. Parsing Pipeline

**SSE Route** (`/api/documents/parse`):

- **Lecture**: Create `documents` record → parse → embed → save to `knowledge_cards` + `document_chunks` (no change)
- **Exam**: Create `exam_papers` record → parse → save to `exam_questions` (NO embedding)
- **Assignment**: Create `assignments` record → parse → save to `assignment_items` (NO embedding)

**`DocumentProcessingService.processWithLLM`**: Same routing logic.

### 2. Knowledge Page List

`fetchDocuments(docType)` dispatches internally:

- `lecture` → query `documents` where `doc_type = 'lecture'`
- `exam` → query `exam_papers`
- `assignment` → query `assignments`

All return a normalized `KnowledgeDocument` shape for the list UI.

### 3. Detail Page

`/admin/knowledge/[id]?type=<lecture|exam|assignment>`:

- **lecture** → fetch `documents` + `document_chunks` (no change)
- **exam** → fetch `exam_papers` + `exam_questions`
- **assignment** → fetch `assignments` + `assignment_items`

### 4. CRUD Operations

Each domain gets its own save/update/delete flow. `updateDocumentChunks` becomes lecture-only. New actions for exam question and assignment item CRUD.

## Scope

**In scope (this PR):**

- Create `assignments` + `assignment_items` tables
- New domain models and repository for assignments
- Update parsing pipeline to route exam/assignment to correct tables
- Update knowledge page to query correct tables per tab
- Update detail page to read/write correct tables per type
- Update server actions for type-specific CRUD
- Update `database.ts` types

**Deferred:**

- Manual creation for exam/assignment
- Re-parse button
- File storage for re-parsing
- Cleanup of existing `document_chunks` exam/assignment data (user handles)

## Files

**New:**

- `src/lib/domain/models/Assignment.ts` — Assignment + AssignmentItem entities
- `src/lib/domain/interfaces/IAssignmentRepository.ts`
- `src/lib/repositories/AssignmentRepository.ts`
- Supabase migration SQL

**Modify:**

- `src/types/database.ts` — add `assignments` + `assignment_items`
- `src/lib/repositories/index.ts` — export new repository
- `src/app/api/documents/parse/route.ts` — route exam/assignment to own tables
- `src/lib/services/DocumentProcessingService.ts` — same routing
- `src/app/actions/documents.ts` — dispatch fetch/delete by type, new CRUD actions
- `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx` — type-aware upload + list
- `src/app/(protected)/admin/knowledge/[id]/page.tsx` — type-aware data fetching
- `src/app/(protected)/admin/knowledge/[id]/DocumentDetailClient.tsx` — handle different data sources
- `src/app/(protected)/admin/knowledge/[id]/ChunkTable.tsx` — render from correct data shape
- `src/app/(protected)/admin/knowledge/[id]/ChunkEditForm.tsx` — edit correct data shape
- `src/app/(protected)/admin/knowledge/[id]/ChunkActionBar.tsx` — save to correct table
- `src/components/rag/KnowledgeTable.tsx` — normalize display
