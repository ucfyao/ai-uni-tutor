# Code Review Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues identified in the 3-reviewer code audit (security, architecture, performance) and add i18n for authenticated app pages.

**Architecture:** Wave-based serial-parallel workflow. 4 waves, each with 1-2 parallel worktrees. PRs merge to main between waves. Agent Team coordinates teammates within each wave.

**Tech Stack:** Next.js 16 (App Router, React 19), Mantine v8, Tailwind CSS v4, Supabase, TanStack Query, Vitest

---

## Wave 1A: Security Hardening

**Branch:** `fix/security-hardening`
**Worktree:** `../ai-uni-tutor-fix-security`
**Model:** Opus

---

### Task 1: Fix PostgREST filter injection in ExamPaperRepository

**Files:**

- Modify: `src/lib/repositories/ExamPaperRepository.ts:273-286`
- Test: `src/lib/repositories/ExamPaperRepository.test.ts`

**Step 1: Write the failing test**

```typescript
describe('findByCourse', () => {
  it('should sanitize courseCode to prevent filter injection', async () => {
    const maliciousCode = 'CS101,id.eq.some-uuid';
    const result = await repo.findByCourse(maliciousCode);
    // Should not throw or match unintended rows
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/repositories/ExamPaperRepository.test.ts`

**Step 3: Fix the filter injection**

Replace the `.or()` string interpolation at line 279 with Supabase's `.ilike()` method:

```typescript
async findByCourse(courseCode: string): Promise<string | null> {
  const supabase = await createClient();

  // Sanitize: allow only alphanumeric, spaces, hyphens, underscores
  const sanitized = courseCode.replace(/[^A-Za-z0-9 _-]/g, '');
  if (!sanitized) return null;

  const { data, error } = await supabase
    .from('exam_papers')
    .select('id')
    .ilike('course', `%${sanitized}%`)
    .eq('status', 'ready')
    .limit(1);

  if (error) throw new DatabaseError(`Failed to find exam papers: ${error.message}`, error);
  if (!data || data.length === 0) return null;
  return data[0].id as string;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/repositories/ExamPaperRepository.test.ts`

**Step 5: Commit**

```bash
git add src/lib/repositories/ExamPaperRepository.ts src/lib/repositories/ExamPaperRepository.test.ts
git commit -m "fix(security): sanitize courseCode to prevent PostgREST filter injection"
```

---

### Task 2: Tighten CSP policy in next.config.ts

**Files:**

- Modify: `next.config.ts:28-40`

**Step 1: Update CSP headers**

Replace the CSP value block at lines 28-40. Remove `'unsafe-eval'` from `script-src`. Keep `'unsafe-inline'` only for `style-src` (Mantine requires it). Add `'strict-dynamic'` if nonce-based CSP is not feasible with current Next.js setup.

```typescript
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
```

Note: `'unsafe-inline'` stays for `script-src` because Next.js injects inline scripts for hydration. `'unsafe-eval'` is removed -- if KaTeX or any lib needs eval, it will surface as a CSP violation in browser console during testing.

**Step 2: Run build + dev to verify nothing breaks**

Run: `npm run build`

Then manually test in browser that chat, KaTeX rendering, and Stripe checkout still work. If KaTeX breaks, add a specific hash or restore `'unsafe-eval'` with a comment explaining why.

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix(security): remove unsafe-eval from CSP script-src"
```

---

### Task 3: Validate x-forwarded-host in auth callback

**Files:**

- Modify: `src/app/(public)/auth/callback/route.ts:29-36`

**Step 1: Add host validation**

Replace lines 29-36 with domain whitelist validation:

```typescript
if (!error) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  } else if (forwardedHost) {
    // Validate forwarded host against known domains
    const allowedHosts = [
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, ''),
      'ai-uni-tutor.vercel.app',
    ].filter(Boolean);

    if (allowedHosts.some((h) => forwardedHost === h)) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }
    // Fall through to origin if host not recognized
    return NextResponse.redirect(`${origin}${next}`);
  } else {
    return NextResponse.redirect(`${origin}${next}`);
  }
}
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/(public)/auth/callback/route.ts
git commit -m "fix(auth): validate x-forwarded-host against domain whitelist"
```

---

### Task 4: Restrict health endpoint detail

**Files:**

- Modify: `src/app/api/health/route.ts:13-27`
- Test: `src/app/api/health/route.test.ts`

**Step 1: Simplify response for public callers**

```typescript
export async function GET() {
  const checks = await Promise.allSettled([checkSupabase()]);
  const supabaseOk = checks[0].status === 'fulfilled' && checks[0].value;
  const status = supabaseOk ? 'healthy' : 'degraded';

  return Response.json({ status }, { status: supabaseOk ? 200 : 503 });
}
```

**Step 2: Update tests**

Update any test assertions that check for `checks` or `timestamp` fields in the response.

**Step 3: Run tests**

Run: `npx vitest run src/app/api/health`

**Step 4: Commit**

```bash
git add src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "fix(api): reduce health endpoint information disclosure"
```

---

### Task 5: Add Zod validation to updateDocumentMeta

**Files:**

- Modify: `src/app/actions/documents.ts:334-361`
- Test: `src/app/actions/documents.test.ts`

**Step 1: Add Zod schema and validate**

Add schema near top of file with other schemas, then use it in the function:

```typescript
const updateDocumentMetaSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  school: z.string().max(255).optional(),
  course: z.string().max(255).optional(),
});

