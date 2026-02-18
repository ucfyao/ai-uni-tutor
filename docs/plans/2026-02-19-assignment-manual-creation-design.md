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

- Modal fields: Title (required), University (required), Course (required)
- Creates `assignments` record with `status='ready'`, no items
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

- **0 items**: expanded by default, shows Dropzone + university/course selectors + parse button
- **1+ items**: collapsed by default, expandable via click/toggle
- On parse: SSE stream appends new items to existing list (no replacement)
- University/course pre-filled from the assignment record

### Add Item Button

- Position: top of the items table, alongside the item count badge
- Action: appends a new empty item at the end of the list, auto-enters edit mode
- New item fields: content, reference answer, explanation, points, difficulty (same as existing edit form)
- New items are tracked in local state until saved

## Data Layer Changes

### New Server Action: `createEmptyAssignment`

- Input: `{ title: string, universityId: string, courseId: string }`
- Creates `assignments` record: `status='ready'`, `school` from university, `course` from course code
- Returns the new assignment ID
- Auth: `requireAnyAdmin()`

### New Server Action: `addAssignmentItem`

- Input: `{ assignmentId: string, content: string, referenceAnswer?: string, explanation?: string, points?: number, difficulty?: string }`
- Creates `assignment_items` record with next `order_num`
- Generates embedding via existing embedding pipeline
- Auth: `requireAnyAdmin()` + `requireAssignmentAccess()`

### Repository Changes

- `AssignmentRepository.createEmpty(data)`: insert assignment with status='ready'
- `AssignmentRepository.insertSingleItem(assignmentId, data)`: insert one item, auto-assign order_num
- Embedding generation: reuse existing `generateEmbedding()` from RAG pipeline

### Parse Route Modification

- When parsing PDF for an existing assignment that already has items, append new items after the last `order_num`
- No deletion of existing items during re-parse

## No Database Schema Changes

Existing `assignments` and `assignment_items` tables support all requirements:

- `assignments.status` already has `'ready'` as a valid value
- `assignment_items.order_num` supports ordering
- `assignment_items.embedding` supports RAG retrieval

## Scope Exclusions

- No changes to Lecture or Exam flows
- No changes to Assignment Coach chat (RAG retrieval works the same)
- No bulk import from text (future enhancement)
