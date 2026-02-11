# Knowledge Upload Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the knowledge upload pipeline with doc-type-specific parsing (Lecture→knowledge points, Assignment/Exam→questions), add document detail page with view/edit, and fix existing upload issues.

**Architecture:** Three Gemini LLM parsing pipelines dispatch based on `doc_type`. Parsed structured data stored in `document_chunks.metadata` JSON. New `/knowledge/[id]` detail page renders different UI per doc_type. Existing layered architecture (Actions→Services→Repositories) extended with new methods.

**Tech Stack:** Next.js 15, Mantine UI, Supabase, Google Gemini API (`@google/genai`), Zod, TypeScript

---

### Task 1: Add Gemini LLM Parsing Functions

**Files:**

- Create: `src/lib/rag/parsers/lecture-parser.ts`
- Create: `src/lib/rag/parsers/question-parser.ts`
- Create: `src/lib/rag/parsers/types.ts`

**Step 1: Create shared types**

Create `src/lib/rag/parsers/types.ts`:

```ts
export interface KnowledgePoint {
  title: string;
  definition: string;
  keyFormulas?: string[];
  keyConcepts?: string[];
  examples?: string[];
  sourcePages: number[];
}

export interface ParsedQuestion {
  questionNumber: string;
  content: string;
  options?: string[];
  referenceAnswer?: string;
  score?: number;
  sourcePage: number;
}

export interface LectureParseResult {
  type: 'lecture';
  knowledgePoints: KnowledgePoint[];
}

export interface QuestionParseResult {
  type: 'question';
  questions: ParsedQuestion[];
}

export type ParseResult = LectureParseResult | QuestionParseResult;
```

**Step 2: Create lecture parser**

Create `src/lib/rag/parsers/lecture-parser.ts`. This function:

- Takes the full PDF text + pages array
- Sends to Gemini with a structured prompt asking to extract knowledge points
- Uses `getGenAI()` from `src/lib/gemini.ts` to call `gemini-2.0-flash` (fast, cheap)
- Parses the JSON response into `KnowledgePoint[]`
- Prompt should instruct Gemini to return valid JSON array of knowledge points with fields: title, definition, keyFormulas, keyConcepts, examples, sourcePages

```ts
import 'server-only';
import { getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { KnowledgePoint } from './types';

export async function parseLecture(pages: PDFPage[]): Promise<KnowledgePoint[]> {
  const genAI = getGenAI();
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  const prompt = `You are an expert academic content analyzer. Analyze the following lecture content and extract structured knowledge points.

For each knowledge point, extract:
- title: A clear, concise title for the concept
- definition: A comprehensive explanation/definition
- keyFormulas: Any relevant mathematical formulas (optional, omit if none)
- keyConcepts: Related key terms and concepts (optional, omit if none)
- examples: Concrete examples mentioned (optional, omit if none)
- sourcePages: Array of page numbers where this concept appears

Return ONLY a valid JSON array of knowledge points. No markdown, no explanation.

Lecture content:
${pagesText}`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '';
  const parsed = JSON.parse(text) as KnowledgePoint[];
  return parsed;
}
```

**Step 3: Create question parser**

Create `src/lib/rag/parsers/question-parser.ts`. This function:

- Takes PDF pages + `hasAnswers` boolean flag
- Sends to Gemini requesting question extraction
- If `hasAnswers` is true, also extract referenceAnswer
- Returns `ParsedQuestion[]`

```ts
import 'server-only';
import { getGenAI } from '@/lib/gemini';
import type { PDFPage } from '@/lib/pdf';
import type { ParsedQuestion } from './types';

export async function parseQuestions(
  pages: PDFPage[],
  hasAnswers: boolean,
): Promise<ParsedQuestion[]> {
  const genAI = getGenAI();
  const pagesText = pages.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');

  const answerInstruction = hasAnswers
    ? '- referenceAnswer: The reference answer or solution provided (extract from the document)'
    : '- referenceAnswer: Omit this field (no answers provided in document)';

  const prompt = `You are an expert academic content analyzer. Analyze the following exam/assignment document and extract each individual question.

For each question, extract:
- questionNumber: The question number/label as shown (e.g. "1", "1a", "Q1")
- content: The full question text including any sub-parts
- options: Array of answer options if it's a multiple choice question (omit if not MC)
${answerInstruction}
- score: Points/marks allocated if shown (omit if not shown)
- sourcePage: The page number where the question appears

