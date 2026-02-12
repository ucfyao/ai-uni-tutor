# Architecture Optimization Design

## Overview

Full architecture health check of AI Uni Tutor, covering all layers from database to frontend. This document captures 24 issues across 4 priority tiers and proposes a phased optimization roadmap.

**Codebase snapshot**: ~22,870 lines TypeScript/React, 5 repositories, 8 services, 6 server actions, 4 API routes, 4 context providers.

---

## Phase 1: Security & Data Integrity (P0)

Critical issues that could lead to unauthorized access, data loss, or financial risk. Should be addressed before any feature work.

### 1.1 Admin Endpoints Missing Role Verification

**Location**: `src/app/actions/admin-content.ts` (lines 31, 49, 100, 211)

**Problem**: All admin actions only call `getCurrentUser()` without checking user role. Any authenticated user can upload/delete admin content.

**Fix**:

```typescript
// src/lib/auth.ts
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError('Not authenticated');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'admin') throw new ForbiddenError('Admin access required');
  return user;
}
```

Apply `requireAdmin()` to all functions in `admin-content.ts`.

### 1.2 Mock Exam Missing Ownership Verification

**Location**: `src/app/actions/mock-exams.ts` (lines 100-151)

**Problem**: `submitMockAnswer`, `completeMockExam`, `getMockExamResult` accept a mockId without verifying it belongs to the current user. Cross-user access is possible.

**Fix**: Add ownership check via Supabase RLS or explicit query filter:

```typescript
const { data } = await supabase
  .from('mock_exams')
  .select('id')
  .eq('id', mockId)
  .eq('user_id', user.id)
  .single();
if (!data) throw new NotFoundError('Mock exam not found');
```

### 1.3 Exam Paper Detail Leaks Data

**Location**: `src/app/actions/exam-papers.ts` (lines 74-80)

**Problem**: `getExamPaperDetail` checks authentication but not ownership. Any user can view any paper's full details.

**Fix**: Add ownership or visibility check — allow access only if `visibility = 'public'` OR `user_id = currentUser.id`.

### 1.4 Stripe Webhook Not Idempotent

**Location**: `src/app/api/stripe/webhook/route.ts`

**Problem**: No idempotency check. DB update failures still return 200 to Stripe. Webhook retries can cause duplicate processing.

**Fix**:

- Store processed `event.id` in a `stripe_events` table
- Skip already-processed events
- Return 500 on DB update failure so Stripe retries

### 1.5 Stripe Checkout Race Condition

**Location**: `src/app/api/stripe/checkout/route.ts` (lines 22-32)

**Problem**: Creates Stripe Customer first, then updates profile. If profile update fails, orphaned Stripe customer exists (financial risk).

**Fix**: Check for existing `stripe_customer_id` on profile first. If absent, create customer and update in a single Supabase RPC call (Postgres function) to ensure atomicity.

### 1.6 Zero Transaction Support

**Problem**: 7 multi-step operations have no transaction protection:

1. ExamPaper parsing (5 steps)
2. MockExam generation from topic (4 steps)
3. MockExam generation from paper (5 steps)
4. Document upload (5 steps)
5. Stripe checkout (2 steps)
6. Admin content upload (5 steps)
7. Webhook subscription update (2 steps)

**Fix**: For critical flows, create Postgres stored procedures:

```sql
CREATE OR REPLACE FUNCTION create_exam_with_questions(
  p_paper jsonb, p_questions jsonb[]
) RETURNS uuid AS $$
DECLARE v_paper_id uuid;
BEGIN
  INSERT INTO exam_papers (...) VALUES (...) RETURNING id INTO v_paper_id;
  INSERT INTO exam_questions (paper_id, ...) SELECT v_paper_id, ... FROM unnest(p_questions);
  RETURN v_paper_id;
END;
$$ LANGUAGE plpgsql;
```

For simpler cases, use Supabase's `.rpc()` to call transactional functions.

### 1.7 AI Endpoints Missing Rate Limits

**Problem**: Only chat endpoints have quota enforcement. These AI-powered endpoints have zero protection:

- `ExamPaperService.parsePaper` — calls Gemini
- `MockExamService.generateMock` — calls Gemini
- `MockExamService.generateFromTopic` — calls Gemini
- Document embedding generation — calls Gemini

**Fix**: Extend `QuotaService` to cover all AI operations:

```typescript
// Reuse existing daily + per-window pattern
const { allowed } = await quotaService.checkAndConsume(userId, 'ai_operation');
if (!allowed) throw new QuotaExceededError();
```

---

## Phase 2: Architecture Consistency (P1)