export async function updateDocumentMeta(
  documentId: string,
  updates: { name?: string; school?: string; course?: string },
): Promise<{ status: 'success' | 'error'; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Unauthorized' };

  const parsed = updateDocumentMetaSchema.safeParse(updates);
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid input' };
  }
  const validatedUpdates = parsed.data;

  // ... rest of function uses validatedUpdates instead of updates
```

**Step 2: Run tests**

Run: `npx vitest run src/app/actions/documents.test.ts`

**Step 3: Commit**

```bash
git add src/app/actions/documents.ts src/app/actions/documents.test.ts
git commit -m "fix(security): add Zod validation to updateDocumentMeta"
```

---

### Task 6: Add ownership verification to getMockExamIdBySessionId

**Files:**

- Modify: `src/app/actions/mock-exams.ts:154-160`
- Modify: `src/lib/services/MockExamService.ts` (add userId param)
- Test: `src/app/actions/mock-exams.test.ts`

**Step 1: Pass userId to service**

```typescript
export async function getMockExamIdBySessionId(sessionId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const service = getMockExamService();
  return service.getMockIdBySessionId(sessionId, user.id);
}
```

**Step 2: Update service to verify ownership**

In `MockExamService.ts`, update the method to filter by userId:

```typescript
async getMockIdBySessionId(sessionId: string, userId: string): Promise<string | null> {
  // Existing implementation + add userId filter to the query
}
```

**Step 3: Run tests**

Run: `npx vitest run src/app/actions/mock-exams.test.ts`

**Step 4: Commit**

```bash
git add src/app/actions/mock-exams.ts src/lib/services/MockExamService.ts src/app/actions/mock-exams.test.ts
git commit -m "fix(security): add ownership verification to getMockExamIdBySessionId"
```

---

### Task 7: Wave 1A validation + PR

**Step 1: Run full validation**

```bash
npx vitest run
npm run build
npm run lint
npx tsc --noEmit
```

All four must pass.

**Step 2: Create PR**

```bash
gh pr create --title "fix(security): harden auth, CSP, input validation" --body "$(cat <<'EOF'
## Summary
- Sanitize PostgREST filter input in ExamPaperRepository (M1)
- Remove unsafe-eval from CSP policy (M5)
- Validate x-forwarded-host in auth callback (L1)
- Reduce health endpoint information disclosure (L2)
- Add Zod validation to updateDocumentMeta (L4)
- Add ownership verification to getMockExamIdBySessionId (L5)

## Test plan
- [ ] All existing tests pass
- [ ] Build succeeds
- [ ] Lint clean
- [ ] Type check clean
- [ ] Manual: verify KaTeX rendering still works after CSP change
- [ ] Manual: verify auth callback redirect works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Wave 1B: Performance Memoize & Cache

**Branch:** `fix/perf-memoize-and-cache`
**Worktree:** `../ai-uni-tutor-fix-perf`
**Model:** Sonnet

---

### Task 8: Memoize sortSessions in SessionContext

**Files:**

- Modify: `src/context/SessionContext.tsx:163-176`
- Test: `src/context/SessionContext.test.tsx` (if exists)

**Step 1: Add useMemo**

Before the return statement (~line 162), add:

```typescript
const sortedSessions = useMemo(() => sortSessions(sessions), [sessions]);
```

Then in the value prop at line 166, replace `sessions: sortSessions(sessions)` with `sessions: sortedSessions`.

**Step 2: Run tests**

Run: `npx vitest run src/context/SessionContext`

**Step 3: Commit**

```bash
git add src/context/SessionContext.tsx
git commit -m "fix(ui): memoize sortSessions in SessionContext to prevent re-renders"
```

---

### Task 9: Memoize extractCards in MessageList

**Files:**

- Modify: `src/components/chat/MessageList.tsx:138-141`

**Step 1: Add useMemo for processed messages**

Before the render, add:

```typescript
const processedMessages = useMemo(
  () =>
    mainMessages.map((msg) => ({
      ...msg,
      displayText: msg.role === 'assistant' ? extractCards(msg.content).cleanContent : msg.content,
    })),
  [mainMessages],
);
```

Then in the `.map()` at line 138, use `processedMessages` and reference `msg.displayText` instead of calling `extractCards` inline.

**Step 2: Run tests**

Run: `npx vitest run src/components/chat/MessageList`

**Step 3: Commit**

```bash
git add src/components/chat/MessageList.tsx
git commit -m "fix(ui): memoize extractCards processing in MessageList"
```

---

### Task 10: Remove redundant refetch in ShellClient

**Files:**

- Modify: `src/app/ShellClient.tsx:41-46`

**Step 1: Remove the useEffect**

Delete lines 41-46 entirely (the `useEffect` with `refreshSessions` and `refreshProfile`). The server-side initial data and auth state change listeners already handle data freshness.

**Step 2: Run tests**

Run: `npx vitest run src/app/ShellClient`

**Step 3: Commit**

```bash
git add src/app/ShellClient.tsx
git commit -m "fix(ui): remove redundant refetch on ShellClient mount"
```

---

### Task 11: Optimize useKnowledgeCards streaming dependency

**Files:**

- Modify: `src/hooks/useKnowledgeCards.ts:75-92`

**Step 1: Use stable dependency key**

Replace the `autoCards` useMemo with a two-step approach:

```typescript
// Stable key: only changes when assistant message IDs or last content changes
const assistantContentKey = useMemo(() => {
  const assistantMsgs = messages.filter((m) => m.role === 'assistant' && !m.cardId && m.content);
  if (assistantMsgs.length === 0) return '';
  const lastMsg = assistantMsgs[assistantMsgs.length - 1];
  return `${assistantMsgs.length}:${lastMsg.id}:${lastMsg.content.length}`;
}, [messages]);

const autoCards = useMemo(() => {
  if (!enabled) return [];
  const allCards: KnowledgeCard[] = [];
  const assistantMessages = messages.filter(
    (msg) => msg.role === 'assistant' && !msg.cardId && msg.content,
  );
  for (const msg of assistantMessages) {
    const { cards } = extractCards(msg.content);
    allCards.push(...cards.map((c) => ({ ...c, origin: c.origin ?? 'official' })));
  }
  return Array.from(new Map(allCards.map((c) => [c.title, c])).values());
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [assistantContentKey, enabled]);
```

**Step 2: Run tests**

Run: `npx vitest run src/hooks/useKnowledgeCards`

**Step 3: Commit**

```bash
git add src/hooks/useKnowledgeCards.ts
git commit -m "fix(ui): optimize useKnowledgeCards to reduce streaming recomputation"
```

---

### Task 12: Optimize contentParser injectLinks

**Files:**

- Modify: `src/lib/contentParser.ts:104-159`
- Test: `src/lib/contentParser.test.ts`

**Step 1: Build combined regex instead of per-card loop**

Replace the inner `sortedCards.forEach` at line 132 with a single combined regex approach:

```typescript
// Build a single combined regex from all card titles
const cardMap = new Map<string, string>(); // lowercase title -> card.id
for (const card of sortedCards) {
  cardMap.set(card.title.toLowerCase(), card.id);
}

const escapedTitles = sortedCards.map((card) => {
  const escaped = escapeRegExp(card.title);
  const hasCJK =
    /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(
      card.title,
    );
  const mdMarker = '(?:\\*\\*|__)';
  return hasCJK
    ? `${mdMarker}${escaped}${mdMarker}|${escaped}`
    : `${mdMarker}${escaped}${mdMarker}|\\b${escaped}\\b`;
});

const combinedRegex = new RegExp(escapedTitles.join('|'), 'gi');

// Single pass replacement
part = part.replace(combinedRegex, (match) => {
  const plain = match.replace(/^\*\*|^\__|__$|\*\*$/g, '');
  const cardId = cardMap.get(plain.toLowerCase());
  return cardId ? `[${match}](#card-${cardId})` : match;
});
```

Also remove the redundant `content.match(preExistingCardLinkPattern)` check at line 110-113 -- just call `replace` directly.

**Step 2: Run tests**

Run: `npx vitest run src/lib/contentParser`

**Step 3: Commit**

```bash
git add src/lib/contentParser.ts src/lib/contentParser.test.ts
git commit -m "fix(ui): optimize injectLinks from O(n*m) to single-pass regex"
```

---

### Task 13: Add staleTime to TanStack Query

**Files:**

- Modify: `src/components/Providers.tsx:21-28`

**Step 1: Add staleTime and gcTime**

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
}),
```

**Step 2: Run tests**

Run: `npx vitest run src/components/Providers`

**Step 3: Commit**

```bash
git add src/components/Providers.tsx
git commit -m "fix(ui): add staleTime to TanStack Query to reduce redundant fetches"
```

---

### Task 14: Wave 1B validation + PR

**Step 1: Run full validation**

```bash
npx vitest run
npm run build
npm run lint
npx tsc --noEmit
```

**Step 2: Create PR**

```bash
gh pr create --title "fix(ui): memoize renders and add staleTime" --body "$(cat <<'EOF'
## Summary
- Memoize sortSessions in SessionContext (P3)
- Memoize extractCards in MessageList (P4)
- Remove redundant refetch in ShellClient (P5)
- Optimize useKnowledgeCards streaming dependency (P8)
- Optimize contentParser injectLinks to single-pass regex (P9)
- Add staleTime to TanStack Query defaults (P12)

## Test plan
- [ ] All existing tests pass
- [ ] Build succeeds
- [ ] Manual: verify chat streaming still works smoothly
- [ ] Manual: verify knowledge cards still appear correctly
- [ ] Manual: verify session list sorting works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Wave 1 Merge Checkpoint

After both Wave 1A and 1B PRs are merged:

```bash
git worktree remove ../ai-uni-tutor-fix-security
git worktree remove ../ai-uni-tutor-fix-perf
git pull origin main
npm run build && npx vitest run && npm run lint && npx tsc --noEmit
```

All four validation commands must pass before proceeding to Wave 2.

---

## Wave 2: Architecture Refactor

**Branch:** `refactor/architecture-data-flow`
**Worktree:** `../ai-uni-tutor-fix-arch`
**Model:** Opus

---

### Task 15: Add missing service methods for Stripe profile operations

**Files:**

- Modify: `src/lib/services/ProfileService.ts`
- Modify: `src/lib/repositories/ProfileRepository.ts`
- Test: `src/lib/services/ProfileService.test.ts`

**Step 1: Add Stripe-specific methods to ProfileRepository**

```typescript
async updateStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);
  if (error) throw new DatabaseError('Failed to update Stripe customer ID', error);
}

