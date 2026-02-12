# Architecture Audit & Optimization — Phase 5-6

Date: 2026-02-12
Based on: Full code audit of #77 and #79 implementation + new issue discovery

---

## Phase 1-4 Verification Summary

### Verified Complete

| #   | Issue                           | PR  |
| --- | ------------------------------- | --- |
| 1.1 | Admin role verification         | #77 |
| 1.2 | Mock exam ownership             | #77 |
| 1.3 | Exam paper access control       | #77 |
| 1.7 | AI endpoint rate limits (chat)  | #77 |
| 2.1 | ExamPaper/MockExam repositories | #79 |
| 2.2 | Error handling + error types    | #79 |
| 2.3 | Action response standardize     | #79 |
| 2.5 | Domain model alignment          | #79 |
| 3.1 | TanStack Query migration        | #79 |
| 3.2 | Memory leak fixes               | #79 |
| 3.3 | ProfileContext loading bug      | #79 |
| 4.1 | RAG config extraction           | #79 |
| 4.3 | Env validation                  | #79 |
| 4.4 | Health check endpoint           | #79 |

### Partially Complete

| #   | Issue                          | Gap                                  |
| --- | ------------------------------ | ------------------------------------ |
| 1.4 | Stripe webhook idempotency     | Not implemented                      |
| 1.5 | Stripe checkout race condition | Create+update not atomic             |
| 2.4 | Document upload dedup          | admin-content bypasses Service layer |
| 4.5 | Security headers               | Missing HSTS, CSP                    |

### False Positives (Not Issues)

| #          | Original Claim               | Finding                         |
| ---------- | ---------------------------- | ------------------------------- |
| 3.2 Leak 2 | LectureHelper ObjectURL leak | Uses `readAsDataURL()`, no leak |

---

## Phase 5: Architecture Pattern Improvements (P1)

### 5.1 Unified Error System

**Problem**: 6 error classes defined but Service layer throws generic `new Error()` in 15+ places.

**Fix**: One class, one map, one function.

```typescript
// src/lib/errors.ts — replace entire file

const ERROR_MAP = {
  UNAUTHORIZED: 'Not authenticated',
  FORBIDDEN: 'Permission denied',
  NOT_FOUND: 'Resource not found',
  QUOTA_EXCEEDED: 'Usage limit reached',
  VALIDATION: 'Invalid input',
  DB_ERROR: 'Database operation failed',
} as const;

type ErrorCode = keyof typeof ERROR_MAP;

class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_MAP[code]);
  }
}

function mapError(error: unknown) {
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  return { success: false, error: 'Internal server error', code: 'INTERNAL' };
}
```

**Files affected**:

- `src/lib/errors.ts` — rewrite
- `ExamPaperService.ts` — 2 changes
- `MockExamService.ts` — 5 changes
- `SessionService.ts` — 6 changes
- `DocumentService.ts` — 2 changes
- `QuotaService.ts` — 1 change
- `DocumentChunkRepository.ts` — 4 changes
- All action files — catch blocks use `mapError()`

### 5.2 Authentication Out of Service Layer

**Problem**: Services call `getCurrentUser()` internally (7+ places). Service layer should not handle authentication.

**Fix**: Action layer authenticates, passes `userId` to Service.

```typescript
// Action
const user = await getCurrentUser();
if (!user) return mapError(new AppError('UNAUTHORIZED'));
await service.parsePaper(user.id, buffer, fileName, options);

// Service — no more getCurrentUser()
async parsePaper(userId: string, buffer: Buffer, ...) { ... }
```

**Files affected**:

- `ExamPaperService.ts` — 2 methods add `userId`, remove 2x `getCurrentUser()`
- `MockExamService.ts` — 6 methods add `userId`, remove 5x `getCurrentUser()`
- `SessionService.ts` — relevant methods add `userId`
- Corresponding action files — pass `user.id`

### 5.3 DocumentChunkRepository Consistency

**Problem**: Uses `new Error()` (4 places) instead of `AppError('DB_ERROR')`. No entity type.

**Fix**:

1. 4x `throw new Error(...)` → `throw new AppError('DB_ERROR', ...)`
2. Add to `src/lib/domain/models/Document.ts`:

```typescript
export interface DocumentChunkEntity {
  id: string;
  documentId: string;
  content: string;
  metadata: Json;
  embedding: number[] | null;
}
```

3. Add `mapToEntity()` to DocumentChunkRepository.

### 5.4 Ownership Verification Unified to Service Layer

**Problem**: Ownership verification scattered across Action, Service, Repository layers with different patterns.

