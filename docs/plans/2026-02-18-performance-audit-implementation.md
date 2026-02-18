# Performance Audit & Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize AI UniTutor's frontend bundle, data fetching, database queries, caching, and observability across 3 waves.

**Architecture:** Wave 1 slims the JS bundle (icon consolidation + analyzer). Wave 2 improves frontend caching and database query efficiency (pagination, column narrowing, image preview optimization). Wave 3 adds Redis application cache at the Service layer, HTTP cache headers, Server-Timing instrumentation, and TanStack Query prefetching.

**Tech Stack:** Next.js 16, TanStack Query 5, Upstash Redis, Supabase PostgreSQL, Mantine v8, lucide-react

---

## Wave 1: Bundle Slimming

### Task 1: Install Bundle Analyzer

**Files:**

- Modify: `package.json`
- Modify: `next.config.ts`

**Step 1: Install @next/bundle-analyzer**

Run:

```bash
npm install --save-dev @next/bundle-analyzer
```

**Step 2: Update next.config.ts to wrap with analyzer**

Replace the entire `next.config.ts` with:

```typescript
import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Read from env or default to 5MB
const maxFileSizeMB = process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '5';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: `${maxFileSizeMB}mb` as `${number}mb`,
    },
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', 'lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.stripe.com https://generativelanguage.googleapis.com",
              'frame-src https://js.stripe.com',
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
```

**Step 3: Add analyze script to package.json**

In `package.json` `"scripts"`, add:

```json
"analyze": "ANALYZE=true next build"
```

**Step 4: Run baseline bundle analysis**

Run:

```bash
npm run analyze
```

Note the output sizes (First Load JS per route). Save this as the baseline.

**Step 5: Verify build still passes**

Run:

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "feat(config): add bundle analyzer for performance measurement"
```

---

### Task 2: Unify Icon Library — Replace @tabler/icons-react with lucide-react

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx:1`
- Modify: `src/components/chat/WelcomeScreen.tsx:1`
- Modify: `src/components/MockExamModal.tsx:3`
- Modify: `src/components/exam/FeedbackCard.tsx:3`
- Modify: `src/components/exam/QuestionCard.tsx:3`
- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx:3-9`
- Modify: `src/app/(protected)/exam/ExamPaperUploadModal.tsx:3,48,51,54,69`
- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx:3-10`
- Modify: `src/app/(protected)/settings/page.tsx:3`
- Modify: `src/app/(protected)/admin/exam/AdminExamClient.tsx:3`
- Modify: `package.json` (remove @tabler/icons-react)

**Icon mapping (Tabler → Lucide):**

| Tabler Icon          | Lucide Equivalent | Import         |
| -------------------- | ----------------- | -------------- |
| `IconCheck`          | `Check`           | `lucide-react` |
| `IconCircleCheck`    | `CircleCheck`     | `lucide-react` |
| `IconCircleX`        | `CircleX`         | `lucide-react` |
| `IconArrowsShuffle`  | `Shuffle`         | `lucide-react` |
| `IconFileText`       | `FileText`        | `lucide-react` |
| `IconSparkles`       | `Sparkles`        | `lucide-react` |
| `IconMessageCircle`  | `MessageCircle`   | `lucide-react` |
| `IconUpload`         | `Upload`          | `lucide-react` |
| `IconX`              | `X`               | `lucide-react` |
| `IconPlus`           | `Plus`            | `lucide-react` |
| `IconTrash`          | `Trash2`          | `lucide-react` |
| `IconArrowLeft`      | `ArrowLeft`       | `lucide-react` |
| `IconArrowRight`     | `ArrowRight`      | `lucide-react` |
| `IconSend`           | `Send`            | `lucide-react` |
| `IconTargetArrow`    | `Target`          | `lucide-react` |
| `IconTrophy`         | `Trophy`          | `lucide-react` |
| `IconFilterQuestion` | `Filter`          | `lucide-react` |

**Step 1: Replace imports in each file**

For each file listed above:

1. Remove the `@tabler/icons-react` import line
2. Add the lucide equivalents to the existing `lucide-react` import (or create one)
3. Replace all `<IconFoo` JSX usage with `<Foo`

**IMPORTANT — Prop differences:**

- Tabler uses `stroke={1.5}`, Lucide uses `strokeWidth={1.5}`. You **must** rename this prop.
- `size={N}` works the same in both libraries — no change needed for `size`.
- Known files with `stroke=` prop: `src/app/(protected)/exam/ExamPaperUploadModal.tsx` lines 48, 51, 54.

