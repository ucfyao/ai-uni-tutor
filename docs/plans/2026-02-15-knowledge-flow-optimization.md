# Knowledge Flow Complete Optimization

## Goal

Optimize the entire Knowledge Base flow: detail page refactor, list page enhancement (search, sort, skeleton, empty state), and UX coherence.

## Current State

- **List page** (`/knowledge`): Already optimized — always-visible drop bar, localStorage prefs, inline progress bar above table, KnowledgeTable with Eye button navigation
- **Detail page** (`/knowledge/[id]`): 1017-line single file, no i18n, hardcoded English, card-based chunk display, inconsistent with list page design language
- **UX flow**: Upload completion has no guidance, no search/sort

---

## Phase 1: Document Detail Page Refactor

### 1.1 Layout — ChatPageLayout Style

Replace `<Container size="md" py={48}>` with ChatPageLayout pattern:

```
┌─ 52px Header Bar ─────────────────────────────────────────┐
│  ← Back   │  doc-name.pdf (editable)  │  [Lecture] [UNSW] │
└───────────────────────────────────────────────────────────┘
┌─ ScrollArea (flex: 1) ────────────────────────────────────┐
│  Stack gap="md" maw={900} mx="auto"                       │
│                                                           │
│  12 knowledge points                                      │
│                                                           │
│  ┌─ Table ─────────────────────────────────────────────┐  │
│  │  # │ Title         │ Definition (truncated) │ Actions│  │
│  │  1 │ Gradient...   │ An optimization alg... │  ✏  🗑 │  │
│  │  ┌─ inline edit (expanded row) ──────────────────┐  │  │
│  │  │  Title:      [____________]                   │  │  │
│  │  │  Definition: [________________________]       │  │  │
│  │  │  Formulas:   [________________________]       │  │  │
│  │  │                          [Cancel] [Save]      │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  │  3 │ Regulariz...  │ Technique to prevent... │  ✏  🗑 │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
┌─ Sticky Footer ───────────────────────────────────────────┐
│  2 pending changes                  [Regenerate] [Save]   │
└───────────────────────────────────────────────────────────┘
```

- **Header**: 52px bar, back button + editable document name + doc_type/school/course/status badges
- **Mobile**: Header injected into HeaderContext (same pattern as list page)
- **Content**: `ScrollArea` with `Stack gap="md" maw={900} mx="auto"`
- **Footer**: Sticky bottom action bar (Regenerate Embeddings + Save Changes)

### 1.2 Table Display — Driven by doc_type

Instead of card-based sections, use a Table with columns determined by `doc_type`:

**Lecture (knowledge points):**

| Column     | Width | Content               |
| ---------- | ----- | --------------------- |
| #          | 5%    | Row index             |
| Title      | 25%   | Knowledge point title |
| Definition | 50%   | Content, truncated    |
| Actions    | 10%   | Edit + Delete buttons |

**Exam (questions):**

| Column  | Width | Content                  |
| ------- | ----- | ------------------------ |
| #       | 5%    | Row index                |
| Q#      | 10%   | Question number          |
| Content | 45%   | Question text, truncated |
| Score   | 10%   | Points                   |
| Actions | 10%   | Edit + Delete buttons    |

**Assignment / Fallback:**

| Column  | Width | Content                      |
| ------- | ----- | ---------------------------- |
| #       | 5%    | Row index                    |
| Content | 75%   | Raw chunk content, truncated |
| Actions | 10%   | Edit + Delete buttons        |

- Use the document's `doc_type` (from metadata) to choose columns, not chunk detection
- Mobile: Table -> Stack of compact rows (title + truncated content + action icons)
- Chunk count shown as badge above table (e.g., "12 knowledge points")

### 1.3 Inline Editing

When user clicks Edit (pencil icon):

- The row expands below into an edit form
- Other rows remain visible but dimmed
- Edit fields vary by doc_type:
  - **Lecture**: Title, Definition (textarea), Key Formulas (textarea, one per line), Key Concepts (textarea), Examples (textarea)
  - **Exam**: Q#, Score, Content (textarea), Options (textarea), Answer (textarea)
  - **Fallback**: Content (textarea)
- Cancel/Save buttons at bottom of expanded form
- Save updates local state (same as current behavior)
- Delete is immediate (no confirmation dialog) — marks chunk as deleted locally

### 1.4 Component Split

Current: 1017-line `DocumentDetailClient.tsx`

Split into:

| File                       | Responsibility                                      | ~Lines |
| -------------------------- | --------------------------------------------------- | ------ |
| `DocumentDetailClient.tsx` | Main container + state management                   | ~120   |
| `DocumentDetailHeader.tsx` | Header bar + name editing + badges                  | ~80    |
| `ChunkTable.tsx`           | Table layout, delegates to type-specific columns    | ~100   |
| `ChunkEditForm.tsx`        | Inline edit form (switches fields by doc_type)      | ~120   |
| `ChunkActionBar.tsx`       | Sticky footer (pending changes + save + regenerate) | ~60    |

### 1.5 Full i18n

All hardcoded English -> `useLanguage()` + `t.documentDetail.*` keys.

New translation keys needed (~25):