async updateSubscription(
  userId: string,
  data: {
    stripe_subscription_id: string | null;
    subscription_status: string;
    current_period_end: string | null;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update(data).eq('id', userId);
  if (error) throw new DatabaseError('Failed to update subscription', error);
}

async getStripeCustomerId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data?.stripe_customer_id ?? null;
}
```

**Step 2: Add corresponding ProfileService methods**

```typescript
async updateStripeCustomerId(userId: string, customerId: string): Promise<void> {
  return this.profileRepo.updateStripeCustomerId(userId, customerId);
}

async updateSubscription(userId: string, data: { ... }): Promise<void> {
  return this.profileRepo.updateSubscription(userId, data);
}

async getStripeCustomerId(userId: string): Promise<string | null> {
  return this.profileRepo.getStripeCustomerId(userId);
}
```

**Step 3: Write tests + run**

Run: `npx vitest run src/lib/services/ProfileService.test.ts`

**Step 4: Commit**

```bash
git add src/lib/services/ProfileService.ts src/lib/repositories/ProfileRepository.ts src/lib/services/ProfileService.test.ts
git commit -m "feat(api): add Stripe profile methods to service/repository layer"
```

---

### Task 16: Migrate Stripe webhook to use ProfileService

**Files:**

- Modify: `src/app/api/stripe/webhook/route.ts`
- Test: `src/app/api/stripe/webhook/route.test.ts`

**Step 1: Replace direct Supabase calls with ProfileService**

Replace all `supabase.from('profiles').update(...)` calls (lines 83-91, 111-117, 130-139, 152-158) with `profileService.updateSubscription(userId, data)`.

Keep the `stripe_events` table calls as-is (idempotency check) since there's no StripeEventService and this is webhook-specific.

**Step 2: Run tests**

Run: `npx vitest run src/app/api/stripe/webhook`

**Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/app/api/stripe/webhook/route.test.ts
git commit -m "refactor(api): migrate Stripe webhook to use ProfileService"
```

---

### Task 17: Migrate Stripe checkout to use ProfileService

**Files:**

- Modify: `src/app/api/stripe/checkout/route.ts`
- Test: `src/app/api/stripe/checkout/route.test.ts`

**Step 1: Replace direct Supabase calls**

Replace lines 14-18 with `profileService.getStripeCustomerId(user.id)`.
Replace line 32 with `profileService.updateStripeCustomerId(user.id, customer.id)`.

**Step 2: Run tests**

Run: `npx vitest run src/app/api/stripe/checkout`

**Step 3: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts src/app/api/stripe/checkout/route.test.ts
git commit -m "refactor(api): migrate Stripe checkout to use ProfileService"
```

---

### Task 18: Fix exam-papers action data flow violation

**Files:**

- Modify: `src/app/actions/exam-papers.ts:79-96`
- Modify: `src/lib/services/ExamPaperService.ts`
- Test: `src/app/actions/exam-papers.test.ts`

**Step 1: Add visibility check method to ExamPaperService**

```typescript
async getPaperDetail(paperId: string, userId: string): Promise<ExamPaperWithQuestions | null> {
  const paper = await this.examPaperRepo.findById(paperId);
  if (!paper) return null;
  if (paper.visibility !== 'public' && paper.userId !== userId) return null;
  return this.getPaperWithQuestions(paperId);
}
```

**Step 2: Update action to delegate to service**

Replace lines 79-96 in `exam-papers.ts`:

```typescript
export async function getExamPaperDetail(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const service = getExamPaperService();
  return service.getPaperDetail(id, user.id);
}
```

**Step 3: Run tests**

Run: `npx vitest run src/app/actions/exam-papers.test.ts`

**Step 4: Commit**

```bash
git add src/app/actions/exam-papers.ts src/lib/services/ExamPaperService.ts src/app/actions/exam-papers.test.ts
git commit -m "refactor(api): move exam paper visibility check to service layer"
```

---

### Task 19: Fix admin-content data flow violations

**Files:**

- Modify: `src/app/actions/admin-content.ts`
- Modify: `src/lib/services/DocumentService.ts`
- Modify: `src/lib/repositories/DocumentRepository.ts`
- Test: `src/app/actions/admin-content.test.ts`

**Step 1: Add admin methods to DocumentRepository**

```typescript
async findAll(): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new DatabaseError('Failed to fetch documents', error);
  return (data ?? []) as Document[];
}

async deleteById(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw new DatabaseError('Failed to delete document', error);
}
```

**Step 2: Add admin methods to DocumentService**

```typescript
async getAdminDocuments(): Promise<Document[]> {
  return this.documentRepo.findAll();
}

async deleteByAdmin(documentId: string): Promise<void> {
  await this.documentRepo.deleteById(documentId);
}
```

**Step 3: Update admin-content.ts to use service**

Replace `getAdminDocuments` (lines 28-43) and `deleteAdminContent` for documents (line 205-213) to delegate to `documentService.getAdminDocuments()` and `documentService.deleteByAdmin(id)`.

**Step 4: Run tests**

Run: `npx vitest run src/app/actions/admin-content.test.ts`

**Step 5: Commit**

```bash
git add src/app/actions/admin-content.ts src/lib/services/DocumentService.ts src/lib/repositories/DocumentRepository.ts src/app/actions/admin-content.test.ts
git commit -m "refactor(api): move admin document operations to service/repository layer"
```

---

### Task 20: Extract DocumentProcessingPipeline to service layer

**Files:**

- Create: `src/lib/services/DocumentProcessingService.ts`
- Modify: `src/app/actions/documents.ts:70-249`
- Modify: `src/app/actions/admin-content.ts:75-196`
- Modify: `src/app/api/documents/parse/route.ts:62-281`
- Test: `src/lib/services/DocumentProcessingService.test.ts`

**Step 1: Create DocumentProcessingService**

Extract the shared pipeline logic (parse PDF → LLM extraction → generate embeddings → save chunks) into a service class:

```typescript
export class DocumentProcessingService {
  constructor(
    private documentService: DocumentService,
    private genAI: GenAI,
  ) {}