**Example for ExamPaperUploadModal.tsx:**

Before (lines 47-55):

```tsx
<Dropzone.Accept>
  <IconUpload size={40} stroke={1.5} color="var(--mantine-color-violet-6)" />
</Dropzone.Accept>
<Dropzone.Reject>
  <IconX size={40} stroke={1.5} color="var(--mantine-color-red-6)" />
</Dropzone.Reject>
<Dropzone.Idle>
  <IconFileText size={40} stroke={1.5} style={{ opacity: 0.4 }} />
</Dropzone.Idle>
```

After:

```tsx
<Dropzone.Accept>
  <Upload size={40} strokeWidth={1.5} color="var(--mantine-color-violet-6)" />
</Dropzone.Accept>
<Dropzone.Reject>
  <X size={40} strokeWidth={1.5} color="var(--mantine-color-red-6)" />
</Dropzone.Reject>
<Dropzone.Idle>
  <FileText size={40} strokeWidth={1.5} style={{ opacity: 0.4 }} />
</Dropzone.Idle>
```

**Example for MessageBubble.tsx:**

This file already imports `Check` from lucide on line 2. Remove the tabler import on line 1 and replace all `IconCheck` usages with `Check`.

**Step 2: Remove @tabler/icons-react from dependencies**

Run:

```bash
npm uninstall @tabler/icons-react
```

**Step 3: Verify no remaining tabler imports**

Run:

```bash
grep -r "@tabler/icons-react" src/
```

Expected: No results.

**Step 4: Run lint and type check**

Run:

```bash
npm run lint && npx tsc --noEmit
```

Expected: No errors.

**Step 5: Run build**

Run:

```bash
npm run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/WelcomeScreen.tsx src/components/MockExamModal.tsx src/components/exam/FeedbackCard.tsx src/components/exam/QuestionCard.tsx src/app/(protected)/exam/ExamEntryClient.tsx src/app/(protected)/exam/ExamPaperUploadModal.tsx src/app/(protected)/exam/mock/[id]/MockExamClient.tsx src/app/(protected)/settings/page.tsx src/app/(protected)/admin/exam/AdminExamClient.tsx package.json package-lock.json
git commit -m "refactor(ui): replace @tabler/icons-react with lucide-react

Consolidate to single icon library to reduce bundle size.
Renames stroke → strokeWidth where needed (Tabler/Lucide prop diff).
Removes ~100-200KB of unused icon definitions."
```

---

### Task 3: Run Post-Optimization Bundle Analysis

**Step 1: Run analyzer**

Run:

```bash
npm run analyze
```

**Step 2: Compare with baseline from Task 1**

Document the before/after First Load JS sizes. Note the savings.

**Step 3: Commit analysis notes (optional)**

If desired, add a note to the design doc or a separate file with the measured improvement.

---

## Wave 2: Frontend Loading + Database Optimization

### Task 4: Optimize TanStack Query Cache Strategy

**Files:**

- Modify: `src/components/Providers.tsx:26`
- Modify: `src/hooks/useCourseData.ts:17,27`

**Step 1: Update global staleTime in Providers.tsx**

In `src/components/Providers.tsx`, change line 26:

Before:

```typescript
staleTime: 1000 * 30, // 30 seconds
```

After:

```typescript
staleTime: 1000 * 60, // 60 seconds
```

**Step 2: Update course data staleTime in useCourseData.ts**

In `src/hooks/useCourseData.ts`, change the staleTime on lines 17 and 27:

Before:

```typescript
staleTime: 5 * 60 * 1000,
```

After:

```typescript
staleTime: 10 * 60 * 1000, // 10 minutes — university/course data rarely changes
```

**Step 3: Run tests**

Run:

```bash
npx vitest run
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/components/Providers.tsx src/hooks/useCourseData.ts
git commit -m "feat(ui): optimize TanStack Query cache strategy

Increase global staleTime from 30s to 60s.
Increase course/university staleTime from 5min to 10min.
Reduces unnecessary refetches for stable data."
```

---

### Task 5: Optimize Chat Image Previews with Object URLs

**Files:**

- Modify: `src/components/modes/LectureHelper.tsx:363-367,413-416`

**Context:** Image previews currently use `FileReader.readAsDataURL()` which produces large base64 strings stored in React state. `URL.createObjectURL()` is faster and uses less memory — the browser holds a reference to the file blob instead of duplicating its contents as a string.