Structural issues that increase maintenance cost and introduce subtle bugs.

### 2.1 Exam Services Bypass Repository Layer

**Problem**: `ExamPaperService` and `MockExamService` call Supabase directly, while other services use Repository pattern.

**Fix**: Create missing repositories:

- `ExamPaperRepository` — CRUD for exam_papers + exam_questions
- `MockExamRepository` — CRUD for mock_exams

Migrate all direct Supabase calls from these services into the new repositories.

### 2.2 Repository Error Handling Inconsistent

**Problem**: Read operations return `null`/`[]` on error (silent failure). Write operations throw. Callers cannot distinguish "not found" from "database error".

**Fix**: Adopt a consistent pattern — reads throw on DB error, return `null` for not-found:

```typescript
async findById(id: string): Promise<Entity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(this.table).select().eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new DatabaseError(`Failed to fetch ${this.table}`, error);
  }
  return this.mapToEntity(data);
}
```

Add custom error classes: `DatabaseError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`.

### 2.3 Server Action Response Format Inconsistent

**Problem**: 4 different response patterns across 6 action files.

**Fix**: Standardize on one pattern:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

Apply to all actions. Use `code` field for machine-readable error types (e.g. `'QUOTA_EXCEEDED'`, `'UNAUTHORIZED'`).

### 2.4 Document Upload Logic Duplicated

**Problem**: `src/app/actions/documents.ts` and `src/app/actions/admin-content.ts` share ~90% identical PDF processing code.

**Fix**: Extract to `DocumentService.uploadAndProcess()`:

```typescript
class DocumentService {
  async uploadAndProcess(file: Buffer, fileName: string, opts: UploadOptions): Promise<Document> {
    const doc = await this.repository.create({ ... });
    const pages = await parsePdf(file);
    const chunks = await chunkPages(pages);
    const embeddings = await this.generateEmbeddings(chunks);
    await this.chunkRepository.createBatch(embeddings);
    await this.repository.updateStatus(doc.id, 'ready');
    return doc;
  }
}
```

Both actions call this single method.

### 2.5 Domain Model / Database Mismatch

**Problem**:

