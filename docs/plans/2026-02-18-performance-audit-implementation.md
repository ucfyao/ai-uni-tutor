# Performance Audit & Optimization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize AI UniTutor's frontend bundle, data fetching, database queries, caching, and observability across 3 waves.

**Architecture:** Wave 1 slims the JS bundle (icon consolidation + analyzer). Wave 2 improves frontend caching and database query efficiency (pagination, column narrowing). Wave 3 adds Redis application cache, HTTP cache headers, Server-Timing instrumentation, and TanStack Query prefetching.

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

Note the output sizes (First Load JS per route). Save this as the baseline. The analyzer will open a browser tab with the treemap visualization.

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
- Modify: `src/app/(protected)/exam/ExamPaperUploadModal.tsx:3`
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
3. Update all JSX usages — Tabler icons use `size` prop, lucide-react also uses `size` prop, so the JSX props should be compatible

**Important:** Tabler icons render at `size={N}` (pixels). Lucide icons also accept `size={N}`. No prop changes needed.

**Example for MessageBubble.tsx:**

Before (line 1):

```typescript
import { IconCheck } from '@tabler/icons-react';
```

After — merge into the existing lucide import (line 2):

```typescript
import { Check, Copy, Quote, RefreshCw } from 'lucide-react';
```

Then replace all `<IconCheck` with `<Check` in the file. Note: this file already imports `Check` from lucide on line 2, so just remove the tabler import and replace `IconCheck` usages with `Check`.

**Step 2: Remove @tabler/icons-react from dependencies**

Run:

```bash
npm uninstall @tabler/icons-react
```

**Step 3: Verify no remaining tabler imports**

Run:

```bash
npx grep -r "@tabler/icons-react" src/
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
git add -A
git commit -m "refactor(ui): replace @tabler/icons-react with lucide-react

Consolidate to single icon library to reduce bundle size.
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

### Task 5: Add Lazy Loading to Chat Image Display

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx` (image rendering section)

**Step 1: Locate image rendering in MessageBubble.tsx**

Find the section where message images are rendered (around line 335-361). Look for the `<Image>` component rendering with base64 data URLs.

**Step 2: Add loading="lazy" to image elements**

For each `<Image>` rendering chat message images, add the `loading="lazy"` prop. Mantine's `Image` component passes through standard HTML attributes, so:

Before:

```tsx
<Image
  src={`data:${img.mimeType};base64,${img.data}`}
  alt="..."
  ...
/>
```

After:

```tsx
<Image
  src={`data:${img.mimeType};base64,${img.data}`}
  alt="..."
  loading="lazy"
  ...
/>
```

**Step 3: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(chat): add lazy loading to chat message images

Defers off-screen image decoding to improve scroll performance."
```

---

### Task 6: Add Pagination to DocumentRepository

**Files:**

- Modify: `src/lib/repositories/DocumentRepository.ts:35-50`
- Modify: `src/lib/domain/interfaces/IDocumentRepository.ts` (update interface signature)

**Step 1: Define pagination options type**

Add at the top of `src/lib/repositories/DocumentRepository.ts` (after existing imports):

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

**Step 2: Update findByUserId to support pagination**

Replace the `findByUserId` method (lines 35-50):

Before:

```typescript
async findByUserId(userId: string, docType?: string): Promise<DocumentEntity[]> {
  const supabase = await createClient();
  let query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (docType) {
    query = query.eq('doc_type', docType as 'lecture' | 'exam' | 'assignment');
  }

  const { data, error } = await query;
  if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
  return (data ?? []).map((row) => this.mapToEntity(row));
}
```

After:

```typescript
async findByUserId(
  userId: string,
  docType?: string,
  pagination?: PaginationOptions,
): Promise<PaginatedResult<DocumentEntity>> {
  const { limit = 50, offset = 0 } = pagination ?? {};
  const supabase = await createClient();
  let query = supabase
    .from('documents')
    .select('id, user_id, name, status, status_message, metadata, doc_type, course_id, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (docType) {
    query = query.eq('doc_type', docType as 'lecture' | 'exam' | 'assignment');
  }

  const { data, error, count } = await query;
  if (error) throw new DatabaseError(`Failed to fetch documents: ${error.message}`, error);
  return {
    data: (data ?? []).map((row) => this.mapToEntity(row as DocumentRow)),
    total: count ?? 0,
  };
}
```

**Step 3: Update the IDocumentRepository interface**

In `src/lib/domain/interfaces/IDocumentRepository.ts`, update the `findByUserId` signature to match:

```typescript
findByUserId(
  userId: string,
  docType?: string,
  pagination?: { limit?: number; offset?: number },
): Promise<{ data: DocumentEntity[]; total: number }>;
```

**Step 4: Update callers**

Search for all callers of `findByUserId` on DocumentRepository. They currently expect `DocumentEntity[]` — update them to destructure `{ data }` from the result. Common callers are in service files (`DocumentService` or similar).

Run:

```bash
grep -rn "findByUserId" src/lib/services/ src/app/actions/
```

For each caller, update from:

```typescript
const docs = await documentRepo.findByUserId(userId, docType);
```

To:

```typescript
const { data: docs } = await documentRepo.findByUserId(userId, docType);
```

**Step 5: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/lib/repositories/DocumentRepository.ts src/lib/domain/interfaces/IDocumentRepository.ts src/lib/services/ src/app/actions/
git commit -m "feat(db): add pagination to DocumentRepository.findByUserId

Prevents unbounded queries as user document count grows.
Default limit: 50 rows. Callers updated to destructure result."
```