Note: `loading="lazy"` would be ineffective here since base64 data URLs have no network request to defer. Object URLs are the correct optimization.

**Step 1: Replace FileReader with URL.createObjectURL for image previews**

In `src/components/modes/LectureHelper.tsx`, find the image file handling (around lines 363-367):

Before:

```typescript
const reader = new FileReader();
reader.onload = (ev) => {
  setImagePreviews((prev) => [...prev, ev.target?.result as string]);
};
reader.readAsDataURL(file);
```

After:

```typescript
const objectUrl = URL.createObjectURL(file);
setImagePreviews((prev) => [...prev, objectUrl]);
```

Also update the paste handler (around lines 413-416) with the same pattern.

**Step 2: Revoke object URLs on cleanup**

Find the remove-image handler (around line 395) and add URL revocation:

Before:

```typescript
setImagePreviews((prev) => prev.filter((_, i) => i !== index));
```

After:

```typescript
setImagePreviews((prev) => {
  URL.revokeObjectURL(prev[index]);
  return prev.filter((_, i) => i !== index);
});
```

Also revoke all URLs when previews are cleared (around line 196):

Before:

```typescript
setImagePreviews([]);
```

After:

```typescript
imagePreviews.forEach((url) => URL.revokeObjectURL(url));
setImagePreviews([]);
```

**Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): use URL.createObjectURL for image previews

