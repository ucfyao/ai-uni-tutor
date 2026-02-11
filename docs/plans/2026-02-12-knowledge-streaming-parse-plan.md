# Knowledge Streaming Parse - Implementation Plan

Date: 2026-02-12
Design: docs/plans/2026-02-12-knowledge-streaming-parse-design.md

## Phase 1: SSE API Route (Backend Core)

### Step 1.1: Create SSE helper utilities

**File:** `src/lib/sse.ts` (new)

- Helper function to create SSE-formatted strings: `sseEvent(event, data)`
- Type definitions for SSE event payloads (StatusEvent, ItemEvent, BatchSavedEvent, ProgressEvent, ErrorEvent)

### Step 1.2: Create POST /api/documents/parse route

**File:** `src/app/api/documents/parse/route.ts` (new)

- Accept FormData (file, docType, school, course, hasAnswers)
- Return `text/event-stream` response with `ReadableStream`
- Pipeline inside the stream:
  1. Auth check (getCurrentUser)
  2. Quota check (QuotaService)
  3. Validate inputs (Zod, same schema as current uploadDocument)
  4. Duplicate check (DocumentService)
  5. Create document record (status: 'processing')
  6. Send SSE: status "parsing_pdf"
  7. Parse PDF (parsePDF)
  8. Send SSE: status "extracting"
  9. Call appropriate parser (parseLecture / parseQuestions)
  10. Iterate items, for each: send SSE: item event
  11. Every 3 items: generate embeddings + batch save to DB, send SSE: batch_saved
  12. Final batch: save remaining items
  13. Send SSE: status "complete"
  14. Update document status to 'ready'
- Error handling: catch at each stage, send SSE: error, update doc status to 'error'
- Reuse existing: DocumentService, QuotaService, parseLecture, parseQuestions, parsePDF, generateEmbeddingWithRetry

## Phase 2: Client Hook

### Step 2.1: Create useStreamingParse hook

**File:** `src/hooks/useStreamingParse.ts` (new)

- Uses `fetch` + `ReadableStream` reader to consume SSE
- State: items[], status, progress, savedChunkIds Set, error, documentId
- `startParse(file, metadata)`: POST to /api/documents/parse, read stream
- Parse SSE text format, dispatch events to update state
- On 'item' event: append to items array
- On 'batch_saved' event: add chunk IDs to savedChunkIds
- On 'progress' event: update progress
- On 'status' event: update status
- On 'error' event: set error state
- Handle stream close/error (network disconnect)
- Return: { startParse, items, status, progress, savedChunkIds, error, documentId, reset }

## Phase 3: UI Components

### Step 3.1: Create ParsedItemCard component

**File:** `src/components/rag/ParsedItemCard.tsx` (new)

- Props: item (KnowledgePoint | ParsedQuestion), type, saved (boolean), index
- Renders based on type:
  - Knowledge point: title, definition, formulas (Code), concepts (Badge), examples
  - Question: number badge, content, options, answer (collapsible)
- Mantine Card with entry animation (CSS transition: opacity + translateY)
- Save indicator: Loader (pending) or CheckIcon (saved)
- Read-only during parsing (no edit controls)
- Reuse rendering patterns from DocumentDetailClient.tsx KnowledgePointSection / QuestionSection

### Step 3.2: Create ParsePanel component

**File:** `src/components/rag/ParsePanel.tsx` (new)

- Props: useStreamingParse return value + onBack callback + fileName
- Layout:
  - Header: Back button + file name
  - Progress bar (Mantine Progress) + status text + counter "5/12"
  - Card grid: map items → ParsedItemCard with staggered animation delay
  - Skeleton placeholders for remaining items (based on progress.total)
  - Completion state: success message + "Back to List" button (prominent)
  - Error state: error message + "Retry" button
- Auto-scroll to bottom as new cards appear (scrollIntoView)

## Phase 4: Refactor KnowledgeClient

### Step 4.1: Refactor KnowledgeClient.tsx into page controller

**File:** `src/app/(protected)/knowledge/KnowledgeClient.tsx` (modify)

- Add page state: `'list' | 'parsing'`
- Add Tab bar (Mantine Tabs): Lecture / Exam / Assignment / All
  - Tab changes filter the document list passed to KnowledgeTable
- Redesign upload area (inline, not modal):
  - Course + School selectors (keep existing logic)
  - Dropzone for PDF
  - "Start Parse" button (replaces "Upload" button)
  - Has Answers toggle (visible for exam/assignment tabs)
- On "Start Parse" click:
  - Switch page state to 'parsing'
  - Call useStreamingParse.startParse()
- On "Back to List" from ParsePanel:
  - Switch page state to 'list'
  - Invalidate React Query cache to refresh document list
- Pass filtered documents to KnowledgeTable based on active tab

### Step 4.2: Update page.tsx server component

**File:** `src/app/(protected)/knowledge/page.tsx` (modify)

- Pass documents to the refactored KnowledgeClient
- Remove UploadButton import (merged into KnowledgeClient)

## Phase 5: Adjust KnowledgeTable

### Step 5.1: Adapt KnowledgeTable to new layout

**File:** `src/components/rag/KnowledgeTable.tsx` (modify)

- Accept filtered documents based on active tab (already works via props)
- Keep real-time subscription (still needed for status updates)
- Keep existing delete/retry functionality
- The "View" action navigates to /knowledge/[id] detail page (unchanged)
- Remove any redundant document type display (tabs handle filtering now)

## Phase 6: Cleanup

### Step 6.1: Simplify server actions

**File:** `src/app/actions/documents.ts` (modify)

- Keep uploadDocument for backwards compatibility (or remove if fully replaced)
- Keep deleteDocument, updateDocumentChunks, regenerateEmbeddings, retryDocument, updateDocumentMeta
- The main upload pipeline is now in the API route, but server actions are still used for mutations

## Implementation Order

1. Phase 1 (SSE Route) - backend foundation, can test with curl
2. Phase 2 (Hook) - client-side SSE consumer
3. Phase 3 (UI Components) - ParsedItemCard + ParsePanel
4. Phase 4 (Refactor KnowledgeClient) - wire everything together
5. Phase 5 (Adjust KnowledgeTable) - minor tweaks
6. Phase 6 (Cleanup) - remove dead code

## Testing Strategy

- Manual test: upload a PDF, verify SSE events in browser DevTools (Network tab)
- Manual test: verify cards appear one by one with animation
- Manual test: verify batch save (check DB after each batch)
- Manual test: verify "Back to List" works (parsing continues, document appears)
- Manual test: verify error handling (upload empty PDF, disconnect network)
- Build check: `npm run build` passes
