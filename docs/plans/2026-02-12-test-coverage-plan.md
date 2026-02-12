# Test Coverage Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring test coverage from ~3% (5 files, 26 tests) to 60%+ statement coverage across all architectural layers.

**Architecture:** Pure mock approach — mock Supabase, Redis, Gemini, Stripe. No external dependencies. Shared mock factories + fixtures reused across all tests. Colocated test files (`<module>.test.ts` next to source).

**Tech Stack:** Vitest 4.0.18, @vitest/coverage-v8, vi.mock/vi.fn for mocking

---

## Task 1: Install coverage dependency and update vitest config

**Files:**

- Modify: `package.json`
- Modify: `vitest.config.ts`

**Step 1: Install @vitest/coverage-v8**

Run: `npm install -D @vitest/coverage-v8`

**Step 2: Update vitest.config.ts**

Add coverage configuration:

```typescript
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/lib/**', 'src/app/actions/**', 'src/app/api/**', 'src/constants/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'src/lib/supabase/client.ts'],
      thresholds: {
        statements: 60,
        branches: 50,
      },
    },
  },
});
```

**Step 3: Add test:coverage script to package.json**

Add to `"scripts"`:

```json
"test:coverage": "vitest run --coverage"
```

**Step 4: Run tests to verify config**

Run: `npx vitest run`
Expected: All 26 existing tests pass, no regressions.

**Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "test(config): add coverage config and @vitest/coverage-v8"
```

---

## Task 2: Create shared mock factories

**Files:**

- Create: `src/__tests__/helpers/mockSupabase.ts`
- Create: `src/__tests__/helpers/mockGemini.ts`

**Step 1: Create mockSupabase helper**

This factory creates a chainable Supabase mock that simulates `.from().select().eq().single()` patterns. It tracks calls and supports presetting return data.

```typescript
// src/__tests__/helpers/mockSupabase.ts
import { vi } from 'vitest';

type MockResponse = { data: unknown; error: unknown };

/**
 * Creates a chainable Supabase client mock.
 * Usage:
 *   const mock = createMockSupabase();
 *   mock.setResponse({ data: [...], error: null });
 *   vi.mocked(createClient).mockResolvedValue(mock.client);
 */
export function createMockSupabase() {
  let pendingResponse: MockResponse = { data: null, error: null };

  const chainMethods = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    or: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    rpc: vi.fn(),
  };

  // Make all chain methods return the mock itself (chainable)
  const client = chainMethods as Record<string, ReturnType<typeof vi.fn>>;
  for (const key of Object.keys(chainMethods)) {
    if (key === 'single' || key === 'maybeSingle') {
      client[key].mockImplementation(() => Promise.resolve(pendingResponse));
    } else if (key === 'rpc') {
      client[key].mockImplementation(() => Promise.resolve(pendingResponse));
    } else {
      client[key].mockReturnValue(client);
    }
  }

  return {
    client,
    /** Set the response for the next terminal call (single/maybeSingle/order/eq as terminal) */
    setResponse(response: MockResponse) {
      pendingResponse = response;
      // Also set for non-single terminal calls
      client.order.mockImplementation(() => Promise.resolve(response));
      client.eq.mockImplementation(() => {
        // Return chainable by default, but store for terminal use
        return client;
      });
    },
    /** Set response specifically for .single() calls */
    setSingleResponse(response: MockResponse) {
      client.single.mockResolvedValue(response);
      client.maybeSingle.mockResolvedValue(response);
    },
    /** Set response for terminal query (no .single()) like select().eq() returning array */
    setQueryResponse(response: MockResponse) {
      pendingResponse = response;
      // The last chainable call before await resolves the promise
      for (const key of [
        'eq',
        'neq',
        'or',
        'order',
        'limit',
        'range',
        'in',
        'is',
        'gt',
        'gte',
        'lt',
        'lte',
      ]) {
        const original = client[key];
        client[key] = vi.fn().mockImplementation((...args: unknown[]) => {
          const result = {
            ...client,
            then: (resolve: (v: MockResponse) => void) => resolve(response),
          };
          return result;
        });
        // Preserve mock metadata
        client[key].mockName = original.mockName;
      }
    },
    /** Reset all mocks */
    reset() {
      pendingResponse = { data: null, error: null };
      for (const fn of Object.values(client)) {
        fn.mockClear();
      }
    },
  };
}

/** Create a simple not-found PGRST116 error */
export const PGRST116 = {
  code: 'PGRST116',
  message: 'JSON object requested, multiple (or no) rows returned',
};

