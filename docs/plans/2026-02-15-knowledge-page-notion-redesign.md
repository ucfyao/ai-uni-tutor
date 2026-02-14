# Knowledge Page Notion-Style Interaction Redesign

**Date**: 2026-02-15
**Scope**: Full interaction model redesign for `/knowledge` page
**Style**: Notion database — inline everything, powerful filtering, batch operations
**Vision**: Transform from a simple document list into a full database-style document manager

## Problem Statement

The knowledge page has gone through 6+ iterations focused on visual polish (Notion-style colors, shadows, hover effects), but the core interaction model remains unchanged:

- Rigid doc-type tabs with no search or compound filtering
- Upload is a collapsible panel that switches to a separate parse mode
- No batch operations, no sorting, no inline progress
- Finding documents in a growing list requires scrolling

The visual improvements were necessary but insufficient — the floor plan needs redesigning, not the paint.

## Goals

1. Transform document management into a Notion database-style experience
2. Eliminate all mode switches — everything happens on one view
3. Add search, compound filtering, sorting, and batch operations
4. Show processing progress inline in the table, not in a separate view
5. Move upload to a focused modal overlay

---

## Architecture

### Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base                              [+ Upload]     │
│  Manage your course documents                               │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search...   [Type ▾] [University ▾] [Course ▾] [Status ▾] [Sort ▾]  │
├─────────────────────────────────────────────────────────────┤
│  ✓ 3 selected    [🗑 Delete]  [🔄 Re-process]  [✕ Clear]    │  ← bulk toolbar (when selected)
│─────────────────────────────────────────────────────────────│
│  ☐  📄 Midterm Exam 2024.pdf    UNSW    COMP1511   Feb 14   ● Ready        │
│  ☐  📄 Lecture Week 3.pdf       USYD    INFO1110   Feb 13   ● Ready        │
│  ☐  📄 Assignment 1 Spec.pdf    UNSW    COMP1511   Feb 12   ◉ ████░░ 40%  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Filter Bar

- **Search input**: debounced (300ms), filters across document name, university, course
- **Filter dropdowns** (Mantine `Select` or `Popover`):
  - Type: lecture / exam / assignment (multi-select)
  - University: populated from document metadata
  - Course: populated from document metadata, cascades with university
  - Status: ready / processing / error
- **Sort dropdown**: date (newest first, default), date (oldest), name A-Z, name Z-A, status
- All filters are AND logic, applied client-side
- Active filters shown as removable chips below the bar
- "Clear all filters" button when any filter is active

### Table with Selection

**Checkbox column:**

- Left-most column with individual row checkboxes
- "Select all" checkbox in header (selects visible/filtered rows only)
- Shift+click for range selection

**Columns (desktop):**
| Column | Width | Sortable | Content |
|--------|-------|----------|---------|
| ☐ | 40px | no | Checkbox |
| Name | 30% | yes | File icon + name (indigo, underline on hover) |
| University | 14% | yes | Text |
| Course | 14% | yes | Badge |
| Date | 12% | yes | Formatted date |
| Status | 20% | yes | Badge or inline progress bar |
| Actions | 10% | no | Hover-reveal icons |

**Sortable headers:**

- Click to toggle ascending/descending
- Arrow icon indicates active sort + direction
- Default: date descending (newest first)

### Bulk Action Toolbar

Appears above the table when 1+ rows are selected:

- Shows count: "3 selected"
- Actions: Delete (red), Re-process (orange)
- Clear selection button
- Confirmation modal for destructive batch actions

### Inline Status & Progress

- `ready` → green dot badge (unchanged)
- `processing` → mini Mantine `Progress` bar (indigo, height 6px) + percentage text. Updates via SSE reuse or polling (5s interval)
- `error` → red dot badge + error tooltip + retry action icon (inline)

No mode switch. No separate parse view. The table IS the status view.

### Upload Modal

Triggered by `+ Upload` button in header:

```
┌─────────────────────────────────────────────────┐
│           Upload Document                    ✕  │
│─────────────────────────────────────────────────│
│   ┌─────────────────────────────────────────┐   │
│   │      📄 Drop PDF here or browse         │   │
│   │         Up to 5MB                       │   │
│   └─────────────────────────────────────────┘   │
│                                                 │
│   Type         [Lecture ▾]                      │
│   University   [Select ▾]                       │
│   Course       [Select ▾]                       │
│                                                 │
│                          [Cancel] [Upload →]    │
└─────────────────────────────────────────────────┘
```

