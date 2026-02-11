# Knowledge Streaming Parse Design

Date: 2026-02-12

## Problem

The current knowledge upload flow is cumbersome: users must fill a form, upload, wait for background processing, then navigate to a separate detail page to see results. The parsing process feels like a black box with no real-time feedback.

## Goal

Redesign the knowledge upload flow into a single-page streaming experience where:

- Users upload a file and immediately see parsed results appear as streaming cards
- No page navigation required - everything happens on `/knowledge`
- Parsed data is saved in real-time batches

## User Flow

### State A: List Mode (Default)

```
+-----------------------------------------------+
|  [Lecture] [Exam] [Assignment]     <- Tabs     |
+-----------------------------------------------+
|  Upload Area                                   |
|  Course: [___v]  School: [___v]               |
|  +------------------------+                    |
|  |  Drag PDF here to upload|   [Start Parse >] |
|  +------------------------+                    |
+-----------------------------------------------+
|  doc1.pdf   Ready   12 items   [Expand v]     |
|  doc2.pdf   Ready    8 items   [Expand v]     |
|  doc3.pdf   Error   "..."      [Retry]        |
+-----------------------------------------------+
```

- Top: Tab bar to filter by document type (Lecture/Exam/Assignment)
- Upload area: Course + School selectors, file dropzone, "Start Parse" button
- Below: List of existing documents for the selected type

### State B: Parsing Mode (After Upload)

```
+-----------------------------------------------+
|  [<- Back to List]     lecture-01.pdf          |
|  ================-------  Extracting... 5/12   |
+-----------------------------------------------+
|  +- Knowledge Point 1 ----------------+  OK   |
|  | Title: Linear Regression            |       |
|  | Definition: A statistical method... |       |
|  | Formula: y = mx + b                |       |
|  +------------------------------------+       |
|  +- Knowledge Point 2 ----------------+  OK   |
|  | Title: Gradient Descent             |       |
|  | ...                                 |       |
|  +------------------------------------+       |
|  +- Knowledge Point 3 ----------------+  ...  |
|  | (fade-in animation - just appeared) |       |
|  +------------------------------------+       |
|                                                |
|  [ ] [ ] [ ]  <- skeleton placeholders        |
+-----------------------------------------------+
```

- File list is hidden during parsing
- Progress bar with `parsed/estimated total` (estimated from page count)
- Cards appear one by one with fade-in + slide-up animation
- Saved cards show checkmark, pending ones show spinner
- "Back to List" button available at all times (parsing continues in background)
- On completion: summary message + prominent "Back to List" button

## Technical Architecture

### Core Mechanism: Server-Sent Events (SSE) + Batch DB Writes

```
Client                    Server (API Route)              Gemini LLM
  |                           |                              |
  |-- POST /api/parse ------>|                              |
  |   (file + metadata)       |-- Create doc (processing) -->|
  |                           |-- Parse PDF ---------------->|
  |<-- SSE: "parsing_pdf" ---|                              |
  |                           |-- Call Gemini -------------->|
  |<-- SSE: "extracting" ----|                              |
  |                           |                 items[] <----|
  |<-- SSE: item[0] ---------|                              |
  |<-- SSE: item[1] ---------|                              |
  |<-- SSE: item[2] ---------|-- batch save [0,1,2] ------>|
  |<-- SSE: "batch_saved" ---|                              |
  |<-- SSE: item[3] ---------|                              |
  |<-- SSE: item[4] ---------|-- batch save [3,4] + embed ->|
  |<-- SSE: "complete" ------|-- doc status -> ready ------>|
```

**Why SSE over WebSocket/Supabase Realtime:**

- SSE is unidirectional push, exactly matching this use case (server -> client)
- Next.js Route Handler natively supports `ReadableStream`
- No extra Supabase channel management needed
- On disconnect, already-saved batches persist in DB

### SSE Event Types

| Event         | Payload                                                                   | Description                                                        |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `status`      | `{ stage: string, message: string }`                                      | Phase update (parsing_pdf, extracting, embedding, complete, error) |
| `item`        | `{ index: number, type: string, data: KnowledgePoint \| ParsedQuestion }` | Single parsed item                                                 |
| `batch_saved` | `{ chunkIds: string[], batchIndex: number }`                              | Batch persisted to DB                                              |
| `progress`    | `{ current: number, total: number }`                                      | Progress counter                                                   |
| `error`       | `{ message: string, code: string }`                                       | Error event                                                        |