---

### Task 7: Add Pagination to ExamPaperRepository

**Files:**

- Modify: `src/lib/repositories/ExamPaperRepository.ts:102-132,167-181,308-320`
- Modify: `src/lib/domain/interfaces/IExamPaperRepository.ts`

**Step 1: Add pagination to findWithFilters**

Update `findWithFilters` (lines 102-132) to accept pagination and use `.range()`:

```typescript
async findWithFilters(filters?: PaperFilters, pagination?: { limit?: number; offset?: number }): Promise<{ data: ExamPaper[]; total: number }> {
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

**Step 2: Add pagination to findByCourseIds (line 167)**

Same pattern: add `pagination` param, use `.range()`, return `{ data, total }`.

**Step 3: Add pagination to findAllForAdmin (line 308)**

Same pattern.

**Step 4: Update interface and callers**

Update `IExamPaperRepository` interface signatures. Search for callers in services/actions and destructure `{ data }`.

**Step 5: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

**Step 6: Commit**

```bash
git add src/lib/repositories/ExamPaperRepository.ts src/lib/domain/interfaces/IExamPaperRepository.ts src/lib/services/ src/app/actions/
git commit -m "feat(db): add pagination to ExamPaperRepository queries

Prevents unbounded result sets for findWithFilters, findByCourseIds,
and findAllForAdmin. Default limit: 50 rows."
```

---

### Task 8: Narrow SELECT Columns in SessionRepository

**Files:**

- Modify: `src/lib/repositories/SessionRepository.ts:68-79`

**Step 1: Replace select('\*') with explicit columns in findAllByUserId**

The SessionRow interface (lines 19-30) tells us exactly which columns exist. Replace `select('*')` on line 71:

Before:

```typescript
.select('*')
```

After:

```typescript
.select('id, user_id, course_id, mode, title, is_pinned, is_shared, created_at, updated_at')
```

This omits `share_expires_at` from list queries (not needed for sidebar display).

**Step 2: Run tests and type check**

Run:

```bash
npx tsc --noEmit && npx vitest run
```

**Step 3: Commit**

```bash
git add src/lib/repositories/SessionRepository.ts
git commit -m "refactor(db): narrow SELECT columns in SessionRepository.findAllByUserId

Explicit column list instead of select('*') reduces data transfer."
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

**Step 1: Create the cache-aside helper**

Create `src/lib/cache.ts`:

```typescript
/**
 * Redis cache-aside helper.
 *
 * Uses the existing Upstash Redis instance to cache frequently-read data.
 * Call `cachedGet` to read-through cache; call `invalidateCache` on writes.
 */
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Redis credentials not configured');
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

/**
 * Read-through cache. Returns cached value if available, otherwise calls fetcher
 * and stores the result with the given TTL.
 */
export async function cachedGet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get<string>(key);
    if (cached !== null && cached !== undefined) {
      return JSON.parse(cached as string) as T;
    }
  } catch {
    // Redis unavailable — fall through to fetcher
  }

  const data = await fetcher();

  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds });
  } catch {
    // Redis unavailable — data still returned from fetcher
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
    }
  } catch {
    // Redis unavailable — cache will expire naturally via TTL
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

**Step 2: Run type check**

Run:

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(config): add Redis cache-aside utility

Provides cachedGet/invalidateCache helpers with graceful Redis
fallback. Includes cache key constants and TTL configuration."
```