- All fields in one view (no multi-step)
- On submit: modal closes, document appears in table with `processing` status
- Upload uses existing `useStreamingParse` hook, but progress updates the table row
- Validation: file required, all fields required, same rules as current

### Mobile Experience

- Search input full-width above horizontal-scrolling filter chips
- Card list with checkboxes (left side of each card)
- Long-press to enter selection mode (native feel)
- Inline progress bar in card status area
- FAB (floating action button) bottom-right for upload → opens modal as bottom sheet
- Bulk action bar slides up from bottom when items selected
- Sort button next to search bar

---

## Data Layer Changes

### New Server Action: `fetchAllDocuments()`

Returns all documents for the current user regardless of type. Replaces `fetchDocuments(docType)` as the primary data source.

```typescript
export async function fetchAllDocuments(): Promise<DocumentListItem[]>;
```

All filtering (search, type, university, course, status) happens **client-side** on the full list. This is appropriate because:

- Per-user document count is typically < 200
- Provides instant filter UX with no server round-trips
- Simplifies implementation

### New Server Action: `batchDeleteDocuments(ids: string[])`

Batch delete with ownership verification for all IDs.

```typescript
export async function batchDeleteDocuments(
  ids: string[],
): Promise<{ status: 'success' | 'error'; message: string; deletedCount: number }>;
```

### Existing Actions (unchanged)

- `uploadDocument` — keep as-is
- `deleteDocument` — keep as-is (single delete still used from row action)
- `updateDocumentChunks`, `regenerateEmbeddings`, `updateDocumentMeta` — unchanged
- `retryDocument` — unchanged

### Query Strategy

- Single query key: `queryKeys.documents.all` for the full document list
- Client-side memo: `useMemo` to derive filtered + sorted list from filters state
- Optimistic updates on delete (remove from cache)
- On upload complete: invalidate `documents.all` to refetch

---

## Component Architecture

### New Components

| Component            | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `KnowledgeFilterBar` | Search input + filter dropdowns + sort + active filter chips |
| `UploadModal`        | Modal with dropzone + metadata fields + submit               |
| `BulkActionToolbar`  | Floating toolbar for batch operations on selected rows       |
| `InlineProgress`     | Small progress bar component for status column               |

### Modified Components

| Component         | Changes                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `KnowledgeClient` | Remove `mode` state, remove collapsible upload, add filter/sort/selection state, use `fetchAllDocuments` |
| `KnowledgeTable`  | Add checkbox column, sortable headers, inline progress, update props interface                           |

### Removed Components

| Component        | Reason                                   |
| ---------------- | ---------------------------------------- |
| `ParsePanel`     | No more mode switch — progress is inline |
| `ParseTimeline`  | Simplified to inline progress bar        |
| `ParsedItemCard` | No longer needed                         |

### Kept As-Is

| Component              | Reason                                                  |
| ---------------------- | ------------------------------------------------------- |
| `DocumentDetailClient` | `/knowledge/[id]` detail page is out of scope           |
| `useStreamingParse`    | Reused, but consumed by table row instead of ParsePanel |

---

## Visual Standards

Carry forward from existing design, no visual changes needed:

| Element       | Spec                                   |
| ------------- | -------------------------------------- |
| Card border   | `1px solid gray-2`, no gradients       |
| Card radius   | `radius="lg"` (12px)                   |
| Card shadow   | `0 1px 3px rgba(0,0,0,0.04)`           |
| Primary color | indigo                                 |
| Transitions   | 150-250ms ease                         |
| Hover rows    | `gray-0` bg + inset indigo left border |
| Actions       | opacity 0 → 1 on hover                 |

---

## Out of Scope

- Document detail page (`/knowledge/[id]`) — unchanged
- Server-side search/pagination — client-side is sufficient
- Drag-and-drop reordering
- Folder/tag organization
- Export functionality
- Column visibility toggle (potential future enhancement)
- Keyboard shortcuts (potential future enhancement)