Replaces FileReader.readAsDataURL with object URLs for faster
preview rendering and lower memory usage. Revokes URLs on cleanup."
```

---

### Task 6: Add Pagination to DocumentRepository.findByDocTypeForAdmin

**Files:**

- Modify: `src/lib/repositories/DocumentRepository.ts:147-167`
- Modify: `src/lib/domain/interfaces/IDocumentRepository.ts`
- Modify: `src/lib/services/DocumentService.ts:28-30`

**Context:** `findByUserId` has no runtime callers (dead code per grep). The actual unbounded admin query is `findByDocTypeForAdmin` called from `DocumentService.getDocumentsForAdmin()` → `documents.ts` action.

**Step 1: Define shared pagination types**

Create `src/lib/domain/models/Pagination.ts`:

```typescript
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}
```

**Step 2: Add pagination to findByDocTypeForAdmin**

In `src/lib/repositories/DocumentRepository.ts`, update the method (lines 147-167):

Before:

```typescript
async findByDocTypeForAdmin(docType: string, courseIds?: string[]): Promise<DocumentEntity[]> {
  if (courseIds !== undefined && courseIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  let query = supabase
    .from('documents')
    .select('*')
    .eq('doc_type', docType as 'lecture' | 'exam' | 'assignment')
    .order('created_at', { ascending: false });

  if (courseIds && courseIds.length > 0) {
    query = query.in('course_id', courseIds);
  }

  const { data, error } = await query;
  if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
  return (data ?? []).map((row) => this.mapToEntity(row));
}
```

After:

```typescript
async findByDocTypeForAdmin(
  docType: string,
  courseIds?: string[],
  pagination?: PaginationOptions,
): Promise<PaginatedResult<DocumentEntity>> {
  if (courseIds !== undefined && courseIds.length === 0) {
    return { data: [], total: 0 };
  }

  const { limit = 50, offset = 0 } = pagination ?? {};
  const supabase = await createClient();
  let query = supabase
    .from('documents')
    .select('id, user_id, name, status, status_message, metadata, doc_type, course_id, created_at', { count: 'exact' })
    .eq('doc_type', docType as 'lecture' | 'exam' | 'assignment')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (courseIds && courseIds.length > 0) {
    query = query.in('course_id', courseIds);
  }

  const { data, error, count } = await query;
  if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
  return {
    data: (data ?? []).map((row) => this.mapToEntity(row as DocumentRow)),
    total: count ?? 0,
  };
}
```

Add the import at the top:

```typescript
import type { PaginatedResult, PaginationOptions } from '@/lib/domain/models/Pagination';
```

**Step 3: Update interface**

In `src/lib/domain/interfaces/IDocumentRepository.ts`, update:

```typescript
findByDocTypeForAdmin(
  docType: string,
  courseIds?: string[],
  pagination?: PaginationOptions,
): Promise<PaginatedResult<DocumentEntity>>;
```

**Step 4: Update DocumentService.getDocumentsForAdmin**

In `src/lib/services/DocumentService.ts` (lines 28-30):

Before:

```typescript
async getDocumentsForAdmin(docType: string, courseIds?: string[]): Promise<DocumentEntity[]> {
  return this.docRepo.findByDocTypeForAdmin(docType, courseIds);
}
```

After:

```typescript
async getDocumentsForAdmin(
  docType: string,
  courseIds?: string[],
  pagination?: PaginationOptions,
): Promise<PaginatedResult<DocumentEntity>> {
  return this.docRepo.findByDocTypeForAdmin(docType, courseIds, pagination);
}
```

**Step 5: Update the action caller**

In `src/app/actions/documents.ts` (around line 101), the caller currently does:

```typescript
const entities = await service.getDocumentsForAdmin('lecture', courseIds);
```

Update to destructure:

```typescript
const { data: entities } = await service.getDocumentsForAdmin('lecture', courseIds);
```

**Step 6: Update test mocks**

Search for test files that mock `findByDocTypeForAdmin` or `getDocumentsForAdmin`:

```bash
grep -rn "findByDocTypeForAdmin\|getDocumentsForAdmin" src/ --include="*.test.*"
```

Update mock return values from arrays to `{ data: [...], total: N }`.

**Step 7: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 8: Commit**

```bash
git add src/lib/domain/models/Pagination.ts src/lib/repositories/DocumentRepository.ts src/lib/domain/interfaces/IDocumentRepository.ts src/lib/services/DocumentService.ts src/app/actions/documents.ts
git commit -m "feat(db): add pagination to DocumentRepository.findByDocTypeForAdmin

Prevents unbounded admin queries as document count grows.
Default limit: 50 rows. Narrows SELECT columns to exclude content.
Updates service layer and action callers."
```

---

### Task 7: Add Pagination to ExamPaperRepository

**Files:**

- Modify: `src/lib/repositories/ExamPaperRepository.ts:102-132,167-181,308-320`
- Modify: `src/lib/domain/interfaces/IExamPaperRepository.ts`
- Modify: `src/lib/services/ExamPaperService.ts:164-166`
- Modify: `src/app/actions/exam-papers.ts:71-76`
- Modify: `src/app/actions/documents.ts:117-127`
- Modify test files: `ExamPaperService.test.ts`, `ExamPaperRepository.test.ts`, `exam-papers.test.ts`, `documents.test.ts`, `MockExamService.test.ts`

**Context — Full call chain that must be updated:**

1. `ExamPaperRepository.findWithFilters()` → `ExamPaperService.getPapers()` → `exam-papers.ts:getExamPaperList()`
2. `ExamPaperRepository.findAllForAdmin()` → `documents.ts:fetchDocuments()` (bypasses service layer — calls repo directly)
3. `ExamPaperRepository.findByCourseIds()` → `documents.ts:fetchDocuments()` (also bypasses service layer)
4. 5+ test files mock these methods and assert on return types

**Step 1: Update findWithFilters to return paginated result**

In `src/lib/repositories/ExamPaperRepository.ts` (lines 102-132):

```typescript
async findWithFilters(
  filters?: PaperFilters,
  pagination?: PaginationOptions,
): Promise<PaginatedResult<ExamPaper>> {
  const { limit = 50, offset = 0 } = pagination ?? {};
  const supabase = await createClient();

  let query = supabase
    .from('exam_papers')
    .select('*, exam_questions(count)', { count: 'exact' })
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.school) query = query.eq('school', filters.school);
  if (filters?.course) query = query.eq('course', filters.course);
  if (filters?.year) query = query.eq('year', filters.year);

  const { data, error, count } = await query;
  if (error) throw new DatabaseError(`Failed to fetch papers: ${error.message}`, error);

  return {
    data: (data ?? []).map((row: Record<string, unknown>) => {
      const countArr = row.exam_questions as Array<{ count: number }> | undefined;
      const questionCount = countArr?.[0]?.count ?? 0;
      return mapPaperRow(row, questionCount);
    }),
    total: count ?? 0,
  };
}
```

**Step 2: Update findByCourseIds and findAllForAdmin**

Same pattern: add optional `pagination` param, use `.range()`, return `PaginatedResult<ExamPaper>`.

**Step 3: Update ExamPaperService.getPapers**

In `src/lib/services/ExamPaperService.ts` (lines 164-166):

Before:

```typescript
async getPapers(filters?: PaperFilters): Promise<ExamPaper[]> {
  return this.repo.findWithFilters(filters);
}
```

After:

```typescript
async getPapers(filters?: PaperFilters): Promise<PaginatedResult<ExamPaper>> {
  return this.repo.findWithFilters(filters);
}
```

**Step 4: Update action callers**

In `src/app/actions/exam-papers.ts` (line 76):

```typescript
// Before
return service.getPapers(filters);
// After
const { data } = await service.getPapers(filters);
return data;
```

In `src/app/actions/documents.ts` (lines 122, 126):

```typescript
// Before
papers = await examRepo.findAllForAdmin();
papers = await examRepo.findByCourseIds(courseIds);
// After
const result = await examRepo.findAllForAdmin();
papers = result.data;
// and
const result = await examRepo.findByCourseIds(courseIds);
papers = result.data;
```

**Step 5: Update interface**

In `src/lib/domain/interfaces/IExamPaperRepository.ts`, update all three method signatures to return `PaginatedResult<ExamPaper>`.

**Step 6: Update ALL test mocks**

Files that need mock updates:

- `src/lib/services/ExamPaperService.test.ts` — `repo.findWithFilters.mockResolvedValue()` must return `{ data: [...], total: N }`
- `src/lib/repositories/ExamPaperRepository.test.ts` — assertion expectations
- `src/app/actions/exam-papers.test.ts` — `mockExamPaperService.getPapers.mockResolvedValue()`
- `src/app/actions/documents.test.ts` — `findAllForAdmin.mockResolvedValue()`, `findByCourseIds.mockResolvedValue()`
- `src/lib/services/MockExamService.test.ts` — if it mocks findWithFilters

**Step 7: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 8: Commit**

```bash
git add src/lib/repositories/ExamPaperRepository.ts src/lib/domain/interfaces/IExamPaperRepository.ts src/lib/services/ExamPaperService.ts src/app/actions/exam-papers.ts src/app/actions/documents.ts src/lib/services/ExamPaperService.test.ts src/lib/repositories/ExamPaperRepository.test.ts src/app/actions/exam-papers.test.ts src/app/actions/documents.test.ts src/lib/services/MockExamService.test.ts
git commit -m "feat(db): add pagination to ExamPaperRepository queries