/** Create a generic DB error */
export const dbError = (message = 'Database error') => ({ code: 'UNKNOWN', message });
```

**Step 2: Create mockGemini helper**

```typescript
// src/__tests__/helpers/mockGemini.ts
import { vi } from 'vitest';

/**
 * Creates a mock Gemini AI client.
 * Usage:
 *   const mock = createMockGemini();
 *   mock.setGenerateResponse('AI response text');
 *   vi.mocked(getGenAI).mockReturnValue(mock.client);
 */
export function createMockGemini() {
  const generateContent = vi.fn();
  const generateContentStream = vi.fn();
  const embedContent = vi.fn();

  const client = {
    models: {
      generateContent,
      generateContentStream,
      embedContent,
    },
  };

  return {
    client,
    /** Set text response for generateContent */
    setGenerateResponse(text: string) {
      generateContent.mockResolvedValue({ text });
    },
    /** Set JSON response for generateContent */
    setGenerateJSON(data: unknown) {
      generateContent.mockResolvedValue({ text: JSON.stringify(data) });
    },
    /** Set error for generateContent */
    setGenerateError(error: Error) {
      generateContent.mockRejectedValue(error);
    },
    /** Set stream response for generateContentStream */
    setStreamResponse(chunks: string[]) {
      async function* stream() {
        for (const chunk of chunks) {
          yield { text: chunk };
        }
      }
      generateContentStream.mockResolvedValue(stream());
    },
    /** Set embedding response */
    setEmbeddingResponse(values: number[]) {
      embedContent.mockResolvedValue({ embeddings: [{ values }] });
    },
    /** Reset all mocks */
    reset() {
      generateContent.mockReset();
      generateContentStream.mockReset();
      embedContent.mockReset();
    },
  };
}
```

**Step 3: Run tests to verify no regressions**

Run: `npx vitest run`
Expected: 26 tests pass.

**Step 4: Commit**

```bash
git add src/__tests__/helpers/
git commit -m "test(config): add shared mock factories for Supabase and Gemini"
```

---

## Task 3: Create test fixtures

**Files:**

- Create: `src/__tests__/fixtures/users.ts`
- Create: `src/__tests__/fixtures/sessions.ts`
- Create: `src/__tests__/fixtures/messages.ts`
- Create: `src/__tests__/fixtures/documents.ts`
- Create: `src/__tests__/fixtures/exams.ts`

**Step 1: Create fixture files**

These provide reusable test data. Check actual entity shapes in `src/lib/domain/interfaces/` and `src/lib/domain/entities.ts`.

```typescript
// src/__tests__/fixtures/users.ts
export const freeUser = {
  id: 'user-free-1',
  email: 'free@test.com',
  subscription_status: 'free',
};

export const proUser = {
  id: 'user-pro-1',
  email: 'pro@test.com',
  subscription_status: 'active',
};

export const adminUser = {
  id: 'user-admin-1',
  email: 'admin@test.com',
  role: 'admin',
  subscription_status: 'active',
};
```

```typescript
// src/__tests__/fixtures/sessions.ts
export const testCourse = {
  id: 'course-1',
  universityId: 'uni-1',
  code: 'CS101',
  name: 'Intro to Computer Science',
};

