# Chat File Upload — Design Document

**Date:** 2026-02-17
**Status:** Approved

## Problem

Students cannot upload documents during chat. When a course's lecture slides haven't been uploaded by an admin, or when students have unique supplementary materials, they lack an efficient way to ask questions about those documents. Uploading images one page at a time is tedious for multi-page PDFs.

## Decision

Add file upload support to the chat input, allowing students to attach documents that Gemini processes natively alongside their questions. Files are temporary — they exist only for the current conversation and are discarded afterward.

## Design Principles

- **Core value preserved:** Admin-curated structured knowledge base remains the primary RAG source. Student uploads are a complementary, ad-hoc mechanism.
- **Simple over complex:** No LLM parsing, no embeddings, no database storage. Just send the file to Gemini.
- **Reuse existing UI:** Extend the existing paperclip button, don't add new upload entry points.
- **Temporary by design:** Files live only for the current conversation session.

## Architecture

### User Flow

1. Student clicks the paperclip button in ChatInput (same button used for images).
2. File picker opens, accepting PDF, images, and plain text files.
3. Selected file appears as a preview tag (filename + icon for documents, thumbnail for images).
4. Student types a question and sends.
5. Backend receives the file + message, sends both to Gemini API as inline data.
6. Gemini natively processes the file content and responds.
7. The file context persists for all subsequent messages in the conversation.
8. On conversation close or timeout (2 hours), the file is discarded.

### Supported Formats

| Format     | MIME Types                                           | Gemini Support                        |
| ---------- | ---------------------------------------------------- | ------------------------------------- |
| PDF        | `application/pdf`                                    | Native (including scanned/image PDFs) |
| Images     | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | Native (existing)                     |
| Plain text | `text/plain`, `text/markdown`, `text/csv`            | Native                                |

Word (.docx), PowerPoint (.pptx), and Excel (.xlsx) are out of scope for v1.

### Data Flow

```
ChatInput (frontend)
  ├─ User selects file via paperclip button
  ├─ File stored in frontend state (conversation-level)
  └─ On send: file + message → POST /api/chat/stream

Backend (API route)
  ├─ Receive file + message
  ├─ Temporarily store file (memory/temp file)
  └─ Pass to ChatService

ChatService
  ├─ Build system instruction (with Admin RAG context as usual)
  ├─ Attach file as Gemini inline data (Part[])
  ├─ Send to Gemini: system instruction + history + file + user message
  └─ Stream response back

Cleanup
  └─ File removed on conversation end or 2-hour TTL
```

### Coexistence with Admin RAG

- Admin RAG context: injected into system prompt via `addRAGContext()` (text-based, from pgvector search).
- Student uploaded file: sent as Gemini inline data (binary, native processing).
- Both work simultaneously — Gemini sees the RAG context in its instructions AND the uploaded file as visual/text content.

## Constraints

- **1 document per conversation** (images can still be multiple, as before).
- **File size limit:** 20MB.
- **No page count limit** for PDFs — Gemini handles this natively.
- **No payment gating in v1** — available to all users; monetization decided later.

## What We Don't Do

- No LLM-powered structured extraction (knowledge points, questions).
- No embedding generation or vector storage.
- No database persistence — files are ephemeral.
- No Word/PPT/Excel support (v1).
- No file sharing between users.

## Changes Required

| Area             | File(s)                             | Change                                                                                                                    |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Chat input UI    | `src/components/chat/ChatInput.tsx` | Extend `accept` to include PDF and text; add document preview (filename + icon); update drag-and-drop to accept new types |
| Chat stream hook | `src/hooks/useChatStream.ts`        | Pass file data with messages                                                                                              |
| Chat API route   | `src/app/api/chat/stream/route.ts`  | Accept file upload (multipart form data); temp-store file; pass to ChatService                                            |
| Chat service     | `src/lib/services/ChatService.ts`   | Attach file as Gemini inline content part when generating stream                                                          |
| File cleanup     | New utility or middleware           | TTL-based cleanup of temp files                                                                                           |
| i18n             | `src/i18n/en.ts`, `src/i18n/zh.ts`  | New strings for file upload UI (tooltip, labels, errors)                                                                  |

## Future Considerations

- Word/PPT/Excel support via server-side text extraction.
- Per-user upload quota as part of Pro subscription.
- Persistent document storage for repeat access across conversations.
- Multiple document support per conversation.