Prevents unbounded result sets for findWithFilters, findByCourseIds,
and findAllForAdmin. Default limit: 50 rows.
Updates full call chain: repo → service → action → tests."
```

---

### Task 8: Narrow SELECT Columns in SessionRepository

**Files:**

- Modify: `src/lib/repositories/SessionRepository.ts:68-79`

**Step 1: Define a narrow type for list queries**

In `SessionRepository.ts`, add a type for list queries that omits `share_expires_at`:

```typescript
type SessionListRow = Omit<SessionRow, 'share_expires_at'>;
```

**Step 2: Replace select('\*') with explicit columns in findAllByUserId**

In `src/lib/repositories/SessionRepository.ts`, the `.select('*')` is on **line 72** (not 71). Replace:

Before:

```typescript
const { data, error } = await supabase
  .from('chat_sessions')
  .select('*')
  .eq('user_id', userId)
  .order('is_pinned', { ascending: false })
  .order('updated_at', { ascending: false });
```

After:

```typescript
const { data, error } = await supabase
  .from('chat_sessions')
  .select('id, user_id, course_id, mode, title, is_pinned, is_shared, created_at, updated_at')
  .eq('user_id', userId)
  .order('is_pinned', { ascending: false })
  .order('updated_at', { ascending: false });
```

**Step 3: Update the mapping call**

The `mapToEntity` currently casts `data as SessionRow` which expects `share_expires_at`. Since we omitted it, update the mapping to handle the missing field:

```typescript
return (data ?? []).map((row) =>
  this.mapToEntity({ ...row, share_expires_at: null } as SessionRow),
);
```

**Step 4: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

**Step 5: Commit**

```bash
git add src/lib/repositories/SessionRepository.ts
git commit -m "refactor(db): narrow SELECT columns in SessionRepository.findAllByUserId

Explicit column list instead of select('*') reduces data transfer.
Omits share_expires_at from list queries (not needed for sidebar)."
```

---

### Task 9: Wave 2 Verification

**Step 1: Run full lint + type check + test suite**

Run:

```bash
npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: All pass with no errors.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit any fixups if needed**

---

## Wave 3: Caching + Observability

### Task 10: Add Redis Cache Utility

**Files:**

