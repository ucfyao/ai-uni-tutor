# Performance Audit & Optimization — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Scope:** Full-stack performance optimization (frontend + backend + infrastructure)

## Context

AI UniTutor's core features are complete. Before scaling to more users, we need a systematic performance audit and optimization pass covering bundle size, data fetching, database queries, caching, and observability.

## Audit Findings

### Critical Issues

1. **Dual icon libraries** — Both `lucide-react` (~563 icons) and `@tabler/icons-react` (~3000+ icons) are in the bundle. Estimated 100-200KB wasted.
2. **Unbounded database queries** — `DocumentRepository.findByUserId()` and `ExamPaperRepository` load all rows without pagination.

### High Priority

3. **Aggressive TanStack Query staleTime** — Global default of 30s causes frequent refetches for stable data (courses, universities).
4. **Chat base64 images** — User-uploaded images rendered as inline base64 data URLs, impacting render performance and memory.
5. **No bundle analyzer** — Cannot measure or track bundle size over time.

### Medium Priority

6. **Markdown images use Mantine Image** — Missing next/image optimization (WebP, srcset).
7. **Multiple repositories use `select('*')`** — Pulls unnecessary columns including large embedding vectors (~6KB/row for 768-dim vectors).
8. **No Redis application cache** — Redis only used for rate limiting, not data caching.
9. **No TanStack Query prefetch** — Users wait for data after page load.
10. **No API cache headers** — All API responses treated as uncacheable.

### Already Good

- SSR auth optimized (single `getUser()` call per request)
- Server/client component separation is clean
- Local font with `display: 'swap'` (no FOUT)
- Dynamic imports for heavy modules (pdf-parse, LLM parsers)
- `optimizePackageImports` configured for Mantine + Lucide
- Comprehensive CSP security headers

## Design

### Wave 1: Bundle Slimming

#### 1.1 Unify Icon Library

- Replace all `@tabler/icons-react` imports with `lucide-react` equivalents
- Remove `@tabler/icons-react` from dependencies
- Keep existing `optimizePackageImports: ['lucide-react']`

Mapping:
- `IconCheck` → `Check` (from lucide-react)
- Audit all tabler icon usages, find lucide equivalents

#### 1.2 Bundle Analyzer

- Install `@next/bundle-analyzer` as devDependency
- Add conditional wrapper in `next.config.ts`:
  ```ts
  const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
  ```
- Add `"analyze": "ANALYZE=true next build"` script to package.json
- Run before and after optimization to quantify impact

#### 1.3 Extend optimizePackageImports

- After tabler removal, no further icon library config needed
- Evaluate adding `react-markdown` and related rehype/remark plugins

### Wave 2: Frontend Loading + Database

#### 2.1 TanStack Query Cache Strategy

Global defaults (Providers.tsx):
- `staleTime`: 30s → 60s

Per-query overrides:
| Query | staleTime | Rationale |
|-------|-----------|-----------|
| Universities | 10min | Rarely changes |
| Courses | 10min | Rarely changes |
| User profile | 5min | Low-frequency updates |
| Sessions list | 30s | Changes on user action |
| Messages | 0 (default) | Real-time data |

#### 2.2 Chat Image Optimization

- **Preview stage:** Use `URL.createObjectURL()` instead of base64 FileReader
- **Send to API:** Keep base64 for Gemini API compatibility
- **Message history:** Add `loading="lazy"` to image elements in MessageBubble
- Memory management: Revoke object URLs on component unmount

#### 2.3 Next.js Image in Markdown

- In `MarkdownRenderer`, replace Mantine `Image` with `next/image` for external URLs
- Keep Mantine Image for base64/data URLs (next/image doesn't support them)
- Add `remotePatterns` to next.config.ts for common image hosts

#### 2.4 Repository Pagination

Add `limit` + `offset` parameters to list queries:

```typescript
// Before
async findByUserId(userId: string) {
  return supabase.from('documents').select('*').eq('user_id', userId)
}

// After
async findByUserId(userId: string, options?: { limit?: number; offset?: number }) {
  const { limit = 50, offset = 0 } = options ?? {}
  return supabase
    .from('documents')
    .select('id, title, type, course_id, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false })
}
```

Priority repositories:
1. `DocumentRepository.findByUserId()` — user documents grow unbounded
2. `ExamPaperRepository` — exam papers accumulate over time
3. `SessionRepository` — chat sessions per user

#### 2.5 Select Column Narrowing

Audit and narrow `select('*')` in:
- `SessionRepository` — exclude `metadata` column for list queries
- `DocumentRepository` — exclude content/embedding for list queries
- `KnowledgeCardRepository` — exclude `embedding` (768-dim vector, ~6KB/row)

### Wave 3: Caching + Observability

#### 3.1 Redis Application Cache

Cache-aside pattern using existing Upstash Redis:

```typescript
async function cachedGet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached as string)
  const data = await fetcher()
  await redis.set(key, JSON.stringify(data), { ex: ttlSeconds })
  return data
}
```

Cache targets:
| Data | Key pattern | TTL | Invalidation |
|------|-------------|-----|-------------|
| Course list | `cache:courses:list` | 10min | On course create/update/delete |
| University list | `cache:universities:list` | 30min | On university create/update/delete |
| User profile | `cache:profile:{userId}` | 5min | On profile update |

Invalidation: Call `redis.del(key)` in the corresponding service write methods.

#### 3.2 API Cache Headers

| Route | Cache-Control |
|-------|--------------|
| `/api/health` | `public, max-age=60` |
| `/api/quota` | `private, max-age=30, stale-while-revalidate=60` |
| `/api/chat/stream` | `no-store` (streaming, not cacheable) |
| `/api/documents/parse` | `no-store` (POST, not cacheable) |

#### 3.3 Server-Timing Header

Add performance instrumentation in middleware:

```typescript
const start = performance.now()
// ... auth check
const authMs = performance.now() - start
response.headers.set('Server-Timing', `auth;dur=${authMs.toFixed(1)}`)
```

Visible in browser DevTools Network tab → Timing section.

#### 3.4 Prefetch Strategy

In server components, prefetch critical data into TanStack Query cache:

```typescript
// study/page.tsx (server component)
const queryClient = new QueryClient()
await queryClient.prefetchQuery({
  queryKey: ['courses'],
  queryFn: () => getCourses(),
})
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <StudyPageClient />
  </HydrationBoundary>
)
```

Apply to:
- `/study` — prefetch courses
- `/exam` — prefetch exam papers
- `/admin/knowledge` — prefetch knowledge cards list

## Execution Plan

| Wave | Content | Verify |
|------|---------|--------|
| 1 | Bundle Analyzer + Icon unification + optimizePackageImports | `npm run build` passes, bundle size measured |
| 2 | TanStack Query cache + Image optimization + Pagination + Select narrowing | Lint + type-check + unit tests pass |
| 3 | Redis cache + Cache headers + Server-Timing + Prefetch | Full test suite + manual smoke test |

Each wave: commit → verify → PR review → next wave.

## Out of Scope

- Sentry / external error monitoring (separate initiative)
- CI/CD pipeline changes
- Database index optimization (requires production query analysis)
- Mobile PWA / service worker caching
- CDN configuration (Vercel handles this)

## Success Criteria

- Bundle size reduction measured and documented (target: 10-20% reduction)
- No unbounded database queries in any repository
- TanStack Query cache hits visible in React Query DevTools
- Server-Timing header visible in browser DevTools
- All existing tests continue to pass
