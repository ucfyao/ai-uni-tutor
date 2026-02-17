# Chat File Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow students to upload PDF, image, and text files in the chat input, sending them directly to Gemini for native processing alongside their questions.

**Architecture:** Extend the existing ChatInput paperclip button to accept PDF and text files in addition to images. Files are converted to base64 on the frontend, sent via JSON to the existing `/api/chat/stream` endpoint, and passed as `inlineData` parts to the Gemini SDK. No server-side file storage, no embedding, no database persistence. The uploaded document is held in frontend React state for the lifetime of the conversation.

**Tech Stack:** Next.js 16, React 19, Mantine v8, @google/genai SDK, Zod, Vitest

---

### Task 1: Add i18n strings for file upload

**Files:**

- Modify: `src/i18n/translations.ts` (English chat namespace ~line 828, Chinese chat namespace ~line 159)

**Step 1: Add English i18n keys**

In the English `chat` namespace (around line 828), add these keys after `attachImages`:

```typescript
attachFiles: 'Attach files',
dropToAttachFiles: 'Drop to attach files',
documentAttached: 'Document attached',
removeDocument: 'Remove document',
fileTooLarge: 'File too large',
fileTooLargeMessage: 'Maximum file size is 20MB',
unsupportedFileType: 'Unsupported file type',
unsupportedFileTypeMessage: 'Supported formats: PDF, images, and text files',
oneDocumentLimit: 'Document limit',
oneDocumentLimitMessage: 'You can attach one document per conversation. Remove the current one first.',
```

**Step 2: Add Chinese i18n keys**

In the Chinese `chat` namespace (around line 159), add the corresponding keys:

```typescript
attachFiles: '附加文件',
dropToAttachFiles: '拖放以附加文件',
documentAttached: '已附加文档',
removeDocument: '移除文档',
fileTooLarge: '文件太大',
fileTooLargeMessage: '文件大小上限为 20MB',
unsupportedFileType: '不支持的文件类型',
unsupportedFileTypeMessage: '支持格式：PDF、图片和文本文件',
oneDocumentLimit: '文档数量限制',
oneDocumentLimitMessage: '每个对话只能附加一个文档，请先移除当前文档。',
```

**Step 3: Update existing keys**

Change these existing keys in both languages:

- `attachImages` → keep as-is (used elsewhere or as fallback)
- `dropToAttach` → keep as-is (will be replaced in ChatInput usage)

**Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(chat): add i18n strings for file upload"
```

---

### Task 2: Add file type helper constants

**Files:**

- Create: `src/lib/file-utils.ts`
- Create: `src/lib/file-utils.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_FILE_TYPES,
  getFileDisplayName,
  isDocumentFile,
  isImageFile,
  isSupportedFile,
  MAX_FILE_SIZE_BYTES,
} from './file-utils';