  async processDocument(params: {
    documentId: string;
    buffer: Buffer;
    docType: 'lecture' | 'exam' | 'assignment';
    onProgress?: (stage: string, current: number, total: number) => void;
    signal?: AbortSignal;
  }): Promise<{ chunksCount: number }> {
    // 1. Parse PDF
    // 2. Extract content via LLM (lecture vs exam branching)
    // 3. Generate embeddings (with retry)
    // 4. Save chunks via documentService
    // 5. Update document status
  }
}
```

**Step 2: Refactor uploadDocument action**

Reduce to ~30 lines: auth + validation + delegation to `DocumentProcessingService.processDocument()`.

**Step 3: Refactor uploadAdminContent action**

Same pattern for the document branch. Exam branch already delegates to ExamPaperService.

**Step 4: Refactor API parse route**

Replace inline pipeline with `DocumentProcessingService.processDocument()`, passing an `onProgress` callback that sends SSE events.

**Step 5: Write tests for DocumentProcessingService**

Test the pipeline with mocked dependencies.

**Step 6: Run all tests**

Run: `npx vitest run`

**Step 7: Commit**

```bash
git add src/lib/services/DocumentProcessingService.ts src/lib/services/DocumentProcessingService.test.ts src/app/actions/documents.ts src/app/actions/admin-content.ts src/app/api/documents/parse/route.ts
git commit -m "refactor(rag): extract DocumentProcessingService to eliminate pipeline duplication"
```

---

### Task 21: Add chunk ownership verification (IDOR fix)

**Files:**

- Modify: `src/app/actions/documents.ts:263-285`
- Modify: `src/lib/repositories/DocumentChunkRepository.ts`
- Test: `src/app/actions/documents.test.ts`

**Step 1: Add verifyChunkBelongsToDocument method to DocumentChunkRepository**

```typescript
async verifyChunksBelongToDocument(chunkIds: string[], documentId: string): Promise<boolean> {
  if (chunkIds.length === 0) return true;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id')
    .in('id', chunkIds)
    .eq('document_id', documentId);
  if (error) throw new DatabaseError('Failed to verify chunk ownership', error);
  return data?.length === chunkIds.length;
}
```

**Step 2: Add document_id filter to updateEmbedding**

```typescript
async updateEmbedding(id: string, embedding: number[], documentId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('document_chunks')
    .update({ embedding })
    .eq('id', id)
    .eq('document_id', documentId);
  if (error) throw new DatabaseError('Failed to update chunk embedding', error);
}
```

**Step 3: Update updateDocumentChunks action**

In `documents.ts:263-285`, after verifying document ownership, add:

```typescript
const allChunkIds = [...deletedIds, ...updates.map((u) => u.id)];
const chunksValid = await documentService.verifyChunksBelongToDocument(allChunkIds, documentId);
if (!chunksValid) {
  return { status: 'error', message: 'Invalid chunk IDs' };
}
```

**Step 4: Update regenerateEmbeddings to pass documentId**

In `documents.ts:287-315`, pass `documentId` to `updateChunkEmbedding`.

**Step 5: Run tests**

Run: `npx vitest run src/app/actions/documents.test.ts`

**Step 6: Commit**

```bash
git add src/app/actions/documents.ts src/lib/repositories/DocumentChunkRepository.ts src/app/actions/documents.test.ts
git commit -m "fix(security): add chunk ownership verification to prevent IDOR"
```

---

### Task 22: Wave 2 validation + PR

**Step 1: Run full validation**

```bash
npx vitest run
npm run build
npm run lint
npx tsc --noEmit
```

**Step 2: Create PR**

```bash
gh pr create --title "refactor(api): enforce data flow layer compliance" --body "$(cat <<'EOF'
## Summary
- Add Stripe profile methods to service/repository layer (A5)
- Migrate Stripe webhook + checkout to use ProfileService (A5)
- Move exam paper visibility check to service layer (A1)
- Move admin document operations to service layer (A2)
- Extract DocumentProcessingService to eliminate pipeline duplication x3 (A3, A4)
- Add chunk ownership verification to prevent IDOR (M2, M3)

## Test plan
- [ ] All existing tests pass
- [ ] Build succeeds
- [ ] Lint + typecheck clean
- [ ] Manual: verify document upload still works
- [ ] Manual: verify admin content management works
- [ ] Manual: verify Stripe checkout + webhook flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Wave 2 Merge Checkpoint

```bash
git worktree remove ../ai-uni-tutor-fix-arch
git pull origin main
npm run build && npx vitest run && npm run lint && npx tsc --noEmit
```

---

## Wave 3A: RAG Pipeline Optimization

**Branch:** `fix/rag-pipeline-optimization`
**Worktree:** `../ai-uni-tutor-fix-rag`
**Model:** Opus

---

### Task 23: Implement batch embedding generation

