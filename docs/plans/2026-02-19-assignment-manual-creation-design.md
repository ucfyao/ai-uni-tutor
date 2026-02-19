# Assignment Manual Creation & Enhanced Editing

## Problem

Assignment creation only supports PDF upload + LLM auto-parsing. When parsing is inaccurate (wrong question splits, garbled content), users cannot:

1. Create assignments from scratch without a PDF
2. Add new items to an existing assignment
3. Easily fix badly-parsed items (editing each one is painful)

## Solution

Two changes:

1. **New creation flow for Assignments**: lightweight modal (title + course) creates an empty record, then redirects to the detail page
2. **Enhanced detail page**: collapsible upload area + "Add Item" button on top of the items table

Lecture and Exam flows remain unchanged.

## Creation Flow

### Before

```
Knowledge list → "+" → Upload Modal (PDF + course) → LLM parse → complete → detail page
```

### After (Assignment only)

```
Knowledge list → "+" (on Assignment tab) → Lightweight Modal (title + university + course) → Create empty record → Redirect to detail page
```

- Modal: uses `FullScreenModal` wrapper (per project convention)
- Modal fields: Title (required), University (required), Course (required)
- Creates `assignments` record with `status='draft'`, no items
- Redirects to `/admin/knowledge/[id]?type=assignment`
- Lecture and Exam tabs still open the existing Upload Modal

## Detail Page Layout

```
┌─────────────────────────────────────────┐
│ Header (unchanged)                      │
├─────────────────────────────────────────┤
│ ┌─ Upload Area (collapsible) ────────┐  │
│ │ Dropzone + Parse button            │  │
│ └────────────────────────────────────┘  │
│                                         │
│ ┌─ Items Table ──────────────────────┐  │
│ │ [+ Add Item]        N items        │  │
│ │ ┌──────────────────────────────┐   │  │
│ │ │ 1. question | answer | pts   │   │  │
│ │ └──────────────────────────────┘   │  │
│ └────────────────────────────────────┘  │
│                                         │
│ [Save Changes]                          │
└─────────────────────────────────────────┘
```

### Upload Area Behavior

- **0 items**: expanded by default, shows Dropzone + parse button (university/course from assignment record, no selectors)
- **1+ items**: collapsed by default, expandable via click/toggle
- On parse: SSE stream appends new items to existing list (no replacement)
- University/course pre-filled from the assignment record

### Add Item Button

- Position: top of the items table, alongside the item count badge
- Action: appends a new empty item at the end of the list, auto-enters edit mode
- New item fields: question type (dropdown: multiple_choice / short_answer / fill_in_blank / true_false / essay), content, reference answer, explanation, points, difficulty
- New items are tracked in local state until saved

## New Component: Detail Page Upload Area

New component at `src/components/rag/AssignmentUploadArea.tsx`:

- **Props**: `assignmentId`, `universityId`, `courseId`, `itemCount`, `onParseComplete`
- **Contains**: Dropzone (PDF) + parse button + SSE streaming progress
- **No university/course selectors** — values come from the assignment record (props)
- **Collapsible**: wrapped in Mantine `Collapse`; expanded by default when `itemCount === 0`, collapsed when `itemCount > 0`
- **On parse complete**: calls `onParseComplete` → parent calls `router.refresh()`

Upload Modal in `KnowledgeClient.tsx` remains unchanged — it is only used for Lecture/Exam creation flow.

## Data Layer Changes

### New Action File: `src/app/actions/assignments.ts`

Separate from `documents.ts`. All assignment-specific actions live here.

#### `createEmptyAssignment`

- Input: `{ title: string, universityId: string, courseId: string }`
- Delegates to `AssignmentService.createEmpty()`
- Returns the new assignment ID
- Auth: `requireAnyAdmin()`

#### `addAssignmentItem`

- Input: `{ assignmentId: string, type: string, content: string, referenceAnswer?: string, explanation?: string, points?: number, difficulty?: string }`
- Delegates to `AssignmentService.addItem()`
- Auth: `requireAnyAdmin()` + `requireAssignmentAccess()`

#### Auth helper: extract `requireAssignmentAccess`

`requireAssignmentAccess()` is currently a local function in `documents.ts`. Extract it to a shared location (e.g., `src/lib/supabase/server.ts` alongside `requireAnyAdmin`) so both `documents.ts` and `assignments.ts` can import it.

### New Service: `AssignmentService`

- `createEmpty(userId, data)`: create assignment record with `status='draft'`, return ID. `userId` comes from auth in the action layer.
- `addItem(assignmentId, data)`: query max `order_num`, insert item with next `order_num`, generate embedding via `generateEmbedding()`, return item

### Repository Changes

- `AssignmentRepository.getMaxOrderNum(assignmentId)`: return current max `order_num` (or 0 if no items)
- `AssignmentRepository.insertSingleItem(assignmentId, data)`: insert one item with specified `order_num`
- Embedding generation: reuse existing `generateEmbedding()` from RAG pipeline

### Parse Route Modification

- Before inserting parsed items, query existing items for the assignment
- **Content-based deduplication**: compare parsed item `content` against existing items, skip duplicates
- **Order number offset**: new (non-duplicate) items start from `max(order_num) + 1`
- No deletion of existing items during re-parse

## Database Schema Changes

### Add `'draft'` to assignment status

- **Supabase migration**: `ALTER TYPE assignment_status ADD VALUE 'draft'` (if status is a Postgres enum), or no migration needed if status is plain `text`
- **TypeScript types**: add `'draft'` to `AssignmentStatus` union in:
  - `src/lib/domain/models/Assignment.ts`
  - `src/types/database.ts` (Row/Insert/Update types)
  - `src/lib/repositories/AssignmentRepository.ts` (type cast)
- **Knowledge list page**: no filter changes needed — `findAllForAdmin()` / `findByCourseIds()` return all statuses, `'draft'` will appear automatically
- **Detail page status display**: add `'draft'` case to `statusColor()` in `types.ts` (e.g., `'draft' → 'blue'`)

### No other schema changes

- `assignment_items.order_num` supports ordering
- `assignment_items.embedding` supports RAG retrieval

## Cache Invalidation

- **Knowledge list page** (TanStack Query): after `createEmptyAssignment`, invalidate `queryKeys.documents.byType('assignment')` to refresh the list
- **Detail page** (Server Component props): after `addAssignmentItem` or parse-append, call `router.refresh()` to refetch server data

## i18n

New keys required in both `en.ts` and `zh.ts`:

- Lightweight modal: title, submit button, cancel
- Add Item button label
- Question type dropdown options (multiple_choice, short_answer, fill_in_blank, true_false, essay)
- Collapsible upload area toggle text
- Empty assignment state message (0 items prompt)

## Scope Exclusions

- No changes to Lecture or Exam flows
- No changes to Assignment Coach chat (RAG retrieval works the same)
- No bulk import from text (future enhancement)