Return ONLY a valid JSON array of questions. No markdown, no explanation.

Document content:
${pagesText}`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '';
  const parsed = JSON.parse(text) as ParsedQuestion[];
  return parsed;
}
```

**Step 4: Commit**

```bash
git add src/lib/rag/parsers/
git commit -m "feat(rag): add Gemini LLM parsers for lectures and questions"
```

---

### Task 2: Update Upload Form with "Contains Answers" Toggle

**Files:**

- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`
- Modify: `src/app/actions/documents.ts` (schema only, add `has_answers` field)

**Step 1: Add `has_answers` to upload schema in `src/app/actions/documents.ts`**

In the `uploadSchema`, add:

```ts
has_answers: z.preprocess(
  (value) => value === 'true' || value === true,
  z.boolean().optional().default(false),
),
```

And in `uploadDocument()`, extract `has_answers` from `parsed.data` and pass via `formData.get('has_answers')`.

**Step 2: Add toggle to KnowledgeClient.tsx**

In `src/app/(protected)/knowledge/KnowledgeClient.tsx`:

- Import `Switch` from `@mantine/core`
- Add state: `const [hasAnswers, setHasAnswers] = useState(false);`
- Conditionally render the Switch only when `docType` is `'exam'` or `'assignment'`:

```tsx
{
  (docType === 'exam' || docType === 'assignment') && (
    <Switch
      label="Document contains answers"
      checked={hasAnswers}
      onChange={(event) => setHasAnswers(event.currentTarget.checked)}
    />
  );
}
```

- In `handleUpload`, append to formData: `formData.append('has_answers', String(hasAnswers));`
- In `resetForm`, add `setHasAnswers(false);`

**Step 3: Commit**

```bash
git add src/app/actions/documents.ts src/app/(protected)/knowledge/KnowledgeClient.tsx
git commit -m "feat(upload): add has_answers toggle for exam/assignment uploads"
```

---

### Task 3: Refactor uploadDocument() to Dispatch by doc_type

**Files:**

- Modify: `src/app/actions/documents.ts`

This is the core change. Replace the generic chunk+embed pipeline with doc-type-specific parsing.

**Step 1: Rewrite the processing section of `uploadDocument()`**

After PDF parsing succeeds (after line 88), replace the chunking/embedding section with:

```ts
// 3. Parse content based on doc_type
const { has_answers } = parsed.data;
let chunksData: CreateDocumentChunkDTO[] = [];

try {
  if (doc_type === 'lecture') {
    // Lecture: Extract structured knowledge points via LLM
    const { parseLecture } = await import('@/lib/rag/parsers/lecture-parser');
    const knowledgePoints = await parseLecture(pdfData.pages);

    // Each knowledge point becomes a chunk
    for (const kp of knowledgePoints) {
      const content = `${kp.title}\n${kp.definition}${kp.keyFormulas?.length ? '\nFormulas: ' + kp.keyFormulas.join('; ') : ''}${kp.keyConcepts?.length ? '\nConcepts: ' + kp.keyConcepts.join(', ') : ''}${kp.examples?.length ? '\nExamples: ' + kp.examples.join('; ') : ''}`;
      const embedding = await generateEmbedding(content);
      chunksData.push({
        documentId: doc.id,
        content,
        embedding,
        metadata: { type: 'knowledge_point', ...kp },
      });
    }
  } else {
    // Exam / Assignment: Extract structured questions via LLM
    const { parseQuestions } = await import('@/lib/rag/parsers/question-parser');
    const questions = await parseQuestions(pdfData.pages, has_answers);

    for (const q of questions) {
      const content = `Q${q.questionNumber}: ${q.content}${q.options?.length ? '\nOptions: ' + q.options.join(' | ') : ''}${q.referenceAnswer ? '\nAnswer: ' + q.referenceAnswer : ''}`;
      const embedding = await generateEmbedding(content);
      chunksData.push({
        documentId: doc.id,
        content,
        embedding,
        metadata: { type: 'question', ...q },
      });
    }
  }
} catch (e) {
  console.error('Error during content extraction:', e);
  // Clean up any partially created chunks
  try {
    await documentService.deleteChunksByDocumentId(doc.id);
  } catch {
    /* ignore cleanup errors */
  }
  await documentService.updateStatus(doc.id, 'error', 'Failed to extract content from PDF');
  revalidatePath('/knowledge');
  return { status: 'error', message: 'Failed to extract content from PDF' };
}
```

Keep the existing chunk save and status update logic after this block.

**Step 2: Commit**

```bash
git add src/app/actions/documents.ts
git commit -m "feat(upload): dispatch to LLM parsers by doc_type"
```

---

### Task 4: Add Missing Service/Repository Methods

**Files:**

- Modify: `src/lib/services/DocumentService.ts`
- Modify: `src/lib/repositories/DocumentRepository.ts`
- Modify: `src/lib/repositories/DocumentChunkRepository.ts`
- Modify: `src/lib/domain/interfaces/IDocumentRepository.ts`
- Modify: `src/lib/domain/interfaces/IDocumentChunkRepository.ts`

**Step 1: Add `findById` and `updateMetadata` to DocumentRepository**

In `src/lib/domain/interfaces/IDocumentRepository.ts`, add:

```ts
findById(id: string): Promise<DocumentEntity | null>;
updateMetadata(id: string, updates: { name?: string; metadata?: Json; docType?: string }): Promise<void>;
```

In `src/lib/repositories/DocumentRepository.ts`, implement:

```ts
async findById(id: string): Promise<DocumentEntity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return this.mapToEntity(data);
}