- Create: `src/lib/cache.ts`

**Important:** Reuse the existing Redis singleton from `src/lib/redis.ts` — do NOT create a duplicate Redis client. The existing `getRedis()` is not exported, but the lazy `redis` proxy at line 39 is. However, since `redis` is a proxy that throws on missing credentials, import `getRedis` directly by exporting it.

**Step 1: Export getRedis from redis.ts**

In `src/lib/redis.ts`, the `getRedis()` function (line 23) is currently private. Add an export:

Before:

```typescript
function getRedis(): Redis {
```

After:

```typescript
export function getRedis(): Redis {
```

**Step 2: Create the cache-aside helper**

Create `src/lib/cache.ts`:

```typescript
/**
 * Redis cache-aside helper.
 *
 * Reuses the existing Upstash Redis singleton from redis.ts.
 * Call `cachedGet` to read-through cache; call `invalidateCache` on writes.
 */
import { getRedis } from '@/lib/redis';

/**
 * Read-through cache. Returns cached value if available, otherwise calls fetcher
 * and stores the result with the given TTL.
 *
 * Note: Upstash SDK auto-serializes/deserializes JSON — we use get<T>/set directly
 * without manual JSON.stringify/parse.
 */
export async function cachedGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  let hit = false;
  try {
    const redis = getRedis();
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      hit = true;
      return cached;
    }
  } catch (err) {
    console.warn('[cache] Redis read failed, falling through to fetcher:', (err as Error).message);
  }

  const data = await fetcher();

  try {
    const redis = getRedis();
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (err) {
    console.warn('[cache] Redis write failed, data served from DB:', (err as Error).message);
  }

  if (!hit) {
    console.debug(`[cache] MISS ${key}`);
  }

  return data;
}

/**
 * Delete one or more cache keys. Call this in service write methods.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    const redis = getRedis();
    if (keys.length > 0) {
      await redis.del(...keys);
      console.debug(`[cache] INVALIDATED ${keys.join(', ')}`);
    }
  } catch (err) {
    console.warn('[cache] Redis invalidation failed:', (err as Error).message);
  }
}

/** Cache key constants */
export const CACHE_KEYS = {
  coursesList: 'cache:courses:list',
  universitiesList: 'cache:universities:list',
  profile: (userId: string) => `cache:profile:${userId}`,
} as const;

/** TTL constants (seconds) */
export const CACHE_TTL = {
  courses: 10 * 60, // 10 minutes
  universities: 30 * 60, // 30 minutes
  profile: 5 * 60, // 5 minutes
} as const;
```

**Key differences from original plan:**

- Reuses `getRedis()` from `redis.ts` — no duplicate Redis client
- Uses Upstash's native `get<T>` / `set(key, data)` — no manual JSON.stringify/parse (Upstash SDK handles it)
- Logs cache hits/misses/errors with `console.warn`/`console.debug` for observability
- Errors are logged, not silently swallowed

**Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/redis.ts src/lib/cache.ts
git commit -m "feat(config): add Redis cache-aside utility

Reuses existing Redis singleton from redis.ts.
Leverages Upstash native JSON serialization.
Logs cache hits/misses/errors for observability."
```

---

### Task 11: Wire Redis Cache into CourseService (Service Layer)

**Files:**

- Modify: `src/lib/services/CourseService.ts:20-22,36-38`

**Context:** Per project architecture (Action → Service → Repository), caching belongs in the **Service layer**, not in Actions. Actions are thin wrappers for auth/validation/delegation only (see `.claude/rules/server-actions.md`).

Also: `fetchCourses(universityId?)` accepts an optional universityId parameter. The cache key must account for this to avoid returning unfiltered data for a filtered request.

**Step 1: Add caching to CourseService.getAllUniversities**

In `src/lib/services/CourseService.ts`:

Before:

```typescript
async getAllUniversities(): Promise<UniversityEntity[]> {
  return this.uniRepo.findAll();
}
```

After:

```typescript
async getAllUniversities(): Promise<UniversityEntity[]> {
  return cachedGet(CACHE_KEYS.universitiesList, CACHE_TTL.universities, () =>
    this.uniRepo.findAll(),
  );
}
```

**Step 2: Add caching to CourseService.getAllCourses**

Before:

```typescript
async getAllCourses(): Promise<CourseEntity[]> {
  return this.courseRepo.findAll();
}
```

After:

```typescript
async getAllCourses(): Promise<CourseEntity[]> {
  return cachedGet(CACHE_KEYS.coursesList, CACHE_TTL.courses, () =>
    this.courseRepo.findAll(),
  );
}
```

Note: `getCoursesByUniversity(universityId)` is NOT cached — the client-side already filters `allCourses` by university via `useCourseData.ts:30-33`, so the filtered query is rarely called directly. If needed later, add a per-university cache key.

**Step 3: Add cache invalidation to write methods**

In `CourseService`, update mutation methods:

```typescript
async createUniversity(dto: CreateUniversityDTO): Promise<UniversityEntity> {
  const result = await this.uniRepo.create(dto);
  await invalidateCache(CACHE_KEYS.universitiesList);
  return result;
}