export const sessionRow = {
  id: 'session-1',
  user_id: 'user-free-1',
  course: testCourse,
  mode: 'Lecture Helper' as const,
  title: 'Test Session',
  is_pinned: false,
  is_shared: false,
  share_expires_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const sessionEntity = {
  id: 'session-1',
  userId: 'user-free-1',
  course: testCourse,
  mode: 'Lecture Helper' as const,
  title: 'Test Session',
  isPinned: false,
  isShared: false,
  shareExpiresAt: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};
```

```typescript
// src/__tests__/fixtures/messages.ts
export const userMessageRow = {
  id: 'msg-1',
  session_id: 'session-1',
  role: 'user' as const,
  content: 'What is recursion?',
  card_id: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const assistantMessageRow = {
  id: 'msg-2',
  session_id: 'session-1',
  role: 'assistant' as const,
  content: 'Recursion is a technique...',
  card_id: null,
  created_at: '2024-01-01T00:00:01Z',
};

export const messageEntity = {
  id: 'msg-1',
  sessionId: 'session-1',
  role: 'user' as const,
  content: 'What is recursion?',
  cardId: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};
```

```typescript
// src/__tests__/fixtures/documents.ts
export const documentRow = {
  id: 'doc-1',
  user_id: 'user-free-1',
  name: 'lecture-notes.pdf',
  status: 'ready',
  status_message: null,
  metadata: { school: 'MIT', course: 'CS101' },
  doc_type: 'lecture',
  course_id: null,
  created_at: '2024-01-01T00:00:00Z',
};

export const chunkRow = {
  id: 'chunk-1',
  document_id: 'doc-1',
  content: 'Arrays are data structures...',
  metadata: { page: 1 },
  embedding: null,
};
```

```typescript
// src/__tests__/fixtures/exams.ts
export const examPaperRow = {
  id: 'paper-1',
  user_id: 'user-free-1',
  title: 'CS101 Midterm 2024',
  school: 'MIT',
  course_code: 'CS101',
  course_name: 'Intro to CS',
  year: '2024',
  status: 'ready',
  status_message: null,
  visibility: 'public',
  question_count: 5,
  created_at: '2024-01-01T00:00:00Z',
};

export const questionRow = {
  id: 'q-1',
  paper_id: 'paper-1',
  order_num: 1,
  type: 'choice',
  content: 'What is 2+2?',
  options: { A: '3', B: '4', C: '5', D: '6' },
  answer: 'B',
  explanation: '2+2 equals 4',
  points: 1,
  knowledge_point: 'Basic arithmetic',
  difficulty: 'easy',
};

export const mockExamRow = {
  id: 'mock-1',
  user_id: 'user-free-1',
  paper_id: 'paper-1',
  session_id: 'session-1',
  questions: [questionRow],
  responses: {},
  current_index: 0,
  score: null,
  total_points: 5,
  status: 'in_progress',
  created_at: '2024-01-01T00:00:00Z',
};
```

**Step 2: Run tests**

Run: `npx vitest run`
Expected: 26 tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/fixtures/
git commit -m "test(config): add shared test fixtures for all entity types"
```

---

## Task 4: Test errors.ts

**Files:**

- Create: `src/lib/errors.test.ts` (next to existing `src/lib/errors.ts`)
- Reference: `src/lib/errors.ts`

**Step 1: Read `src/lib/errors.ts` to understand exact exports and behavior**

Key exports: `AppError`, `DatabaseError`, `QuotaExceededError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `mapError`, `ERROR_MAP`

**Step 2: Write test file**

Test all error classes, `ERROR_MAP` completeness, and `mapError` mapping logic. Cover both known AppError types and unknown Error fallback.

**Step 3: Run test**

Run: `npx vitest run src/lib/errors.test.ts`
Expected: All tests pass (testing existing code).

**Step 4: Commit**

```bash
git add src/lib/errors.test.ts
git commit -m "test(config): add unit tests for unified error system"
```

---

## Task 5: Test sse.ts

**Files:**

- Create: `src/lib/sse.test.ts`
- Reference: `src/lib/sse.ts`

**Step 1: Read `src/lib/sse.ts` to understand exact function signatures**

Key functions: `sseEvent(event, data)`, `createSSEStream()`

**Step 2: Write tests**

Test SSE event formatting, stream creation, send/close lifecycle, double-close safety.

**Step 3: Run test**

Run: `npx vitest run src/lib/sse.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/lib/sse.test.ts
git commit -m "test(config): add unit tests for SSE utilities"
```

---

## Task 6: Test ai-utils.ts (if exists) or other utility modules

**Files:**

- Create: `src/lib/ai-utils.test.ts` (if `ai-utils.ts` exists)
- Reference: `src/lib/ai-utils.ts`

**Step 1: Read the file, understand exports**

**Step 2: Write tests for all exported functions**

Focus on JSON parsing edge cases, error handling for malformed AI responses.

**Step 3: Run and commit**

Run: `npx vitest run src/lib/ai-utils.test.ts`

```bash
git add src/lib/ai-utils.test.ts
git commit -m "test(config): add unit tests for AI utility functions"
```

---

## Task 7: Test RAG chunking module

**Files:**

- Create: `src/lib/rag/chunking.test.ts`
- Reference: `src/lib/rag/chunking.ts`

**Step 1: Read `src/lib/rag/chunking.ts`**

Functions: `chunkText(text, chunkSize, chunkOverlap)`, `chunkPages(pages, chunkSize, chunkOverlap)`

**Step 2: Write tests**

- Short text → single chunk
- Long text → multiple chunks with expected size
- Pages → chunks with page metadata preserved
- Default params (from `src/lib/rag/config.ts`: size=1000, overlap=200)

**Step 3: Run and commit**

Run: `npx vitest run src/lib/rag/chunking.test.ts`

```bash
git add src/lib/rag/chunking.test.ts
git commit -m "test(rag): add unit tests for text chunking"
```

---

## Task 8: Test RAG embedding module

**Files:**

- Create: `src/lib/rag/embedding.test.ts`
- Reference: `src/lib/rag/embedding.ts`

**Step 1: Read the file**

Functions: `generateEmbedding(text)`, `generateEmbeddingWithRetry(text, maxRetries)`

**Step 2: Write tests with mocked Gemini**

- Successful embedding generation
- Retry on failure with exponential backoff (use `vi.useFakeTimers()`)
- Throw after max retries
- Empty embedding array handling

**Step 3: Run and commit**

Run: `npx vitest run src/lib/rag/embedding.test.ts`

```bash
git add src/lib/rag/embedding.test.ts
git commit -m "test(rag): add unit tests for embedding generation"
```

---

## Task 9: Test RAG retrieval module

**Files:**

- Create: `src/lib/rag/retrieval.test.ts`
- Reference: `src/lib/rag/retrieval.ts`

**Step 1: Read the file**

Function: `retrieveContext(query, filter, matchCount)` — calls `hybrid_search` RPC

**Step 2: Write tests with mocked Supabase + embedding**

- Successful retrieval with formatted citations
- Empty results
- RPC error → returns empty string
- Chunks without page metadata

**Step 3: Run and commit**

Run: `npx vitest run src/lib/rag/retrieval.test.ts`

```bash
git add src/lib/rag/retrieval.test.ts
git commit -m "test(rag): add unit tests for context retrieval"
```

---

## Task 10: Test RAG parsers (lecture-parser + question-parser)

**Files:**

- Create: `src/lib/rag/parsers/lecture-parser.test.ts`
- Create: `src/lib/rag/parsers/question-parser.test.ts`
- Reference: `src/lib/rag/parsers/lecture-parser.ts`, `src/lib/rag/parsers/question-parser.ts`

**Step 1: Read both parser files**

**Step 2: Write tests with mocked Gemini**

For lecture-parser:

- Extract knowledge points from pages
- Empty pages → empty array
- Invalid AI JSON → throws

For question-parser:

- Extract questions with answers
- Extract questions without answers
- Multiple choice questions with options

**Step 3: Run and commit**

Run: `npx vitest run src/lib/rag/parsers/`

```bash
git add src/lib/rag/parsers/lecture-parser.test.ts src/lib/rag/parsers/question-parser.test.ts
git commit -m "test(rag): add unit tests for lecture and question parsers"
```

---

## Task 11: Run coverage check after utility tests

**Step 1: Run coverage**

Run: `npx vitest run --coverage`

**Step 2: Review coverage report**

Check which utility/lib files have good coverage. Note gaps for later.

**Step 3: Commit coverage improvements (if any config changes needed)**

---

## Task 12: Test SessionRepository

**Files:**

- Create: `src/lib/repositories/SessionRepository.test.ts`
- Reference: `src/lib/repositories/SessionRepository.ts`

**Step 1: Read SessionRepository.ts carefully**

Methods: `findById`, `findByIdAndUserId`, `findAllByUserId`, `findSharedById`, `create`, `update`, `delete`, `verifyOwnership`

**Step 2: Write tests**

Mock `@/lib/supabase/server` createClient. Test:

- `findById`: found → entity, PGRST116 → null, other error → DatabaseError
- `findByIdAndUserId`: two eq calls (id + user_id)
- `findAllByUserId`: ordering by pinned then updated_at
- `findSharedById`: checks is_shared + expiry
- `create`: correct insert payload, maps result to entity
- `update`: maps camelCase fields to snake_case, sets updated_at
- `delete`: correct table + id
- `verifyOwnership`: true/false based on result

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/SessionRepository.test.ts`

```bash
git add src/lib/repositories/SessionRepository.test.ts
git commit -m "test(chat): add unit tests for SessionRepository"
```

---

## Task 13: Test MessageRepository

**Files:**

- Create: `src/lib/repositories/MessageRepository.test.ts`
- Reference: `src/lib/repositories/MessageRepository.ts`

**Step 1: Read MessageRepository.ts**

Methods: `findBySessionId`, `findByCardId`, `create`, `deleteBySessionId`

**Step 2: Write tests**

- `findBySessionId`: returns ordered messages, handles error
- `create`: inserts message AND updates session `updated_at`
- `deleteBySessionId`: deletes all messages for session

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/MessageRepository.test.ts`

```bash
git add src/lib/repositories/MessageRepository.test.ts
git commit -m "test(chat): add unit tests for MessageRepository"
```

---

## Task 14: Test ProfileRepository

**Files:**

- Create: `src/lib/repositories/ProfileRepository.test.ts`
- Reference: `src/lib/repositories/ProfileRepository.ts`

**Step 1: Read ProfileRepository.ts**

Methods: `findById`, `update`, `getSubscriptionInfo`

**Step 2: Write tests**

- `findById`: returns profile entity, null on not found
- `update`: maps dto to snake_case
- `getSubscriptionInfo`: returns { status, isPro, currentPeriodEnd }

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/ProfileRepository.test.ts`

```bash
git add src/lib/repositories/ProfileRepository.test.ts
git commit -m "test(auth): add unit tests for ProfileRepository"
```

---

## Task 15: Test DocumentRepository

**Files:**

- Create: `src/lib/repositories/DocumentRepository.test.ts`
- Reference: `src/lib/repositories/DocumentRepository.ts`

**Step 1: Read DocumentRepository.ts**

Methods: `findById`, `findByUserIdAndName`, `create`, `updateStatus`, `updateMetadata`, `delete`, `verifyOwnership`

**Step 2: Write tests**

All CRUD + ownership verification + PGRST116 handling.

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/DocumentRepository.test.ts`

```bash
git add src/lib/repositories/DocumentRepository.test.ts
git commit -m "test(rag): add unit tests for DocumentRepository"
```

---

## Task 16: Test DocumentChunkRepository

**Files:**

- Create: `src/lib/repositories/DocumentChunkRepository.test.ts`
- Reference: `src/lib/repositories/DocumentChunkRepository.ts`

**Step 1: Read DocumentChunkRepository.ts**

Methods: `createBatch`, `createBatchAndReturn`, `deleteByDocumentId`, `findByDocumentId`, `updateChunk`, `deleteChunk`, `updateEmbedding`

**Step 2: Write tests**

- Batch insert (multiple chunks)
- Delete by document ID
- Update individual chunk content/metadata
- Update embedding vector

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/DocumentChunkRepository.test.ts`

```bash
git add src/lib/repositories/DocumentChunkRepository.test.ts
git commit -m "test(rag): add unit tests for DocumentChunkRepository"
```

---

## Task 17: Test ExamPaperRepository

**Files:**

- Create: `src/lib/repositories/ExamPaperRepository.test.ts`
- Reference: `src/lib/repositories/ExamPaperRepository.ts`

**Step 1: Read ExamPaperRepository.ts**

Methods: `create`, `findById`, `findWithFilters`, `findOwner`, `updateStatus`, `updatePaper`, `delete`, `insertQuestions`, `findQuestionsByPaperId`, `updateQuestion`, `findByCourse`

**Step 2: Write tests**

This is the largest repo (297 lines). Test:

- CRUD operations
- Filter-based queries (school, course, year)
- Question batch insert
- `findByCourse` returns first ready paper

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/ExamPaperRepository.test.ts`

```bash
git add src/lib/repositories/ExamPaperRepository.test.ts
git commit -m "test(api): add unit tests for ExamPaperRepository"
```

---

## Task 18: Test MockExamRepository

**Files:**

- Create: `src/lib/repositories/MockExamRepository.test.ts`
- Reference: `src/lib/repositories/MockExamRepository.ts`

**Step 1: Read MockExamRepository.ts**

Methods: `create`, `findById`, `verifyOwnership`, `findBySessionId`, `findByUserId`, `countByUserAndPaper`, `update`

**Step 2: Write tests**

- Create mock exam
- Find by ID, session, user (pagination)
- Ownership verification
- Update responses/score/status

**Step 3: Run and commit**

Run: `npx vitest run src/lib/repositories/MockExamRepository.test.ts`

```bash
git add src/lib/repositories/MockExamRepository.test.ts
git commit -m "test(api): add unit tests for MockExamRepository"
```

---

## Task 19: Run coverage check after repository tests

**Step 1: Run coverage**

Run: `npx vitest run --coverage`

**Step 2: Review**

Repository layer should be near 100% coverage. Note overall progress.

---

## Task 20: Test SessionService

**Files:**

- Create: `src/lib/services/SessionService.test.ts`
- Reference: `src/lib/services/SessionService.ts`

**Step 1: Read SessionService.ts**

Constructor takes `SessionRepository` + `MessageRepository`. Methods: `getFullSession`, `getSessionMessages`, `getUserSessions`, `getSharedSession`, `createSession`, `saveMessage`, `updateTitle`, `updateMode`, `togglePin`, `toggleShare`, `deleteSession`

**Step 2: Write tests**

Mock both repos via constructor injection. Test:

- `getFullSession`: returns session + messages, null if not found
- `saveMessage`: verifies ownership before saving
- `toggleShare`: sets 1-hour expiry, throws FORBIDDEN for non-owner
- `deleteSession`: verifies ownership, deletes messages then session

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/SessionService.test.ts`

```bash
git add src/lib/services/SessionService.test.ts
git commit -m "test(chat): add unit tests for SessionService"
```

---

## Task 21: Test ChatService

**Files:**

- Create: `src/lib/services/ChatService.test.ts`
- Reference: `src/lib/services/ChatService.ts`

**Step 1: Read ChatService.ts carefully**

This is the most complex service (321 lines). Uses Gemini API + RAG retrieval.

**Step 2: Write tests**

Mock `@/lib/gemini` (getGenAI) and `@/lib/rag/retrieval` (retrieveContext). Test:

1. **generateResponse**:
   - Lecture Helper mode: temp 0.7, RAG with 5 matches
   - Assignment Coach mode: temp 0.5, preprocesses input with `[INTERNAL:...]`
   - Validates mode is not null
   - Retries on 429 rate limit errors (up to 3 times)
   - Throws on non-rate-limit errors
   - Includes RAG context in system instruction when available

2. **generateStream**:
   - Yields chunks from Gemini stream

3. **explainConcept**:
   - Calls RAG retrieval with course code
   - Includes retrieved context in system instruction

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/ChatService.test.ts`

```bash
git add src/lib/services/ChatService.test.ts
git commit -m "test(chat): add unit tests for ChatService"
```

---

## Task 22: Test DocumentService

**Files:**

- Create: `src/lib/services/DocumentService.test.ts`
- Reference: `src/lib/services/DocumentService.ts`

**Step 1: Read DocumentService.ts**

Constructor takes `DocumentRepository` + `DocumentChunkRepository`.

**Step 2: Write tests**

- `checkDuplicate`: returns boolean based on `findByUserIdAndName`
- `createDocument`: passes correct params
- `deleteDocument`: verifies ownership, throws FORBIDDEN
- `saveChunks` / `saveChunksAndReturn`: delegates to chunk repo

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/DocumentService.test.ts`

```bash
git add src/lib/services/DocumentService.test.ts
git commit -m "test(rag): add unit tests for DocumentService"
```

---

## Task 23: Test ProfileService

**Files:**

- Create: `src/lib/services/ProfileService.test.ts`
- Reference: `src/lib/services/ProfileService.ts`

**Step 1: Read ProfileService.ts (44 lines — simplest service)**

**Step 2: Write tests**

- `getProfile`: delegates to repo
- `getSubscriptionInfo`: delegates to repo
- `updateProfile`: delegates to repo

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/ProfileService.test.ts`

```bash
git add src/lib/services/ProfileService.test.ts
git commit -m "test(auth): add unit tests for ProfileService"
```

---

## Task 24: Test ExamPaperService

**Files:**

- Create: `src/lib/services/ExamPaperService.test.ts`
- Reference: `src/lib/services/ExamPaperService.ts`

**Step 1: Read ExamPaperService.ts (231 lines)**

Uses Gemini AI for PDF parsing and question extraction.

**Step 2: Write tests**

Mock `ExamPaperRepository`, `@/lib/gemini`, `@/lib/pdf`. Test:

- `parsePaper`: creates paper, parses PDF, extracts questions via AI, updates status
- `parsePaper` error path: sets error status on AI failure
- `deletePaper`: verifies ownership, throws FORBIDDEN
- `deleteByAdmin`: skips ownership check

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/ExamPaperService.test.ts`

```bash
git add src/lib/services/ExamPaperService.test.ts
git commit -m "test(api): add unit tests for ExamPaperService"
```

---

## Task 25: Test MockExamService

**Files:**

- Create: `src/lib/services/MockExamService.test.ts`
- Reference: `src/lib/services/MockExamService.ts`

**Step 1: Read MockExamService.ts (534 lines — largest service)**

Uses Gemini AI for generating variant questions and judging answers.

**Step 2: Write tests**

Mock `MockExamRepository`, `ExamPaperRepository`, `@/lib/gemini`. Test:

- `generateFromTopic`: validates params, calls AI, creates mock exam
- `generateMock`: loads paper questions, generates variants via AI
- `submitAnswer`: AI judges correctness, updates response
- `batchSubmitAnswers`: processes in batches of 3
- `getMock`: verifies ownership

**Step 3: Run and commit**

Run: `npx vitest run src/lib/services/MockExamService.test.ts`

```bash
git add src/lib/services/MockExamService.test.ts
git commit -m "test(api): add unit tests for MockExamService"
```

---

## Task 26: Run coverage check after service tests

**Step 1: Run coverage**

Run: `npx vitest run --coverage`

**Step 2: Review**

Service layer should be 80%+ coverage. Note overall progress toward 60% target.

---

## Task 27: Test chat actions

**Files:**

- Create: `src/app/actions/chat.test.ts`
- Reference: `src/app/actions/chat.ts`

**Step 1: Read chat.ts (381 lines)**

**Step 2: Write tests**

Mock `@/lib/supabase/server` (getCurrentUser), service singletons (getChatService, getSessionService, getQuotaService), and `next/cache` (revalidatePath). Test:

- `generateChatResponse`: valid input → success, null mode → validation error, no auth → unauthorized, quota exceeded → isLimitError flag
- `createChatSession`: creates and returns session
- `saveChatMessage`: verifies auth, saves message
- `deleteChatSession`: verifies auth, deletes
- `getSharedSession`: no auth required

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/chat.test.ts`

```bash
git add src/app/actions/chat.test.ts
git commit -m "test(chat): add unit tests for chat server actions"
```

---

## Task 28: Test document actions

**Files:**

- Create: `src/app/actions/documents.test.ts`
- Reference: `src/app/actions/documents.ts`

**Step 1: Read documents.ts (326 lines)**

**Step 2: Write tests**

Mock services + auth. Test:

- `uploadDocument`: file validation, duplicate check, quota enforcement
- `deleteDocument`: auth + ownership
- `updateDocumentChunks`: batch update/delete
- `regenerateEmbeddings`: loops through chunks

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/documents.test.ts`

```bash
git add src/app/actions/documents.test.ts
git commit -m "test(rag): add unit tests for document server actions"
```

---

## Task 29: Test exam-papers actions

**Files:**

- Create: `src/app/actions/exam-papers.test.ts`
- Reference: `src/app/actions/exam-papers.ts`

**Step 1: Read exam-papers.ts**

**Step 2: Write tests**

- `uploadAndParseExamPaper`: form data validation, quota, service call
- `getExamPaperList`: returns filtered list
- `getExamPaperDetail`: ownership/visibility check
- `deleteExamPaper`: auth + delete

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/exam-papers.test.ts`

```bash
git add src/app/actions/exam-papers.test.ts
git commit -m "test(api): add unit tests for exam paper server actions"
```

---

## Task 30: Test mock-exams actions

**Files:**

- Create: `src/app/actions/mock-exams.test.ts`
- Reference: `src/app/actions/mock-exams.ts`

**Step 1: Read mock-exams.ts**

**Step 2: Write tests**

- `generateMockFromTopic`: validates topic/numQuestions/difficulty, quota
- `submitMockAnswer`: auth + index validation
- `batchSubmitMockAnswers`: auth + array validation
- `getMockExamDetail`: auth + ownership

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/mock-exams.test.ts`

```bash
git add src/app/actions/mock-exams.test.ts
git commit -m "test(api): add unit tests for mock exam server actions"
```

---

## Task 31: Test admin-content actions

**Files:**

- Create: `src/app/actions/admin-content.test.ts`
- Reference: `src/app/actions/admin-content.ts`

**Step 1: Read admin-content.ts**

**Step 2: Write tests**

- `getAdminDocuments`: requires admin, returns list
- `getAdminExamPapers`: requires admin, returns list
- `uploadAdminContent`: admin + delegates to correct service
- `deleteAdminContent`: admin + correct service call

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/admin-content.test.ts`

```bash
git add src/app/actions/admin-content.test.ts
git commit -m "test(api): add unit tests for admin content server actions"
```

---

## Task 32: Test user actions

**Files:**

- Create: `src/app/actions/user.test.ts`
- Reference: `src/app/actions/user.ts`

**Step 1: Read user.ts**

**Step 2: Write tests**

- `updateProfileFields`: validates fullName length, updates
- `getProfile`: auth + returns profile

**Step 3: Run and commit**

Run: `npx vitest run src/app/actions/user.test.ts`

```bash
git add src/app/actions/user.test.ts
git commit -m "test(auth): add unit tests for user server actions"
```

---

## Task 33: Test /api/health route

**Files:**

- Create: `src/app/api/health/route.test.ts`
- Reference: `src/app/api/health/route.ts`

**Step 1: Read route.ts (28 lines — simplest route)**

**Step 2: Write tests**

Create `Request` objects, call `GET()`, assert response status + body.

- Healthy: Supabase + Redis connected
- Degraded: Redis down
- Error: Supabase down

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/health/route.test.ts`

```bash
git add src/app/api/health/route.test.ts
git commit -m "test(api): add unit tests for health check route"
```

---

## Task 34: Test /api/quota route

**Files:**

- Create: `src/app/api/quota/route.test.ts`
- Reference: `src/app/api/quota/route.ts`

**Step 1: Read route.ts (25 lines)**

**Step 2: Write tests**

- Auth check (401 if not logged in)
- Returns quota data for authenticated user

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/quota/route.test.ts`

```bash
git add src/app/api/quota/route.test.ts
git commit -m "test(api): add unit tests for quota route"
```

---

## Task 35: Test /api/chat/stream route

**Files:**

- Create: `src/app/api/chat/stream/route.test.ts`
- Reference: `src/app/api/chat/stream/route.ts`

**Step 1: Read route.ts (226 lines)**

**Step 2: Write tests**

- 401 if not authenticated
- 400 for invalid JSON body
- 400 for invalid request body (Zod validation)
- 429 if quota exceeded (with isLimitError flag)
- 200 with SSE stream on success
- Read stream chunks, verify `data: {"text":"..."}` format + `data: [DONE]` terminator

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/chat/stream/route.test.ts`

```bash
git add src/app/api/chat/stream/route.test.ts
git commit -m "test(chat): add unit tests for chat stream API route"
```

---

## Task 36: Test /api/documents/parse route

**Files:**

- Create: `src/app/api/documents/parse/route.test.ts`
- Reference: `src/app/api/documents/parse/route.ts`

**Step 1: Read route.ts (282 lines)**

**Step 2: Write tests**

- Auth check
- Request body validation
- SSE events: status, document_created, item, progress, batch_saved, complete
- Error event on failure

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/documents/parse/route.test.ts`

```bash
git add src/app/api/documents/parse/route.test.ts
git commit -m "test(rag): add unit tests for document parse API route"
```

---

## Task 37: Test /api/stripe/checkout route

**Files:**

- Create: `src/app/api/stripe/checkout/route.test.ts`
- Reference: `src/app/api/stripe/checkout/route.ts`

**Step 1: Read route.ts (64 lines)**

**Step 2: Write tests**

Mock Stripe client. Test:

- Auth check
- Creates checkout session with correct params
- Returns session URL

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/stripe/checkout/route.test.ts`

```bash
git add src/app/api/stripe/checkout/route.test.ts
git commit -m "test(stripe): add unit tests for checkout route"
```

---

## Task 38: Test /api/stripe/webhook route

**Files:**

- Create: `src/app/api/stripe/webhook/route.test.ts`
- Reference: `src/app/api/stripe/webhook/route.ts`

**Step 1: Read route.ts (164 lines)**

**Step 2: Write tests**

Mock Stripe `constructEvent` + Supabase. Test:

- Invalid signature → 400
- `checkout.session.completed` → updates profile
- `customer.subscription.updated` → updates subscription
- `customer.subscription.deleted` → marks as canceled
- Idempotency: same event ID → skipped
- Unknown event type → 200 (ignored)

**Step 3: Run and commit**

Run: `npx vitest run src/app/api/stripe/webhook/route.test.ts`

```bash
git add src/app/api/stripe/webhook/route.test.ts
git commit -m "test(stripe): add unit tests for webhook route"
```

---

## Task 39: Final coverage check and cleanup

**Step 1: Run full test suite with coverage**

Run: `npx vitest run --coverage`

**Step 2: Review coverage report**

Target: 60%+ statements, 50%+ branches. Identify any critical gaps.

**Step 3: Fix any failing tests or coverage gaps**

Address top uncovered files if below threshold.

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(config): finalize test coverage optimization"
```

---

## Task 40: Create PR

**Step 1: Push branch**

Run: `git push -u origin feat/test-coverage`

**Step 2: Create PR**

```bash
gh pr create --title "test: comprehensive test coverage optimization" --body "$(cat <<'EOF'
## Summary
- Added ~35 new test files covering all architectural layers
- Created shared test infrastructure (mock factories, fixtures)
- Added coverage reporting with @vitest/coverage-v8
- Target: 60%+ statement coverage (from ~3%)

## Layers Covered
- **Utilities**: errors, SSE, AI utils, RAG modules
- **Repositories**: All 7 repositories (SessionRepo, MessageRepo, etc.)
- **Services**: All 7 services (ChatService, SessionService, etc.)
- **Actions**: All 6 server action files
- **API Routes**: All 6 API routes (chat/stream, stripe/webhook, etc.)

## Test plan
- [ ] `npx vitest run` — all tests pass
- [ ] `npx vitest run --coverage` — 60%+ statement coverage
- [ ] No regressions in existing 26 tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