async updateMetadata(id: string, updates: { name?: string; metadata?: Json; docType?: string }): Promise<void> {
  const supabase = await createClient();
  const updateData: Database['public']['Tables']['documents']['Update'] = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.metadata) updateData.metadata = updates.metadata;
  if (updates.docType) updateData.doc_type = updates.docType as 'lecture' | 'exam' | 'assignment';
  const { error } = await supabase.from('documents').update(updateData).eq('id', id);
  if (error) throw new Error(`Failed to update document: ${error.message}`);
}
```

**Step 2: Add `findByDocumentId` and `updateChunk` to DocumentChunkRepository**

In `src/lib/domain/interfaces/IDocumentChunkRepository.ts`, add:

```ts
findByDocumentId(documentId: string): Promise<{ id: string; content: string; metadata: Json; embedding: number[] | null }[]>;
updateChunk(id: string, content: string, metadata?: Json): Promise<void>;
deleteChunk(id: string): Promise<void>;
```

In `src/lib/repositories/DocumentChunkRepository.ts`, implement:

```ts
async findByDocumentId(documentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, content, metadata, embedding')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to fetch chunks: ${error.message}`);
  return data ?? [];
}

async updateChunk(id: string, content: string, metadata?: Json): Promise<void> {
  const supabase = await createClient();
  const updates: Record<string, unknown> = { content };
  if (metadata !== undefined) updates.metadata = metadata;
  const { error } = await supabase.from('document_chunks').update(updates).eq('id', id);
  if (error) throw new Error(`Failed to update chunk: ${error.message}`);
}