**Fix**: Repository provides query, Service enforces, Action only passes `userId`.

```typescript
// Repository
async verifyOwnership(id: string, userId: string): Promise<boolean> { ... }

// Service
async submitAnswer(userId: string, mockId: string, ...) {
  if (!await this.mockRepo.verifyOwnership(mockId, userId))
    throw new AppError('FORBIDDEN');
  ...
}
```

**Files affected**:

- `mock-exams.ts` action — delete `verifyMockOwnership()`, remove direct Supabase queries
- `MockExamRepository.ts` — add `verifyOwnership()`
- `MockExamService.ts` — call `this.mockRepo.verifyOwnership()` internally

### 5.5 Strategy Pattern Simplified to Config Map

**Problem**: 4 files (`ITutoringStrategy`, `StrategyFactory`, `LectureHelperStrategy`, `AssignmentCoachStrategy`) for 2 modes. Mock Exam listed but throws on create.

**Fix**: Delete `src/lib/strategies/` directory. Merge config into `src/constants/modes.ts`:

```typescript
export const MODES = {
  'Lecture Helper': {
    label: 'Lecture Helper',
    icon: '...',
    description: '...',
    temperature: 0.7,
    ragMatchCount: 5,
    knowledgeCards: true,
    systemPrompt: (course: Course) => `You are a tutor for ${course.code}...`,
    preprocessInput: undefined,
    postprocessResponse: undefined,
  },
  'Assignment Coach': {
    label: 'Assignment Coach',
    icon: '...',
    description: '...',
    temperature: 0.5,
    ragMatchCount: 3,
    knowledgeCards: false,
    systemPrompt: (course: Course) => `You are an assignment coach...`,
    preprocessInput: (input: string) => `${input}\n[Do not give direct answers]`,
    postprocessResponse: (response: string) => response.replace(/\[internal\]/g, ''),
  },
};
```

ChatService: `MODES[mode].temperature` instead of `strategy.getTemperature()`.

**Files deleted**: `ITutoringStrategy.ts`, `StrategyFactory.ts`, `LectureHelperStrategy.ts`, `AssignmentCoachStrategy.ts`
**Files modified**: `constants/modes.ts`, `ChatService.ts`

---

## Phase 6: Remaining Bug Fixes

### 6.1 Stripe Webhook Overhaul (P0)

**Location**: `src/app/api/stripe/webhook/route.ts`

**Problems**:

1. No `event.id` deduplication
2. DB update result not checked, failures silently ignored
3. Always returns 200
4. No try-catch around event handlers
5. `session.subscription` cast to `string` without null check

**Fix**: Add `stripe_events` table for dedup, try-catch per handler, check update results, return 500 on failure.

### 6.2 Admin Cannot Delete Other Users' Exam Papers (P0)

**Location**: `admin-content.ts:213` → `ExamPaperService.deletePaper()`

**Problem**: `deletePaper()` checks ownership — admin blocked from deleting others' papers.

**Fix**: Add `deleteByAdmin(paperId)` that skips ownership check.

### 6.3 Security Headers Incomplete (P1)

**Location**: `next.config.ts`

**Fix**: Add HSTS, CSP, Permissions-Policy.

### 6.4 Admin-content Bypasses Service Layer (P1)

**Location**: `admin-content.ts:120-134`

**Problem**: Non-exam uploads insert directly via Supabase, bypassing `DocumentService.createDocument()`.

**Fix**: Use `DocumentService.createDocument()`.

### 6.5 JSON.parse Error Messages Not User-Friendly (P2)

**Location**: `ExamPaperService.ts:101`, `MockExamService.ts:106`

**Fix**: Wrap in helper:

```typescript
function parseAIResponse<T>(text: string | undefined): T {
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new AppError('VALIDATION', 'AI returned invalid response. Please retry.');
  }
}
```

---

## Implementation Order

```
Phase 6 P0 bugs (do first)
├── 6.1 Stripe webhook overhaul         ~3 hrs
└── 6.2 Admin delete exam paper bug     ~20 min

Phase 5 architecture (single sprint)
├── 5.1 Unified error system            ~2 hrs
├── 5.2 Auth out of service layer       ~2 hrs
├── 5.3 DocumentChunkRepo consistency   ~30 min
├── 5.4 Ownership verification unified  ~1 hr
└── 5.5 Strategy → config map           ~1 hr

Phase 6 remaining (after Phase 5)
├── 6.3 Security headers                ~15 min
├── 6.4 Admin-content use Service layer ~30 min
└── 6.5 JSON.parse friendly errors      ~20 min
```