### Batch Save Strategy

- Accumulate parsed items in memory
- Every 3-5 items: generate embeddings + insert batch to `document_chunks` table
- On final batch (< 3 items remaining): save immediately
- Each batch save emits `batch_saved` event with chunk IDs

## Component Architecture

### New Files

```
src/app/api/documents/parse/route.ts     <- SSE API Route (core pipeline)
src/hooks/useStreamingParse.ts           <- Client-side SSE consumer hook
src/components/rag/ParsePanel.tsx        <- Parsing panel (streaming card container)
src/components/rag/ParsedItemCard.tsx    <- Single parsed result card (with animation)
```

### Modified Files

```
src/app/(protected)/knowledge/KnowledgeClient.tsx  <- Refactor: Tab switching + upload form + state management
src/components/rag/KnowledgeTable.tsx               <- Adjust: adapt to new list mode
src/app/actions/documents.ts                        <- Simplify: upload logic moves to API Route
```

### Component Responsibilities

**`KnowledgeClient.tsx` (Refactor) - Page Controller**

- Manages page state: `'list' | 'parsing'`
- Tab switching (Lecture/Exam/Assignment) to filter file list
- Upload form (docType + course + school + file dropzone)
- On "Start Parse" click -> switch to parsing state, invoke `useStreamingParse`

**`ParsePanel.tsx` (New) - Parsing Panel**

- Receives state from `useStreamingParse` hook
- Top: filename + progress bar + status text
- Middle: card grid, renders `ParsedItemCard` components
- Bottom: completion summary + "Back to List" button
- "Back to List" is always available during parsing

**`ParsedItemCard.tsx` (New) - Single Card**

- Renders knowledge point or question based on type
- Entry animation (Mantine Transition: fade + slide-up)
- Save status indicator (spinner = pending, checkmark = saved)
- Read-only during parsing, editable after completion

**`useStreamingParse` Hook (New)**

```ts
function useStreamingParse() {
  return {
    startParse: (file: File, metadata: ParseMetadata) => void,
    items: ParsedItem[],
    status: 'idle' | 'parsing_pdf' | 'extracting' | 'embedding' | 'complete' | 'error',
    progress: { current: number, total: number },
    savedBatches: Set<string>,  // chunk IDs that are persisted
    error: string | null,
    documentId: string | null,
  }
}
```

**`POST /api/documents/parse` Route (New)**

- Accepts FormData (file + docType + course + school)
- Returns `text/event-stream` response
- Pipeline: auth check -> quota check -> create doc -> parse PDF -> LLM extract -> stream items + batch save -> update doc status
- Uses existing services: `DocumentService`, `QuotaService`, parsers, embedding

## Edge Cases & Error Handling

### 1. User clicks "Back to List" during parsing

- Backend SSE connection maintained, parsing continues
- Document shows "Processing" status in list (reuses existing realtime status)
- User can re-enter parsing panel by clicking the document to see results + continue receiving new items

### 2. Network disconnect during parsing

- Already-saved batches are safe in DB
- Unsaved items are lost
- Client detects SSE disconnect, shows error prompt + "Retry" button
- On retry: full re-parse (delete existing chunks, start fresh) - simple and reliable

### 3. LLM extraction failure

- SSE pushes `error` event with error message
- Document status set to `error`
- Panel shows already-parsed cards (if any) + error prompt
- "Retry" button available

### 4. Empty or unparseable PDF

- Fast error return, no LLM phase entered
- SSE pushes `error` event
- Document marked as `error`

### 5. Quota insufficient

- Check quota before upload (reuse existing QuotaService)
- Show prompt when insufficient, don't start parsing

## YAGNI - Explicitly Out of Scope

- No resume/checkpoint on retry (full re-parse on retry, simple and reliable)
- No editing during parsing (editable only after completion)
- No multi-file parallel parsing (single file first)
- No preview/confirm step before save (direct save, can edit/delete later)