async deleteChunk(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('document_chunks').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete chunk: ${error.message}`);
}
```

**Step 3: Add corresponding methods to DocumentService**

In `src/lib/services/DocumentService.ts`, add:

```ts
async findById(docId: string): Promise<DocumentEntity | null> {
  return this.docRepo.findById(docId);
}

async getChunks(docId: string) {
  return this.chunkRepo.findByDocumentId(docId);
}

async updateChunk(chunkId: string, content: string, metadata?: Json): Promise<void> {
  await this.chunkRepo.updateChunk(chunkId, content, metadata);
}

async deleteChunk(chunkId: string): Promise<void> {
  await this.chunkRepo.deleteChunk(chunkId);
}

async deleteChunksByDocumentId(docId: string): Promise<void> {
  await this.chunkRepo.deleteByDocumentId(docId);
}

async updateDocumentMetadata(docId: string, updates: { name?: string; metadata?: Json; docType?: string }): Promise<void> {
  await this.docRepo.updateMetadata(docId, updates);
}
```

**Step 4: Commit**

```bash
git add src/lib/domain/interfaces/ src/lib/repositories/ src/lib/services/DocumentService.ts
git commit -m "feat(data): add findById, updateChunk, deleteChunk to service/repo layers"
```

---

### Task 5: Create Document Detail Page - Server Component

**Files:**

- Create: `src/app/(protected)/knowledge/[id]/page.tsx`
- Create: `src/app/(protected)/knowledge/[id]/DocumentDetailClient.tsx`

**Step 1: Create server page `src/app/(protected)/knowledge/[id]/page.tsx`**

This server component:

- Gets the document by ID from DocumentService
- Verifies ownership (document.userId === current user)
- Fetches all chunks for this document
- Passes data to the client component

```tsx
import { AlertCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Alert, Container } from '@mantine/core';
import { getDocumentService } from '@/lib/services/DocumentService';
import { getCurrentUser } from '@/lib/supabase/server';
import { DocumentDetailClient } from './DocumentDetailClient';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Container size="md" py={48}>
        <Alert variant="light" color="blue" icon={<AlertCircle size={16} />}>
          Please sign in to view this document.
        </Alert>
      </Container>
    );
  }

  const documentService = getDocumentService();
  const doc = await documentService.findById(id);

  if (!doc || doc.userId !== user.id) {
    notFound();
  }

  const chunks = await documentService.getChunks(id);

  return <DocumentDetailClient document={doc} chunks={chunks} />;
}
```

**Step 2: Create client component `src/app/(protected)/knowledge/[id]/DocumentDetailClient.tsx`**

This is the main detail/edit UI. It renders:

- Metadata section (name, type badge, course, status, date) with inline edit for name/course
- Content section that switches based on `doc_type`:
  - `lecture` → Knowledge point cards
  - `exam` / `assignment` → Question list
- Action bar: Save, Regenerate Embedding, Back to list

Key states:

- `editingChunkId` — which chunk is being edited
- `editedChunks` — map of chunkId to edited content/metadata
- `deletedChunkIds` — set of chunks marked for deletion
- `saving` / `regenerating` — loading states

Use Mantine components: `Container`, `Card`, `Group`, `Stack`, `Title`, `Text`, `Badge`, `Button`, `TextInput`, `Textarea`, `ActionIcon`, `Collapse`.

For each knowledge point card (lecture):

```tsx
<Card withBorder radius="md" p="md">
  <Group justify="space-between" mb="xs">
    <Text fw={600}>{kp.title}</Text>
    <Group gap="xs">
      <ActionIcon variant="subtle" onClick={() => startEdit(chunk.id)}>
        <Pencil size={16} />
      </ActionIcon>
      <ActionIcon variant="subtle" color="red" onClick={() => markDelete(chunk.id)}>
        <Trash2 size={16} />
      </ActionIcon>
    </Group>
  </Group>
  <Text size="sm">{kp.definition}</Text>
  {kp.keyFormulas && <Text size="xs" c="dimmed">Formulas: {kp.keyFormulas.join(', ')}</Text>}
  {kp.keyConcepts && <Badge.Group><badges...></Badge.Group>}
  <Text size="xs" c="dimmed">Pages: {kp.sourcePages.join(', ')}</Text>
</Card>
```

For each question (exam/assignment):

```tsx
<Card withBorder radius="md" p="md">
  <Group justify="space-between" mb="xs">
    <Badge>Q{q.questionNumber}</Badge>
    <Group gap="xs">
      {q.score && <Badge variant="light">Score: {q.score}</Badge>}
      <ActionIcon variant="subtle" onClick={() => startEdit(chunk.id)}>
        <Pencil size={16} />
      </ActionIcon>
      <ActionIcon variant="subtle" color="red" onClick={() => markDelete(chunk.id)}>
        <Trash2 size={16} />
      </ActionIcon>
    </Group>
  </Group>
  <Text size="sm">{q.content}</Text>
  {q.options && <List>{q.options.map(...)}</List>}
  {q.referenceAnswer && (
    <Collapse in={showAnswer}><Text>Answer: {q.referenceAnswer}</Text></Collapse>
  )}
</Card>
```

When in edit mode for a chunk, replace the card content with form fields (TextInput for title, Textarea for content, etc.).

**Step 3: Commit**

```bash
git add src/app/(protected)/knowledge/[id]/
git commit -m "feat(knowledge): add document detail page with view/edit UI"
```

---

### Task 6: Add Server Actions for Document Detail Operations

**Files:**

- Modify: `src/app/actions/documents.ts`

**Step 1: Add `updateDocumentChunks` action**

This action handles saving edits from the detail page:

- Receives: documentId, array of chunk updates `{ id, content, metadata }`, array of deleted chunk IDs
- Verifies ownership
- Applies updates and deletes
- Revalidates `/knowledge` and `/knowledge/[id]`

```ts
export async function updateDocumentChunks(
  documentId: string,
  updates: { id: string; content: string; metadata: Json }[],
  deletedIds: string[],
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  for (const id of deletedIds) {
    await documentService.deleteChunk(id);
  }
  for (const update of updates) {
    await documentService.updateChunk(update.id, update.content, update.metadata);
  }

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Changes saved' };
}
```

**Step 2: Add `regenerateEmbeddings` action**

This action regenerates embeddings for all chunks of a document:

```ts
export async function regenerateEmbeddings(
  documentId: string,
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  await documentService.updateStatus(doc.id, 'processing', 'Regenerating embeddings...');
  revalidatePath(`/knowledge/${documentId}`);

  try {
    const chunks = await documentService.getChunks(documentId);
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      await documentService.updateChunkEmbedding(chunk.id, embedding);
    }
    await documentService.updateStatus(doc.id, 'ready');
  } catch (e) {
    console.error('Error regenerating embeddings:', e);
    await documentService.updateStatus(doc.id, 'error', 'Failed to regenerate embeddings');
  }

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Embeddings regenerated' };
}
```

**Step 3: Add `updateChunkEmbedding` to service/repo layers**

In `DocumentChunkRepository`, add:

```ts
async updateEmbedding(id: string, embedding: number[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('document_chunks').update({ embedding }).eq('id', id);
  if (error) throw new Error(`Failed to update embedding: ${error.message}`);
}
```

In `DocumentService`, add:

```ts
async updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  await this.chunkRepo.updateEmbedding(chunkId, embedding);
}
```

In `IDocumentChunkRepository`, add:

```ts
updateEmbedding(id: string, embedding: number[]): Promise<void>;
```

**Step 4: Add `updateDocumentMetadata` action**

```ts
export async function updateDocumentMeta(
  documentId: string,
  updates: { name?: string; school?: string; course?: string },
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  const metadataUpdates: Record<string, unknown> = {};
  if (updates.name) metadataUpdates.name = updates.name;
  if (updates.school || updates.course) {
    const existingMeta = (doc.metadata as Record<string, unknown>) ?? {};
    metadataUpdates.metadata = {
      ...existingMeta,
      ...(updates.school && { school: updates.school }),
      ...(updates.course && { course: updates.course }),
    };
  }

  await documentService.updateDocumentMetadata(documentId, metadataUpdates);

  revalidatePath(`/knowledge/${documentId}`);
  revalidatePath('/knowledge');
  return { status: 'success', message: 'Document updated' };
}
```

**Step 5: Commit**

```bash
git add src/app/actions/documents.ts src/lib/services/ src/lib/repositories/ src/lib/domain/interfaces/
git commit -m "feat(actions): add server actions for document detail operations"
```

---

### Task 7: Add "View Details" Link to KnowledgeTable

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx`

**Step 1: Add navigation to table rows**

In `src/components/rag/KnowledgeTable.tsx`:

- Import `useRouter` from `next/navigation`
- Import `Eye` from `lucide-react`
- Add `const router = useRouter();`
- Make the desktop table row name clickable:

Replace the Name cell content:

```tsx
<Table.Td>
  <Group gap="xs">
    <FileText size={16} className="text-gray-500" />
    <Text
      size="sm"
      fw={500}
      style={{ cursor: 'pointer' }}
      c="indigo"
      onClick={() => router.push(`/knowledge/${doc.id}`)}
    >
      {doc.name}
    </Text>
  </Group>
</Table.Td>
```

- Add an Eye icon button in the action column next to delete:

```tsx
{
  !readOnly && (
    <Table.Td>
      <Group gap={4}>
        <ActionIcon
          variant="subtle"
          color="indigo"
          onClick={() => router.push(`/knowledge/${doc.id}`)}
        >
          <Eye size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={() => handleDelete(doc.id)}
          loading={deletingId === doc.id}
        >
          <Trash2 size={16} />
        </ActionIcon>
      </Group>
    </Table.Td>
  );
}
```

- Similarly for mobile card view, make the card clickable or add a "View" button.

**Step 2: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx
git commit -m "feat(ui): add view details link to knowledge table rows"
```

---

### Task 8: Fix Error Handling and Validation in Upload Flow

**Files:**

- Modify: `src/app/actions/documents.ts`

**Step 1: Add empty PDF detection**

After PDF parsing succeeds, add check:

```ts
// Check for empty PDF
const totalText = pdfData.pages.reduce((acc, p) => acc + p.text.trim(), '');
if (totalText.length === 0) {
  await documentService.updateStatus(doc.id, 'error', 'PDF contains no extractable text');
  revalidatePath('/knowledge');
  return { status: 'error', message: 'PDF contains no extractable text' };
}
```

**Step 2: Add cleanup on embedding failure**

In the outer catch of the upload function, clean up orphaned chunks:

```ts
} catch (error) {
  console.error('Upload error:', error);
  // Attempt to clean up orphaned document/chunks if doc was created
  if (typeof doc !== 'undefined' && doc?.id) {
    try {
      await documentService.deleteChunksByDocumentId(doc.id);
      await documentService.updateStatus(doc.id, 'error', 'Upload failed unexpectedly');
    } catch { /* ignore cleanup errors */ }
    revalidatePath('/knowledge');
  }
  return { status: 'error', message: 'Internal server error during upload' };
}
```

Note: `doc` variable needs to be declared outside the try block to be accessible in catch. Move its declaration.

**Step 3: Add retry action for failed documents**

Add a new server action:

```ts
export async function retryDocument(documentId: string): Promise<UploadState> {
  // This resets the document to 'processing' and re-triggers the upload pipeline
  // For simplicity, delete existing chunks and the document, then tell user to re-upload
  // A more advanced version could re-process from stored PDF, but we don't store the PDF
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const documentService = getDocumentService();
  const doc = await documentService.findById(documentId);
  if (!doc || doc.userId !== user.id) return { status: 'error', message: 'Document not found' };

  // Clean up failed document so user can re-upload
  await documentService.deleteChunksByDocumentId(documentId);
  await documentService.deleteDocument(documentId, user.id);

  revalidatePath('/knowledge');
  return { status: 'success', message: 'Document removed. Please re-upload.' };
}
```

**Step 4: Show retry button in KnowledgeTable**

In `src/components/rag/KnowledgeTable.tsx`, for error status documents, add a retry button:

- Import `RefreshCw` from lucide-react
- Import `retryDocument` from actions
- When status is 'error', show an additional `ActionIcon` with `RefreshCw` icon that calls `retryDocument(doc.id)`

**Step 5: Commit**

```bash
git add src/app/actions/documents.ts src/components/rag/KnowledgeTable.tsx
git commit -m "fix(upload): add empty PDF detection, cleanup on failure, retry action"
```

---

### Task 9: Update Upload Progress Status to Real Stages

**Files:**

- Modify: `src/app/actions/documents.ts`
- Modify: `src/components/rag/KnowledgeTable.tsx`

**Step 1: Add progress stage updates during upload**

In `uploadDocument()`, update `status_message` at each stage so the UI can show real progress:

```ts
// After PDF parse success:
await documentService.updateStatus(doc.id, 'processing', 'Parsing PDF...');
revalidatePath('/knowledge');

// Before LLM extraction:
await documentService.updateStatus(doc.id, 'processing', 'Extracting content...');
revalidatePath('/knowledge');

// Before embedding generation (if applicable):
await documentService.updateStatus(doc.id, 'processing', 'Generating embeddings...');
revalidatePath('/knowledge');

// Before saving:
await documentService.updateStatus(doc.id, 'processing', 'Saving...');
revalidatePath('/knowledge');
```

**Step 2: Show progress stage in KnowledgeTable**

In the `renderStatusBadge` function, when status is 'processing', show the `status_message`:

```tsx
if (doc.status === 'processing') {
  return (
    <Badge color="blue" variant="light" leftSection={<Clock size={12} />}>
      {doc.status_message || 'Processing'}
    </Badge>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/actions/documents.ts src/components/rag/KnowledgeTable.tsx
git commit -m "feat(upload): show real progress stages during document processing"
```

---

### Task 10: Build and Verify

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run linter**

```bash
npm run lint
```

Fix any lint errors.

**Step 3: Run build**

```bash
npm run build
```

Fix any build errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and type errors"
```

---

## Task Dependency Order

```
Task 1 (parsers) ──┐
Task 2 (toggle)  ──┼── Task 3 (dispatch) ── Task 8 (error handling)
Task 4 (repo)    ──┤                        Task 9 (progress)
                    └── Task 5 (detail page) ── Task 6 (detail actions)
                        Task 7 (table links)
                        Task 10 (build verify)
```

Tasks 1, 2, 4 can be done in parallel. Task 3 depends on 1+2. Tasks 5-9 can proceed after 4. Task 10 is final.