- `documentDetail.backToKnowledge`, `documentDetail.pendingChanges`, `documentDetail.noChanges`
- `documentDetail.knowledgePoints`, `documentDetail.questions`, `documentDetail.chunks`
- `documentDetail.title`, `documentDetail.definition`, `documentDetail.keyFormulas`
- `documentDetail.keyConcepts`, `documentDetail.examples`, `documentDetail.questionNumber`
- `documentDetail.content`, `documentDetail.options`, `documentDetail.answer`, `documentDetail.score`
- `documentDetail.saveChanges`, `documentDetail.regenerateEmbeddings`
- `documentDetail.editChunk`, `documentDetail.deleteChunk`, `documentDetail.cancel`, `documentDetail.save`
- `documentDetail.updated`, `documentDetail.saved`, `documentDetail.nameUpdated`
- `documentDetail.showAnswer`, `documentDetail.hideAnswer`

### 1.6 Visual Consistency

- Cards: `radius="lg"` everywhere (consistent with list page)
- No `<Divider />` (use spacing instead)
- Badge styles: match KnowledgeTable (`variant="light"`)
- Edit form: `bg="var(--mantine-color-indigo-0)"` background (keep current)
- Action buttons: same subtle icon buttons as KnowledgeTable

---

## Phase 2: List Page Enhancement

### 2.1 Search Box

Add a search input between SegmentedControl and drop bar:

```
┌─ [Lecture] [Assignment] [Exam] ──────────────────────┐
│                                                       │
│  🔍 Search documents...                              │
│                                                       │
│  ┌─ ─ ─ Drop PDF here or browse ─ ─ ─┐              │
```

- `TextInput` with search icon, placeholder "Search documents..." / "搜索文档..."
- Client-side filter: `documents.filter(d => d.name.toLowerCase().includes(query))`
- Debounce 200ms via `useDebouncedValue` from `@mantine/hooks`
- Mobile: full-width search input

### 2.2 Sortable Table Headers

Click Name or Date column headers to toggle sort:

```
│  NAME ↓         UNI    COURSE   DATE    STATUS      │
│  lecture-3.pdf  UNSW   9417     Feb 14  ● Ready     │
```

- Click to toggle: none -> ascending -> descending -> none
- Arrow icon (↑/↓) indicates active sort direction
- Default: Date descending (newest first)
- Implementation: `useMemo` to derive sorted list from `[documents, sortField, sortDir]`
- Sortable columns: Name, Date (others not sortable — keeps it simple)

### 2.3 Skeleton Loading

Replace `<Loader size="sm" />` with skeleton rows:

- Desktop: 3 skeleton `Table.Tr` rows matching column widths
- Mobile: 3 skeleton Cards matching card layout
- Smooth fade transition to real data

### 2.4 Empty State Guidance

Replace plain "No documents" text:

```
     📄 (FileText icon, 40px)

   No documents uploaded yet
   Drop a PDF above to start building your knowledge base
```

- Larger icon (40px, gray-4)
- Two-line text: title + subtitle pointing to drop bar
- i18n: add `t.knowledge.uploadGuide` key

---

## Phase 3: UX Coherence

### 3.1 Upload Completion Guidance

After parsing completes, progress bar stays visible with a "View Details" link:

```
│  ████████████████████  ✓ 10 knowledge points   [View Details] [✕] │
```

- "View Details" text button navigates to `/knowledge/[documentId]`
- Auto-fade (opacity transition) after 5s, but remains clickable
- documentId available from `parseState.documentId`
- User stays on list page (no auto-redirect)

### 3.2 Unified Notification i18n

All notifications use i18n keys:

- Detail page: "Updated" -> `t.documentDetail.updated`
- Detail page: "Saved" -> `t.documentDetail.saved`
- Detail page: "Error" -> `t.knowledge.error`
- Detail page: "Done" -> `t.knowledge.success`
- All hardcoded strings in `DocumentDetailClient.tsx` -> translation keys

### 3.3 Chunk Delete — Direct (No Confirmation)

- Clicking delete immediately marks chunk as deleted locally
- No confirmation dialog (document-level delete keeps its modal)
- User can undo by not saving (pending changes are local)
- "pending changes" counter in footer tracks deletions

---

## What Stays the Same

- SegmentedControl (Lecture / Assignment / Exam)
- Upload flow (always-visible drop bar + localStorage prefs)
- Upload progress bar above table (already optimized)
- useStreamingParse hook (no changes)
- Server actions / services / repositories (no data layer changes)
- Delete confirmation modal for documents (keep as-is)

## Components Affected

| File                       | Change                                                |
| -------------------------- | ----------------------------------------------------- |
| `DocumentDetailClient.tsx` | Rewrite: ChatPageLayout + table + inline edit         |
| `DocumentDetailHeader.tsx` | New: header bar component                             |
| `ChunkTable.tsx`           | New: table display by doc_type                        |
| `ChunkEditForm.tsx`        | New: inline edit form by doc_type                     |
| `ChunkActionBar.tsx`       | New: sticky footer component                          |
| `KnowledgeClient.tsx`      | Add: search, skeleton, empty state, view details link |
| `KnowledgeTable.tsx`       | Add: sortable headers, skeleton support               |
| `translations.ts`          | Add ~30 new keys (EN + ZH)                            |
| `[id]/page.tsx`            | Minor: pass doc_type to client                        |