---

### Task 11: Wire Redis Cache into Course/University Queries

**Files:**

- Modify: `src/app/actions/courses.ts` (or wherever `fetchCourses`/`fetchUniversities` are defined)

**Step 1: Find the server actions for courses**

The `useCourseData.ts` hook calls `fetchCourses()` and `fetchUniversities()` from `@/app/actions/courses`. Read that file to understand the current implementation.

**Step 2: Wrap the fetcher with cachedGet**

For `fetchUniversities`:

```typescript
import { CACHE_KEYS, CACHE_TTL, cachedGet } from '@/lib/cache';

export async function fetchUniversities() {
  // ... existing auth check ...
  const data = await cachedGet(CACHE_KEYS.universitiesList, CACHE_TTL.universities, async () => {
    // existing Supabase query here
  });
  return { success: true, data };
}
```

Same pattern for `fetchCourses`.

**Step 3: Add cache invalidation to write actions**

In the same actions file (or the admin courses actions), add `invalidateCache` calls after create/update/delete operations:

```typescript
import { CACHE_KEYS, invalidateCache } from '@/lib/cache';

// After creating/updating/deleting a course:
await invalidateCache(CACHE_KEYS.coursesList);

// After creating/updating/deleting a university:
await invalidateCache(CACHE_KEYS.universitiesList);
```

**Step 4: Run tests**

Run:

```bash
npx vitest run
```

**Step 5: Commit**

```bash
git add src/app/actions/courses.ts src/lib/cache.ts
git commit -m "feat(api): add Redis caching for course and university queries

Course list cached 10min, university list cached 30min.
Cache invalidated on create/update/delete operations."
```

---

### Task 12: Add Cache Headers to API Routes

**Files:**

- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/quota/route.ts`

**Step 1: Add Cache-Control to health route**

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
      'Cache-Control': 'public, max-age=60',
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

Health: public, 60s. Quota: private, 30s with stale-while-revalidate."
```

---

### Task 13: Add Server-Timing Header to Middleware

**Files:**

- Modify: `src/lib/supabase/middleware.ts:10-67`

**Step 1: Add timing instrumentation to handleRequest**

In `src/lib/supabase/middleware.ts`, wrap the auth call with timing:

Update the `handleRequest` function. After the line that creates the response (line 13), add timing before the `getUser()` call (line 47):

Before (around lines 45-48):

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

Then, before each `return { response, userId }` statement, add the Server-Timing header:

```typescript
response.headers.set('Server-Timing', `auth;dur=${authMs.toFixed(1)}`);
return { response, userId };
```

There are two return points in this function (line 63 for redirect, line 66 for normal). Add the header before both.

**Step 2: Run type check**

Run:

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "feat(config): add Server-Timing header for auth duration

Visible in browser DevTools Network → Timing tab.
Enables monitoring of middleware auth overhead per request."
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

Update to prefetch courses using TanStack Query hydration:

```typescript
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import React from 'react';
import { fetchCourses, fetchUniversities } from '@/app/actions/courses';
import { queryKeys } from '@/lib/query-keys';
import { StudyPageClient } from './StudyPageClient';

export default async function StudyPage() {
  const queryClient = new QueryClient();

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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StudyPageClient />
    </HydrationBoundary>
  );
}
```

This makes course/university data available instantly on the client without a loading spinner.

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
to the client. Eliminates loading spinner for course/university lists."
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

## Verification Checklist

After all 3 waves:

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npx vitest run` passes
- [ ] `npm run build` succeeds
- [ ] Bundle analyzer shows reduction (target: 10-20%)
- [ ] No `@tabler/icons-react` imports remain
- [ ] DocumentRepository and ExamPaperRepository use pagination
- [ ] Server-Timing header visible in browser DevTools
- [ ] Cache-Control headers set on health and quota routes
- [ ] TanStack Query staleTime increased for stable data
- [ ] Study page prefetches course data on server