**Files:**

- Modify: `src/lib/rag/embedding.ts`
- Test: `src/lib/rag/embedding.test.ts`

**Step 1: Add batch embedding function**

```typescript
const EMBEDDING_BATCH_SIZE = 10;

export async function generateEmbeddingBatch(
  texts: string[],
  concurrency = EMBEDDING_BATCH_SIZE,
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const embeddings = await Promise.all(batch.map((text) => generateEmbeddingWithRetry(text)));
    results.push(...embeddings);
  }
  return results;
}
```

**Step 2: Update callers to use batch function**

Update `DocumentProcessingService` (created in Wave 2) to call `generateEmbeddingBatch` instead of sequential `generateEmbeddingWithRetry` in a loop.

**Step 3: Run tests**

Run: `npx vitest run src/lib/rag/embedding`

**Step 4: Commit**

```bash
git add src/lib/rag/embedding.ts src/lib/rag/embedding.test.ts
git commit -m "fix(rag): add batch embedding generation with concurrency control"
```

---

### Task 24: Add pagination to RAG parsers

**Files:**

- Modify: `src/lib/rag/parsers/lecture-parser.ts`
- Modify: `src/lib/rag/parsers/question-parser.ts`
- Test: `src/lib/rag/parsers/lecture-parser.test.ts`
- Test: `src/lib/rag/parsers/question-parser.test.ts`

**Step 1: Add page batching to lecture-parser**

```typescript
const PAGE_BATCH_SIZE = 10;

export async function parseLecture(pages: PDFPage[]): Promise<KnowledgePoint[]> {
  const genAI = getGenAI();
  const allPoints: KnowledgePoint[] = [];

  for (let i = 0; i < pages.length; i += PAGE_BATCH_SIZE) {
    const batch = pages.slice(i, i + PAGE_BATCH_SIZE);
    const pagesText = batch.map((p) => `[Page ${p.page}]\n${p.text}`).join('\n\n');
    // ... existing prompt + LLM call with pagesText ...
    const batchPoints = /* parse result */;
    allPoints.push(...batchPoints);
  }

  // Deduplicate by title
  return Array.from(new Map(allPoints.map((p) => [p.title, p])).values());
}
```

**Step 2: Same pattern for question-parser**

**Step 3: Run tests**

Run: `npx vitest run src/lib/rag/parsers`

**Step 4: Commit**

```bash
git add src/lib/rag/parsers/lecture-parser.ts src/lib/rag/parsers/question-parser.ts
git commit -m "fix(rag): paginate parser LLM calls to avoid token limits"
```

---

### Task 25: Remove embedding from chunk SELECT

**Files:**

- Modify: `src/lib/repositories/DocumentChunkRepository.ts:71-80`

**Step 1: Remove embedding from findByDocumentId select**

Change line 74 from:

```typescript
.select('id, document_id, content, metadata, embedding')
```

to:

```typescript
.select('id, document_id, content, metadata')
```

Add a separate method if embedding is needed:

```typescript
async findByDocumentIdWithEmbeddings(documentId: string): Promise<DocumentChunk[]> {
  // ... same query but includes embedding column
}
```

**Step 2: Update callers that need embeddings**

Check `regenerateEmbeddings` in documents.ts — it calls `getChunks` and needs embeddings. Route it through the new method.

**Step 3: Run tests**

Run: `npx vitest run src/lib/repositories/DocumentChunkRepository`

**Step 4: Commit**

```bash
git add src/lib/repositories/DocumentChunkRepository.ts
git commit -m "fix(rag): exclude embedding column from default chunk queries"
```

---

### Task 26: Optimize MessageRepository session update

**Files:**

- Modify: `src/lib/repositories/MessageRepository.ts:79-83`

**Step 1: Remove inline session update from create method**

Delete the extra query at lines 79-83. Instead, update the session timestamp at the service level after all messages for a turn are saved, or rely on the caller to update it once.

Check `SessionService` or wherever messages are saved in bulk — add a single `updateSessionTimestamp` call there.

**Step 2: Run tests**

Run: `npx vitest run src/lib/repositories/MessageRepository`

**Step 3: Commit**

```bash
git add src/lib/repositories/MessageRepository.ts
git commit -m "fix(rag): remove per-message session timestamp update"
```

---

### Task 27: Wave 3A validation + PR

Same pattern: `npx vitest run && npm run build && npm run lint && npx tsc --noEmit`, then `gh pr create`.

PR title: `fix(rag): batch embeddings, paginate parsers, optimize queries`

---

## Wave 3B: UI/Bundle Optimization

**Branch:** `fix/ui-bundle-optimization`
**Worktree:** `../ai-uni-tutor-fix-ui`
**Model:** Sonnet

---

### Task 28: Lazy-load MarkdownRenderer

**Files:**

- Modify: `src/components/MarkdownRenderer.tsx`
- Modify: Components that import MarkdownRenderer (use `next/dynamic`)

**Step 1: Create dynamic import wrapper**

In the file that imports MarkdownRenderer (e.g., `MessageBubble.tsx`), replace:

```typescript
import MarkdownRenderer from '@/components/MarkdownRenderer';
```

with:

```typescript
import dynamic from 'next/dynamic';
const MarkdownRenderer = dynamic(() => import('@/components/MarkdownRenderer'), {
  ssr: false,
  loading: () => <Box style={{ minHeight: 20 }} />,
});
```

