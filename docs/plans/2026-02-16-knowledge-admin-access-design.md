# Knowledge Base Admin-Only Access

**Date:** 2026-02-16
**Status:** Approved

## Goal

Restrict the Knowledge Base (document upload, management, chunk editing) to admin-only access. Merge the existing `/knowledge` and `/admin/content` pages into a single `/admin/knowledge` route.

## Current State

- `/knowledge` — accessible to all authenticated users; polished UI with segmented tabs, animated search, dropzone upload, LLM-powered extraction
- `/admin/content` — admin-only; simple table UI with mechanical chunking upload
- Admin visiting `/knowledge` gets redirected to `/admin/content`
- Server actions in `documents.ts` use `getCurrentUser()` (any authenticated user)
- Server actions in `admin-content.ts` use `requireAdmin()`
- Knowledge Cards (chat-time embedding similarity) are separate from document management

## Design

### 1. Route Changes

**Move `/knowledge` → `/admin/knowledge`:**

- Move `src/app/(protected)/knowledge/` → `src/app/(protected)/admin/knowledge/`
- Includes: `page.tsx`, `KnowledgeClient.tsx`, `loading.tsx`, `error.tsx`, `[id]/` subdirectory
- The existing `AdminLayout` (`src/app/(protected)/admin/layout.tsx`) enforces `role === 'admin'` — all pages under `/admin/` are automatically protected at the layout level
- Remove the admin-redirect logic from `knowledge/page.tsx` (no longer needed)

**Delete `/admin/content`:**

- Remove `src/app/(protected)/admin/content/` entirely
- Delete `src/app/actions/admin-content.ts` and `admin-content.test.ts`
- The mechanical chunking upload is superseded by the LLM upload in the knowledge page

**Update internal links:**

- `KnowledgeClient.tsx`: `/knowledge/${docId}` → `/admin/knowledge/${docId}`
- `DocumentDetailHeader.tsx`: back link `/knowledge` → `/admin/knowledge`
- Any other files referencing `/knowledge` or `/admin/content` paths

### 2. Server Action Security

**`documents.ts` — all actions switch to `requireAdmin()`:**

- `fetchDocuments(docType)`
- `uploadDocument(prevState, formData)`
- `deleteDocument(documentId)`
- `updateDocumentChunks(...)`
- `regenerateEmbeddings(documentId)`
- `retryDocument(documentId)`
- `updateDocumentMeta(documentId, updates)`

**`api/documents/parse/route.ts` — switch to `requireAdmin()`**

**`knowledge-cards.ts` — NO change** (stays `getCurrentUser()`, used by regular users in chat)

### 3. Sidebar Navigation (Server-Side Admin Check)

Pass `isAdmin` boolean as a prop through the server component chain — no role exposed in `ProfileContext`.

1. `getProfile()` in `user.ts` — add `role` to `ProfileData` return type
2. `ProtectedLayout` — compute `isAdmin = initialProfile?.role === 'admin'`, pass to `ShellServer`
3. `ShellServer` → `ShellClient` → `Sidebar` — pass `isAdmin` prop down
4. `Sidebar` — conditionally render Knowledge Base link only when `isAdmin === true`, with `href: '/admin/knowledge'`

The `ProfileContext` stays unchanged — `role` is only used server-side in the layout to derive a boolean.

### 4. File Changes Summary

**Delete:**

- `src/app/(protected)/admin/content/` (entire directory)
- `src/app/actions/admin-content.ts`
- `src/app/actions/admin-content.test.ts`

**Move (rename):**

- `src/app/(protected)/knowledge/` → `src/app/(protected)/admin/knowledge/`

**Modify:**

- `src/app/(protected)/admin/knowledge/page.tsx` — remove admin-redirect, simplify auth (AdminLayout handles it)
- `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx` — update `/knowledge/` links → `/admin/knowledge/`
- `src/app/(protected)/admin/knowledge/[id]/DocumentDetailHeader.tsx` — update back link
- `src/app/actions/documents.ts` — `getCurrentUser()` → `requireAdmin()` in all actions
- `src/app/api/documents/parse/route.ts` — `getCurrentUser()` → `requireAdmin()`
- `src/app/actions/user.ts` — add `role` to `ProfileData`
- `src/app/(protected)/layout.tsx` — compute `isAdmin`, pass to ShellServer
- `src/app/ShellServer.tsx` — accept & forward `isAdmin` prop
- `src/app/ShellClient.tsx` — accept & forward `isAdmin` prop
- `src/components/Sidebar.tsx` — accept `isAdmin`, conditionally render Knowledge Base link

**No changes:**

- `src/app/actions/knowledge-cards.ts`
- `src/hooks/useKnowledgeCards.ts`
- `src/components/chat/KnowledgePanel.tsx`
- `src/components/rag/` (shared components used by the moved knowledge pages)