describe('file-utils', () => {
  describe('isImageFile', () => {
    it('returns true for image MIME types', () => {
      expect(isImageFile('image/jpeg')).toBe(true);
      expect(isImageFile('image/png')).toBe(true);
      expect(isImageFile('image/webp')).toBe(true);
      expect(isImageFile('image/gif')).toBe(true);
    });

    it('returns false for non-image types', () => {
      expect(isImageFile('application/pdf')).toBe(false);
      expect(isImageFile('text/plain')).toBe(false);
    });
  });

  describe('isDocumentFile', () => {
    it('returns true for PDF', () => {
      expect(isDocumentFile('application/pdf')).toBe(true);
    });

    it('returns true for text files', () => {
      expect(isDocumentFile('text/plain')).toBe(true);
      expect(isDocumentFile('text/markdown')).toBe(true);
      expect(isDocumentFile('text/csv')).toBe(true);
    });

    it('returns false for images', () => {
      expect(isDocumentFile('image/png')).toBe(false);
    });

    it('returns false for unsupported types', () => {
      expect(isDocumentFile('application/msword')).toBe(false);
    });
  });

  describe('isSupportedFile', () => {
    it('returns true for images and documents', () => {
      expect(isSupportedFile('image/png')).toBe(true);
      expect(isSupportedFile('application/pdf')).toBe(true);
      expect(isSupportedFile('text/plain')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isSupportedFile('application/zip')).toBe(false);
      expect(isSupportedFile('video/mp4')).toBe(false);
    });
  });

  describe('getFileDisplayName', () => {
    it('truncates long filenames', () => {
      const longName = 'a'.repeat(50) + '.pdf';
      const result = getFileDisplayName(longName);
      expect(result.length).toBeLessThanOrEqual(35);
      expect(result).toContain('...');
      expect(result).toEndWith('.pdf');
    });

    it('keeps short filenames as-is', () => {
      expect(getFileDisplayName('slides.pdf')).toBe('slides.pdf');
    });
  });

  describe('constants', () => {
    it('MAX_FILE_SIZE_BYTES is 20MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
    });

    it('ACCEPTED_FILE_TYPES includes PDF and images', () => {
      expect(ACCEPTED_FILE_TYPES).toContain('application/pdf');
      expect(ACCEPTED_FILE_TYPES).toContain('image/*');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/file-utils.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
/**
 * File type utilities for chat file upload.
 *
 * Supported formats:
 * - Images: image/* (JPEG, PNG, WebP, GIF)
 * - PDF: application/pdf
 * - Text: text/plain, text/markdown, text/csv
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

const DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown', 'text/csv']);

/** Accept attribute value for the file input element. */
export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,text/plain,text/markdown,text/csv';

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isDocumentFile(mimeType: string): boolean {
  return DOCUMENT_MIME_TYPES.has(mimeType);
}

export function isSupportedFile(mimeType: string): boolean {
  return isImageFile(mimeType) || isDocumentFile(mimeType);
}

/** Truncate long filenames for display, preserving the extension. */
export function getFileDisplayName(filename: string, maxLength = 30): string {
  if (filename.length <= maxLength) return filename;
  const ext = filename.slice(filename.lastIndexOf('.'));
  const nameLimit = maxLength - ext.length - 3; // 3 for "..."
  return filename.slice(0, nameLimit) + '...' + ext;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/file-utils.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/file-utils.ts src/lib/file-utils.test.ts
git commit -m "feat(chat): add file type utility helpers"
```

---

### Task 3: Extend ChatInput UI to accept documents

**Files:**

- Modify: `src/components/chat/ChatInput.tsx`

This task extends the ChatInput component to:

1. Accept PDF and text files via the file picker and drag-and-drop
2. Display document files as filename tags (not image thumbnails)
3. Add a new `attachedDocument` prop for the single-document state

**Step 1: Update ChatInputProps interface**

Add new props for document handling. The component needs to know about both images (multiple, with previews) and a single document file:

```typescript
interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  attachedFiles: File[]; // images (kept for backward compat)
  imagePreviews: string[];
  onRemoveFile: (index: number) => void;
  onFileClick: () => void;
  isKnowledgeMode: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  // New props for document upload
  attachedDocument?: File | null;
  onRemoveDocument?: () => void;
}
```

**Step 2: Update the file input `accept` attribute**

Change line 205 from:

```tsx
accept = 'image/*';
```

to:

```tsx
accept = { ACCEPTED_FILE_TYPES };
```

Import `ACCEPTED_FILE_TYPES` from `@/lib/file-utils` at the top. Also import `FileText` from `lucide-react` for the document icon.

**Step 3: Update drag-and-drop handler**

In `handleDrop` (line 82), change the filter logic from image-only to support all file types. Instead of filtering, delegate to `onFileSelect`:

```typescript
const handleDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const syntheticEvent = {
      target: { files },
    } as React.ChangeEvent<HTMLInputElement>;
    onFileSelect(syntheticEvent);
  },
  [onFileSelect],
);
```

**Step 4: Add document preview section**

Above the image previews section (line 111), add a document preview tag. When `attachedDocument` is set, show a pill with the filename and a close button:

```tsx
{
  /* Document Preview */
}
{
  attachedDocument && (
    <Group gap={8} px={4}>
      <Box
        pos="relative"
        className="group/doc"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 8,
          backgroundColor: 'var(--mantine-color-indigo-0)',
          border: '1px solid var(--mantine-color-indigo-2)',
        }}
      >
        <FileText size={14} color="var(--mantine-color-indigo-6)" />
        <Text size="xs" fw={500} c="indigo.7" style={{ maxWidth: 200 }} truncate="end">
          {getFileDisplayName(attachedDocument.name)}
        </Text>
        <CloseButton
          size="xs"
          radius="xl"
          variant="subtle"
          color="indigo"
          onClick={onRemoveDocument}
        />
      </Box>
    </Group>
  );
}
```

Import `getFileDisplayName` from `@/lib/file-utils`.

**Step 5: Update tooltip text**

Change line 211 from `t.chat.attachImages` to `t.chat.attachFiles`.

**Step 6: Update drag overlay text**

Change line 196 from `t.chat.dropToAttach` to `t.chat.dropToAttachFiles`.

**Step 7: Update send button enable logic**

Update the send button's disabled/color logic (lines 279-286) to also consider the attached document:

```tsx
color={input.trim() || attachedFiles.length > 0 || attachedDocument ? 'indigo' : 'gray.4'}
disabled={(!input.trim() && attachedFiles.length === 0 && !attachedDocument) || isTyping}
```

And the opacity:

```tsx
opacity: !input.trim() && attachedFiles.length === 0 && !attachedDocument ? 0.4 : 1,
```

**Step 8: Commit**

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "feat(chat): extend ChatInput to accept PDF and text files"
```

---

### Task 4: Update LectureHelper to handle document files

**Files:**

- Modify: `src/components/modes/LectureHelper.tsx`

This task updates the parent component to:

1. Manage `attachedDocument` state (single document, conversation-level)
2. Split file selection into images vs documents in `handleFileSelect`
3. Include document data in the streaming payload
4. Validate file size and type with i18n-aware notifications

**Step 1: Add document state**

After the existing file state declarations (line ~80), add:

```typescript
const [attachedDocument, setAttachedDocument] = useState<File | null>(null);
```

**Step 2: Rewrite `handleFileSelect` to handle both images and documents**

Replace the current `handleFileSelect` (lines 308-339) with logic that routes files to the correct handler based on type:

```typescript
const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  for (const file of files) {
    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showNotification({
        title: t.chat.fileTooLarge,
        message: t.chat.fileTooLargeMessage,
        color: 'red',
      });
      continue;
    }

    if (isImageFile(file.type)) {
      // Image handling (same as before)
      if (attachedFiles.length >= 4) {
        showNotification({
          title: 'Too many files',
          message: 'You can attach up to 4 images',
          color: 'orange',
        });
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
      setAttachedFiles((prev) => [...prev, file]);
    } else if (isDocumentFile(file.type)) {
      // Document handling — one document per conversation
      if (attachedDocument) {
        showNotification({
          title: t.chat.oneDocumentLimit,
          message: t.chat.oneDocumentLimitMessage,
          color: 'orange',
        });
        continue;
      }
      setAttachedDocument(file);
    } else {
      showNotification({
        title: t.chat.unsupportedFileType,
        message: t.chat.unsupportedFileTypeMessage,
        color: 'red',
      });
    }
  }

  // Reset input so the same file can be re-selected
  if (e.target) e.target.value = '';
};
```

Import `isImageFile`, `isDocumentFile`, `MAX_FILE_SIZE_BYTES` from `@/lib/file-utils`.

**Step 3: Update `handleSend` to include document data**

In `handleSend` (line ~117), after the existing image conversion loop, add document conversion:

```typescript
// Convert attached document to base64 (after the imageData loop)
let documentData: { data: string; mimeType: string } | undefined;
if (attachedDocument) {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(attachedDocument);
    });
    documentData = { data: base64, mimeType: attachedDocument.type };
  } catch (error) {
    console.error('Failed to process document:', error);
    showNotification({
      title: t.chat.error,
      message: 'Failed to process document attachment',
      color: 'red',
    });
    isSendingRef.current = false;
    return;
  }
}
```

Then, in the `streamChatResponse` call, add the `document` field:

```typescript
await streamChatResponse(
  {
    course: session.course ?? { code: '', name: '' },
    mode: session.mode,
    history: session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images,
    })),
    userInput: messageToSend,
    images: imageData,
    document: documentData, // <-- NEW
  },
  {
    /* callbacks unchanged */
  },
);
```

**Step 4: Clear image state on send but keep document**

In the "clear input" block (after creating userMsg), keep the document attached since it persists for the whole conversation:

```typescript
if (!retryInput) {
  setInput('');
  setAttachedFiles([]);
  setImagePreviews([]);
  // Note: do NOT clear attachedDocument — it persists for the conversation
}
```

**Step 5: Add handleRemoveDocument**

```typescript
const handleRemoveDocument = () => {
  setAttachedDocument(null);
};
```

**Step 6: Update handlePaste — keep image-only behavior**

The paste handler (lines 346-365) should remain image-only. No change needed.

**Step 7: Pass new props to ChatInput**

Add the new props to the `<ChatInput>` component usage (line ~412):

```tsx
<ChatInput
  // ... existing props
  attachedDocument={attachedDocument}
  onRemoveDocument={handleRemoveDocument}
/>
```

**Step 8: Commit**

```bash
git add src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): handle document file selection and send in LectureHelper"
```

---

### Task 5: Update useChatStream hook to pass document data

**Files:**

- Modify: `src/hooks/useChatStream.ts`

**Step 1: Add `document` field to StreamChatOptions**

Find the `StreamChatOptions` interface and add:

```typescript
document?: { data: string; mimeType: string };
```

**Step 2: Include document in the fetch body**

In the `streamChatResponse` function, find where it builds the request body (the `JSON.stringify` call to `/api/chat/stream`) and add `document`:

```typescript
body: JSON.stringify({
  course: options.course,
  mode: options.mode,
  history: options.history,
  userInput: options.userInput,
  images: options.images,
  document: options.document,  // <-- NEW
}),
```

**Step 3: Commit**

```bash
git add src/hooks/useChatStream.ts
git commit -m "feat(chat): pass document field in chat stream request"
```

---

### Task 6: Update API route to accept and forward document data

**Files:**

- Modify: `src/app/api/chat/stream/route.ts`

**Step 1: Extend Zod validation schema**

After the `images` field in `chatStreamSchema` (line ~56), add:

```typescript
document: z
  .object({
    data: z.string(),
    mimeType: z.string(),
  })
  .optional(),
```

**Step 2: Extract document from parsed data**

Update the destructuring (line 84):

```typescript
const { course, mode, history, userInput, images, document } = parsed.data;
```

**Step 3: Pass document to ChatService**

In the `chatService.generateStream()` call (line ~123), add `document`:

```typescript
const streamGenerator = chatService.generateStream({
  course: course as Course,
  mode: mode as TutoringMode,
  history: chatHistory,
  userInput,
  images,
  document, // <-- NEW
});
```

**Step 4: Commit**

```bash
git add src/app/api/chat/stream/route.ts
git commit -m "feat(api): accept document field in chat stream endpoint"
```

---

### Task 7: Update ChatService to send document to Gemini

**Files:**

- Modify: `src/lib/services/ChatService.ts`
- Modify: `src/lib/services/ChatService.test.ts`

**Step 1: Write the failing test**

Add a new test in `ChatService.test.ts` in the existing describe block:

```typescript
it('should include document as inlineData in the user message', async () => {
  mockGenerateContent.mockResolvedValue({ text: 'I see a PDF' });

  await service.generateResponse(
    baseOptions({
      document: { data: 'pdf-base64-data', mimeType: 'application/pdf' },
    }),
  );

  const callArgs = mockGenerateContent.mock.calls[0][0];
  const lastContent = callArgs.contents[callArgs.contents.length - 1];
  // text part + document part
  expect(lastContent.parts).toHaveLength(2);
  expect(lastContent.parts[1].inlineData).toEqual({
    data: 'pdf-base64-data',
    mimeType: 'application/pdf',
  });
});

it('should include both images and document in the user message', async () => {
  mockGenerateContent.mockResolvedValue({ text: 'I see both' });

  await service.generateResponse(
    baseOptions({
      images: [{ data: 'img-data', mimeType: 'image/png' }],
      document: { data: 'pdf-data', mimeType: 'application/pdf' },
    }),
  );

  const callArgs = mockGenerateContent.mock.calls[0][0];
  const lastContent = callArgs.contents[callArgs.contents.length - 1];
  // text part + image part + document part
  expect(lastContent.parts).toHaveLength(3);
  expect(lastContent.parts[1].inlineData.mimeType).toBe('image/png');
  expect(lastContent.parts[2].inlineData.mimeType).toBe('application/pdf');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/ChatService.test.ts`
Expected: FAIL — `document` is not a valid property

**Step 3: Add `document` to ChatGenerationOptions**

In `ChatService.ts`, update the interface (line ~15):

```typescript
export interface ChatGenerationOptions {
  course: Course;
  mode: TutoringMode;
  history: ChatMessage[];
  userInput: string;
  images?: { data: string; mimeType: string }[];
  document?: { data: string; mimeType: string }; // <-- NEW
}
```

**Step 4: Update `prepareContents` to accept document**

Change the signature (line ~187):

```typescript
private prepareContents(
  history: ChatMessage[],
  userInput: string,
  images?: { data: string; mimeType: string }[],
  document?: { data: string; mimeType: string },
): Content[] {
```

After the images loop (line ~225), add document handling:

```typescript
// Add document if present
if (document) {
  userParts.push({
    inlineData: {
      data: document.data,
      mimeType: document.mimeType,
    },
  });
}
```

**Step 5: Pass `document` through generateResponse and generateStream**

In `generateResponse` (line ~42), update the destructuring and the `prepareContents` call:

```typescript
const { course, mode, history, userInput, images, document } = options;
// ...
const contents = this.prepareContents(history, processedInput, images, document);
```

In `generateStream` (line ~85), same update:

```typescript
const { course, mode, history, userInput, images, document } = options;
// ...
const contents = this.prepareContents(history, processedInput, images, document);
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/services/ChatService.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/services/ChatService.ts src/lib/services/ChatService.test.ts
git commit -m "feat(chat): send document as inlineData to Gemini"
```

---

### Task 8: Run full test suite and lint

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Fix any issues found**

If any step fails, fix the issue and re-run.

**Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix(chat): resolve lint and type errors"
```

---

### Task 9: Manual smoke test and PR

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Verify in browser**

- [ ] Click the paperclip button — file picker shows PDF and text options alongside images
- [ ] Select a PDF — filename tag appears above the input box
- [ ] Type a question and send — AI responds referencing the PDF content
- [ ] Send another message without re-uploading — AI still has document context
- [ ] Click X on the document tag — document is removed
- [ ] Drag-and-drop a PDF — it attaches as document
- [ ] Try uploading a second document while one is attached — warning notification appears
- [ ] Try uploading a 25MB file — "too large" notification appears
- [ ] Try uploading a .zip file — "unsupported" notification appears
- [ ] Image upload still works as before (multiple images, thumbnails)

**Step 3: Merge into main and push**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin docs/chat-file-upload
gh pr create --title "feat(chat): add file upload support in chat" --body "$(cat <<'EOF'
## Summary
- Students can upload PDF, images, and text files directly in the chat input
- Files are sent to Gemini as native inline data — no server-side parsing or storage
- One document per conversation, 20MB limit, persists for conversation lifetime
- Extends existing paperclip button — unified upload experience

## Design doc
`docs/plans/2026-02-17-chat-file-upload-design.md`

## Test plan
- [ ] Unit tests for file-utils helpers
- [ ] Unit tests for ChatService document inlineData
- [ ] Manual: upload PDF → ask question → verify AI references content
- [ ] Manual: drag-and-drop PDF works
- [ ] Manual: file size and type validation notifications
- [ ] Manual: one-document limit enforced
- [ ] Manual: existing image upload unchanged

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