Also move the KaTeX CSS import from `layout.tsx` to `MarkdownRenderer.tsx` itself so it only loads when the component loads.

**Step 2: Run build to verify bundle splitting**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/MarkdownRenderer.tsx src/components/chat/MessageBubble.tsx src/app/layout.tsx
git commit -m "fix(ui): lazy-load MarkdownRenderer to reduce initial bundle size"
```

---

### Task 29: Consolidate MessageBubble selection useEffects

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx:204-307`

**Step 1: Merge 5 selection useEffects into one**

```typescript
useEffect(() => {
  if (!selection) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExplainSelection();
    }
    if (e.key === 'Escape') {
      setSelection(null);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!bubbleRef.current?.contains(e.target as Node)) {
      setSelection(null);
    }
  };

  const handleScrollResize = () => setSelection(null);

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('scroll', handleScrollResize, true);
  window.addEventListener('resize', handleScrollResize);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('scroll', handleScrollResize, true);
    window.removeEventListener('resize', handleScrollResize);
  };
}, [selection, handleExplainSelection]);
```

Keep the `useLayoutEffect` for selection restoration separate (it has different timing requirements).

**Step 2: Run tests**

Run: `npx vitest run src/components/chat/MessageBubble`

**Step 3: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "fix(ui): consolidate MessageBubble selection listeners into single useEffect"
```

---

### Task 30: Optimize LectureClient session rehydration

**Files:**

- Modify: `src/app/(protected)/lecture/[id]/LectureClient.tsx:121-169`

**Step 1: Track last saved index instead of Set iteration**

Replace the `handleUpdateSession` approach. Instead of iterating all messages to find unsaved ones:

```typescript
const lastSavedIndexRef = useRef(0);

const handleUpdateSession = useCallback(
  async (updated: SessionWithMessages) => {
    const newMessages = updated.messages.slice(lastSavedIndexRef.current);
    if (newMessages.length > 0) {
      await saveMessages(newMessages);
      lastSavedIndexRef.current = updated.messages.length;
    }
  },
  [saveMessages],
);
```

**Step 2: Run tests**

Run: `npx vitest run src/app/(protected)/lecture`

**Step 3: Commit**

```bash
git add src/app/(protected)/lecture/[id]/LectureClient.tsx
git commit -m "fix(ui): optimize LectureClient session update to O(1) lookup"
```

---

### Task 31: Lazy-load marketing below-fold sections

**Files:**

- Modify: `src/components/marketing/MarketingApp.tsx`

**Step 1: Dynamic import below-fold components**

```typescript
import dynamic from 'next/dynamic';
import { Box } from '@mantine/core';
import HeroSection from '@/components/marketing/HeroSection';
import Navbar from '@/components/marketing/Navbar';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';

const FeaturesSection = dynamic(() => import('@/components/marketing/FeaturesSection'));
const HowItWorksSection = dynamic(() => import('@/components/marketing/HowItWorksSection'));
const TestimonialsSection = dynamic(() => import('@/components/marketing/TestimonialsSection'));
const CTASection = dynamic(() => import('@/components/marketing/CTASection'));
const Footer = dynamic(() => import('@/components/marketing/Footer'));
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/marketing/MarketingApp.tsx
git commit -m "fix(ui): lazy-load marketing below-fold sections"
```

---

### Task 32: Clean up any types and error handling inconsistency

**Files:**

- Modify: `src/app/api/stripe/webhook/route.ts` (remove `as any` casts)
- Modify: `src/app/(protected)/pricing/page.tsx` (fix error typing)
- Modify: `src/app/(public)/share/[id]/page.tsx` (fix any props)

**Step 1: Fix each any usage**

- webhook: Add `stripe_events` to Database type or use proper Stripe types
- pricing: Replace `(error as any).message` with `error instanceof Error ? error.message : 'Unknown error'`
- share: Type the code component props properly

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add -A
git commit -m "fix(ui): replace any types with proper typing"
```

---

### Task 33: Wave 3B validation + PR

Same pattern. PR title: `fix(ui): lazy-load bundles, consolidate listeners, fix types`

---

## Wave 3 Merge Checkpoint

```bash
git worktree remove ../ai-uni-tutor-fix-rag
git worktree remove ../ai-uni-tutor-fix-ui
git pull origin main
npm run build && npx vitest run && npm run lint && npx tsc --noEmit
```

---

## Wave 4A: i18n Core

**Branch:** `feat/i18n-authenticated-app`
**Worktree:** `../ai-uni-tutor-fix-i18n-core`
**Model:** Sonnet

---

### Task 34: Extend translations.ts with authenticated app keys

**Files:**

- Modify: `src/i18n/translations.ts`

**Step 1: Add new translation sections**

Add these sections to both `zh` and `en` objects in translations.ts:

```typescript
sidebar: {
  lectures: 'Lectures' / '课程',
  assignments: 'Assignments' / '作业',
  mockExams: 'Mock Exams' / '模拟考试',
  knowledgeBase: 'Knowledge Base' / '知识库',
  openSidebar: 'Open sidebar' / '展开侧栏',
  upgradePlan: 'Upgrade plan' / '升级计划',
  settings: 'Settings' / '设置',
  logOut: 'Log out' / '退出登录',
  signIn: 'Sign in' / '登录',
  personalization: 'Personalization' / '个性化',
  help: 'Help' / '帮助',
  noConversations: 'No conversations yet' / '暂无对话',
},
modals: {
  deleteChat: 'Delete Chat?' / '删除对话？',
  deleteConfirm: 'This will permanently delete...' / '此操作将永久删除...',
  cancel: 'Cancel' / '取消',
  delete: 'Delete' / '删除',
  shareChat: 'Share Chat' / '分享对话',
  shareToWeb: 'Share to Web' / '分享到网络',
  publicLink: 'Public Link' / '公开链接',
  copied: 'Copied' / '已复制',
  copy: 'Copy' / '复制',
  renameSession: 'Rename Session' / '重命名会话',
  save: 'Save' / '保存',
  unlockUnlimited: 'Unlock Unlimited AI' / '解锁无限 AI',
  dailyLimitReached: 'Daily Usage Limit Reached' / '已达每日使用上限',
  dailyLimitDesc: "You've hit your daily..." / '您已达到免费版每日消息上限...',
  maybeLater: 'Maybe Later' / '以后再说',
  upgradeNow: 'Upgrade Now' / '立即升级',
  newSession: 'New Session' / '新会话',
  institution: 'Institution' / '院校',
  targetSubject: 'Target Subject' / '目标科目',
  initializing: 'Initializing...' / '初始化中...',
  startSession: 'Start Session' / '开始会话',
},
common: {
  explain: 'Explain' / '解释',
  copyCode: 'Copy code' / '复制代码',
  copiedBang: 'Copied!' / '已复制！',
},
pricing: {
  // ... all pricing page strings
},
```

**Step 2: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(i18n): add translation keys for authenticated app"
```

---

### Task 35: Convert Sidebar.tsx to use translations

**Files:**

- Modify: `src/components/Sidebar.tsx`

**Step 1: Add useLanguage hook and replace all hardcoded strings**

```typescript
const { t } = useLanguage();
// Replace 'Lectures' → t.sidebar.lectures
// Replace 'Assignments' → t.sidebar.assignments
// etc. for all ~16 hardcoded strings
```

**Step 2: Run tests**

Run: `npx vitest run src/components/Sidebar`

**Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(i18n): translate Sidebar component"
```

---

### Task 36: Convert all modal components

**Files:**

- Modify: `src/components/DeleteSessionModal.tsx`
- Modify: `src/components/ShareModal.tsx`
- Modify: `src/components/RenameSessionModal.tsx`
- Modify: `src/components/UsageLimitModal.tsx`
- Modify: `src/components/NewSessionModal.tsx`

**Step 1: Add useLanguage to each modal and replace hardcoded strings**

Same pattern: `const { t } = useLanguage()` then replace all string literals with `t.modals.*`.

**Step 2: Run tests**

Run: `npx vitest run src/components`

**Step 3: Commit**

```bash
git add src/components/DeleteSessionModal.tsx src/components/ShareModal.tsx src/components/RenameSessionModal.tsx src/components/UsageLimitModal.tsx src/components/NewSessionModal.tsx
git commit -m "feat(i18n): translate all modal components"
```

---

### Task 37: Convert pricing page

**Files:**

- Modify: `src/app/(protected)/pricing/page.tsx`

\*_Step 1: Replace all hardcoded pricing strings with t.pricing._

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/(protected)/pricing/page.tsx
git commit -m "feat(i18n): translate pricing page"
```

---

### Task 38: Wave 4A validation + PR

PR title: `feat(i18n): add translations for core app (sidebar, modals, pricing)`

---

## Wave 4B: i18n Feature Components

**Branch:** `feat/i18n-feature-components`
**Worktree:** `../ai-uni-tutor-fix-i18n-features`
**Model:** Sonnet

---

### Task 39: Extend translations.ts with feature component keys

**Files:**

- Modify: `src/i18n/translations.ts`

Add keys for chat, rag, exam components. Follow the same pattern as Task 34.

**Commit:** `feat(i18n): add translation keys for feature components`

---

### Task 40: Convert chat components

**Files:**

- Modify: `src/components/chat/MessageBubble.tsx` (Explain button, tooltips)
- Modify: `src/components/chat/MessageList.tsx` (any hardcoded strings)
- Modify: `src/components/MarkdownRenderer.tsx` (Copy code tooltip)

**Commit:** `feat(i18n): translate chat components`

---

### Task 41: Convert RAG/knowledge components

**Files:**

- Modify: `src/components/rag/KnowledgeTable.tsx`
- Modify: `src/components/rag/` (other files with hardcoded strings)

**Commit:** `feat(i18n): translate knowledge base components`

---

### Task 42: Convert exam components

**Files:**

- Modify: `src/components/exam/` (all files with hardcoded strings)

**Commit:** `feat(i18n): translate exam components`

---

### Task 43: Wave 4B validation + PR

PR title: `feat(i18n): translate feature components (chat, rag, exam)`

---

## Wave 4 Merge Checkpoint

```bash
git worktree remove ../ai-uni-tutor-fix-i18n-core
git worktree remove ../ai-uni-tutor-fix-i18n-features
git pull origin main
npm run build && npx vitest run && npm run lint && npx tsc --noEmit
```

---

## Final Checklist

- [ ] All 7 PRs merged to main
- [ ] Full validation passes on main: build + test + lint + typecheck
- [ ] No remaining worktrees: `git worktree list` shows only main
- [ ] Manual smoke test: login → chat → upload → knowledge → exam → pricing
- [ ] Manual i18n test: switch language and verify all authenticated pages translate