async updateUniversity(id: string, dto: UpdateUniversityDTO): Promise<UniversityEntity> {
  const result = await this.uniRepo.update(id, dto);
  await invalidateCache(CACHE_KEYS.universitiesList);
  return result;
}

async deleteUniversity(id: string): Promise<void> {
  await this.uniRepo.delete(id);
  await invalidateCache(CACHE_KEYS.universitiesList);
}

async createCourse(dto: CreateCourseDTO): Promise<CourseEntity> {
  const result = await this.courseRepo.create(dto);
  await invalidateCache(CACHE_KEYS.coursesList);
  return result;
}

async updateCourse(id: string, dto: UpdateCourseDTO): Promise<CourseEntity> {
  const result = await this.courseRepo.update(id, dto);
  await invalidateCache(CACHE_KEYS.coursesList);
  return result;
}

async deleteCourse(id: string): Promise<void> {
  await this.courseRepo.delete(id);
  await invalidateCache(CACHE_KEYS.coursesList);
}
```

Add imports at the top:

```typescript
import { CACHE_KEYS, CACHE_TTL, cachedGet, invalidateCache } from '@/lib/cache';
```

**Step 4: Run tests**

Run:

```bash
npx vitest run
```

Note: CourseService tests may need updating if they assert exact call counts on repo methods (cache hits won't call repo).

**Step 5: Commit**

```bash
git add src/lib/services/CourseService.ts
git commit -m "feat(api): add Redis caching to CourseService

Course list cached 10min, university list cached 30min.
Cache invalidated on create/update/delete operations.
Caching at Service layer per project architecture rules."
```

---

### Task 12: Add Cache Headers to API Routes

**Files:**

- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/quota/route.ts`

**Step 1: Add Cache-Control to health route**

Health endpoint must NOT be publicly cached — a cached "healthy" response masks real-time degradation. Use `no-cache` which allows conditional requests but always revalidates:

In `src/app/api/health/route.ts`, update the return:

Before:

```typescript
return Response.json({ status }, { status: supabaseOk ? 200 : 503 });
```

After:

```typescript
return Response.json(
  { status },
  {
    status: supabaseOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
);
```

**Step 2: Add Cache-Control to quota route**

In `src/app/api/quota/route.ts`, update the success return:

Before:

```typescript
return NextResponse.json({ status, limits });
```

After:

```typescript
return NextResponse.json(
  { status, limits },
  {
    headers: {
      'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
    },
  },
);
```

**Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/health/route.ts src/app/api/quota/route.ts
git commit -m "feat(api): add Cache-Control headers to health and quota routes

Health: no-cache (always revalidate to reflect real-time status).
Quota: private, 30s with stale-while-revalidate."
```

---

### Task 13: Add Server-Timing Header to Middleware

**Files:**

- Modify: `src/lib/supabase/middleware.ts:10-67`

**Step 1: Add timing instrumentation to handleRequest**

In `src/lib/supabase/middleware.ts`, add a total timer at the start of `handleRequest` and an auth timer around `getUser()`:

At the start of the function (after line 12):

```typescript
const totalStart = performance.now();
```

Around the `getUser()` call (lines 45-48):

Before:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
const userId = user?.id ?? null;
```

After:

```typescript
const authStart = performance.now();
const {
  data: { user },
} = await supabase.auth.getUser();
const authMs = performance.now() - authStart;
const userId = user?.id ?? null;
```

**Step 2: Set header on the CORRECT response object for each return path**

There are two return paths:

**Redirect path (line 62-63):** Creates a NEW `NextResponse.redirect(url)`. The header must be set on the redirect response, not the original `response`:

Before:

```typescript
return { response: NextResponse.redirect(url), userId };
```

After:

```typescript
const totalMs = performance.now() - totalStart;
const redirectResponse = NextResponse.redirect(url);
redirectResponse.headers.set(
  'Server-Timing',
  `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
);
return { response: redirectResponse, userId };
```

**Normal path (line 66):** Set header on the existing `response`:

Before:

```typescript
return { response, userId };
```

After:

```typescript
const totalMs = performance.now() - totalStart;
response.headers.set(
  'Server-Timing',
  `auth;dur=${authMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`,
);
return { response, userId };
```

**Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(config): add Server-Timing header for auth and total duration

Tracks auth check and total middleware time per request.
Sets header on correct response object for both normal and redirect paths.
Visible in browser DevTools Network → Timing tab."
```

---

### Task 14: Add TanStack Query Prefetch to Study Page

**Files:**

- Modify: `src/app/(protected)/study/page.tsx`

**Step 1: Update study page to prefetch course data**

The current `study/page.tsx` is a minimal server component:

```typescript
import React from 'react';
import { StudyPageClient } from './StudyPageClient';

export default async function StudyPage() {
  return <StudyPageClient />;
}
```

Update to prefetch courses using TanStack Query hydration. **Wrap in try/catch** to gracefully degrade if auth expires or DB is unavailable:

```typescript
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import React from 'react';
import { fetchCourses, fetchUniversities } from '@/app/actions/courses';
import { queryKeys } from '@/lib/query-keys';
import { StudyPageClient } from './StudyPageClient';

export default async function StudyPage() {
  const queryClient = new QueryClient();

  try {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.universities.all,
        queryFn: async () => {
          const result = await fetchUniversities();
          if (!result.success) throw new Error(result.error);
          return result.data;
        },
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.courses.all,
        queryFn: async () => {
          const result = await fetchCourses();
          if (!result.success) throw new Error(result.error);
          return result.data;
        },
      }),
    ]);
  } catch {
    // Prefetch failed — client will fetch on mount (graceful degradation)
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StudyPageClient />
    </HydrationBoundary>
  );
}
```

**Note:** Prefetch for `/exam` and `/admin/knowledge` pages is deferred to a future iteration — those pages have more complex data dependencies.

**Step 2: Run type check and build**

Run:

```bash
npx tsc --noEmit && npm run build
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/(protected)/study/page.tsx
git commit -m "feat(ui): prefetch course data on study page via server component

Uses TanStack Query HydrationBoundary to pass server-fetched data
to the client. Eliminates loading spinner for course/university lists.
Gracefully degrades if prefetch fails."
```

---

### Task 15: Wave 3 Verification & Final Check

**Step 1: Run full test suite**

Run:

```bash
npm run lint && npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 2: Run build**

Run:

```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Run final bundle analysis**

Run:

```bash
npm run analyze
```

Compare with the baseline from Task 1. Document the improvement.

**Step 4: Create summary commit if needed**

If there are any remaining fixups, commit them.

---

## Deferred Items

The following items from the design doc are explicitly deferred to a future iteration:

- **Prefetch for `/exam` and `/admin/knowledge`** — more complex data dependencies, defer until study page prefetch is validated
- **Markdown renderer next/image** — Mantine `Image` used for markdown; switching to `next/image` requires `remotePatterns` config for unknown external hosts, risk of broken images
- **react-markdown `optimizePackageImports`** — evaluate after bundle analyzer baseline shows actual impact
- **Upstash free tier monitoring** — 10,000 commands/day limit; cache adds ~2 commands per read (check + set on miss). Monitor usage via Upstash dashboard; alert setup is out of scope

---

## Verification Checklist

After all 3 waves:

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` succeeds
- [ ] Bundle analyzer shows reduction (target: 10-20%)
- [ ] No `@tabler/icons-react` imports remain
- [ ] No `stroke=` props on lucide icons (use `strokeWidth=`)
- [ ] DocumentRepository.findByDocTypeForAdmin uses pagination
- [ ] ExamPaperRepository uses pagination (all 3 list methods + all test mocks updated)
- [ ] Server-Timing header visible in browser DevTools (auth + total metrics)
- [ ] Cache-Control headers set on health (no-cache) and quota routes
- [ ] TanStack Query staleTime increased for stable data
- [ ] Study page prefetches course data on server (with try/catch)
- [ ] Redis cache uses existing singleton from redis.ts
- [ ] Cache is at Service layer, not Action layer
- [ ] Cache logs hit/miss/error for observability