- `DocumentEntity` missing `docType` and `courseId` (DB has them, code doesn't read them)
- `MessageEntity` defines `images` field (no DB column)
- `KnowledgeCardEntity` defined but no Repository

**Fix**:

- Add `docType` and `courseId` to `DocumentEntity` + `DocumentRepository.mapToEntity()`
- Remove `images` from `MessageEntity` or add DB migration
- Remove `KnowledgeCardEntity` if not needed, or implement `KnowledgeCardRepository`

---

## Phase 3: Frontend State & Performance (P2)

### 3.1 TanStack Query Installed But Unused

**Problem**: `QueryClientProvider` configured but zero `useQuery`/`useMutation` calls. All data fetching is manual state management.

**Fix**: Migrate incrementally. Highest-value targets first:

1. **KnowledgeTable** — replace manual fetch + optimistic delete with `useQuery` + `useMutation`
2. **FileUploader** — replace manual loading/error state with `useMutation`
3. **SessionContext** — replace manual fetch + dedup with `useQuery({ queryKey: ['sessions', userId] })`
4. **ProfileContext** — replace manual fetch with `useQuery({ queryKey: ['profile', userId] })`

This eliminates ~200 lines of hand-rolled caching, deduplication, and rollback code.

### 3.2 Memory Leaks

**Leak 1**: `src/hooks/use-toast.ts:177`

```typescript
// Bug: [state] in dependency array causes listener re-registration on every state change
}, [state]);
// Fix:
}, []);
```

**Leak 2**: `src/components/modes/LectureHelper.tsx`

```typescript
// Missing: cleanup for createObjectURL
useEffect(() => {
  return () => imagePreviews.forEach((url) => URL.revokeObjectURL(url));
}, [imagePreviews]);
```

### 3.3 ProfileContext Loading State Bug

**Location**: `src/context/ProfileContext.tsx:43`

```typescript
// Bug: loading = true when profile already exists
const [loading, setLoading] = useState(initialProfile != null);
// Fix:
const [loading, setLoading] = useState(initialProfile == null);
```

### 3.4 ChatLayout Prop Drilling (29 Props)

**Fix**: Extract file upload state into a `useFileUpload()` hook, and knowledge card state into a `useKnowledgeCards()` context. Reduces ChatLayout props from 29 to ~15.

### 3.5 Single Error Boundary

**Problem**: One error boundary for entire `(protected)` route group.

**Fix**: Add granular boundaries:

- `ChatErrorBoundary` — around chat session area
- `KnowledgePanelErrorBoundary` — around knowledge panel
- `FileUploadErrorBoundary` — around file upload zone

### 3.6 Zero Suspense Boundaries

**Fix**: Add `<Suspense>` at page level for streaming SSR:

```tsx
// src/app/(protected)/lecture/[id]/page.tsx
<Suspense fallback={<LectureSkeleton />}>
  <LectureClient />
</Suspense>
```

---

## Phase 4: Infrastructure & Testing (P3)

### 4.1 RAG Pipeline Hardcoded Parameters

**Fix**: Create `src/lib/rag/config.ts`:

```typescript
export const RAG_CONFIG = {
  chunkSize: parseInt(process.env.RAG_CHUNK_SIZE || '1000'),
  chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP || '200'),
  embeddingDimension: parseInt(process.env.RAG_EMBEDDING_DIM || '768'),
  matchThreshold: parseFloat(process.env.RAG_MATCH_THRESHOLD || '0.5'),
  rrfK: parseInt(process.env.RAG_RRF_K || '60'),
  batchSize: parseInt(process.env.RAG_BATCH_SIZE || '5'),
} as const;
```

### 4.2 Embedding Generation No Retry

**Fix**: Reuse ChatService's retry pattern:

```typescript
async function generateEmbeddingWithRetry(text: string, maxRetries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateEmbedding(text);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error('Unreachable');
}
```

### 4.3 Environment Variable Startup Validation

**Fix**: Create `src/lib/env.ts` with Zod:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
```

Import in `next.config.ts` to fail fast on startup.

### 4.4 Health Check Endpoint

**Fix**: Create `src/app/api/health/route.ts`:

```typescript
export async function GET() {
  const checks = await Promise.allSettled([checkSupabase(), checkRedis(), checkGemini()]);
  const status = checks.every((c) => c.status === 'fulfilled') ? 'healthy' : 'degraded';
  return Response.json({ status, timestamp: Date.now() });
}
```

### 4.5 Security Response Headers

**Fix**: Add to `next.config.ts`:

```typescript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  }];
}
```

### 4.6 Testing Roadmap

Current: 6 test files, 33 tests. Target: cover all critical paths.

**Priority test additions**:

| Priority | Module                           | Type        | Why                      |
| -------- | -------------------------------- | ----------- | ------------------------ |
| P0       | Admin authorization              | Unit        | Security critical        |
| P0       | Mock exam ownership              | Unit        | Security critical        |
| P1       | ExamPaperRepository              | Unit        | New code, needs coverage |
| P1       | MockExamRepository               | Unit        | New code, needs coverage |
| P1       | DocumentService.uploadAndProcess | Integration | Core workflow            |
| P2       | RAG chunking                     | Unit        | Data quality             |
| P2       | RAG retrieval                    | Integration | Core feature             |
| P3       | Stripe webhook                   | Integration | Financial                |
| P3       | Chat stream E2E                  | E2E         | User-facing              |

---

## Implementation Order

```
Phase 1 (P0) — Security & Data Integrity
├── 1.1 Admin role check              ~30 min
├── 1.2 Mock exam ownership           ~30 min
├── 1.3 Exam paper access control     ~20 min
├── 1.4 Stripe webhook idempotency    ~2 hrs
├── 1.5 Stripe checkout atomicity     ~1 hr
├── 1.6 Transaction support (top 3)   ~4 hrs
└── 1.7 AI endpoint rate limits       ~2 hrs

Phase 2 (P1) — Architecture Consistency
├── 2.1 ExamPaper/MockExam repos      ~4 hrs
├── 2.2 Error handling + error types  ~3 hrs
├── 2.3 Action response standardize   ~2 hrs
├── 2.4 Document upload dedup         ~1 hr
└── 2.5 Domain model alignment        ~1 hr

Phase 3 (P2) — Frontend Optimization
├── 3.1 TanStack Query migration      ~4 hrs
├── 3.2 Memory leak fixes             ~30 min
├── 3.3 Loading state bug fix         ~10 min
├── 3.4 Prop drilling reduction       ~2 hrs
├── 3.5 Error boundaries              ~1 hr
└── 3.6 Suspense boundaries           ~1 hr

Phase 4 (P3) — Infrastructure & Testing
├── 4.1 RAG config extraction         ~30 min
├── 4.2 Embedding retry logic         ~30 min
├── 4.3 Env validation                ~30 min
├── 4.4 Health check endpoint         ~30 min
├── 4.5 Security headers              ~15 min
└── 4.6 Test coverage expansion       ~8 hrs
```

**Recommended approach**: Complete Phase 1 as a single focused sprint. Phase 2-4 can be interleaved with feature work.
