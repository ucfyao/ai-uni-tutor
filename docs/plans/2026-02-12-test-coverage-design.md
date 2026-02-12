# Test Coverage Optimization Design

## Goal

Bring test coverage from ~2.8% (5 files / 26 tests) to 60%+ statement coverage across all architectural layers.

## Strategy

- **Pure mock approach**: Mock Supabase, Redis, Gemini, Stripe — no external dependencies
- **Full layer coverage**: Repositories → Services → Actions → API Routes → Utilities
- **Shared infrastructure**: Reusable mock factories + fixture data

---

## Phase 1: Test Infrastructure

### Directory Structure

```
src/__tests__/
├── helpers/
│   ├── mockSupabase.ts      # Chainable Supabase client mock factory
│   ├── mockRedis.ts         # Redis mock (reuses existing pattern)
│   ├── mockGemini.ts        # Gemini API mock (stream + non-stream)
│   └── mockStripe.ts        # Stripe client + webhook signature mock
├── fixtures/
│   ├── users.ts             # Test users (free/pro/admin)
│   ├── sessions.ts          # Chat session data
│   ├── messages.ts          # Message data
│   ├── documents.ts         # Document + chunk data
│   └── exams.ts             # Exam paper + mock exam data
└── setup/
    └── globalSetup.ts       # Global vi.mock registrations, env vars
```

### Mock Supabase Factory

Core: `createMockSupabase()` returns a chainable mock supporting `.from().select().eq().single()` patterns. Supports:

- Presetting return data per table
- Simulating errors
- Tracking call history (which table, which columns, which filters)

### Vitest Config Enhancements

- Add `@vitest/coverage-v8` for coverage reporting
- Set initial thresholds: statements 60%, branches 50%
- Add `npm run test:coverage` script

---

## Phase 2: Utility / Lib Tests (5-7 files)

Pure functions, no external dependencies — highest ROI.

| File               | Test Focus                                             |
| ------------------ | ------------------------------------------------------ |
| `errors.ts`        | `mapError()` for all AppError types → ActionResult     |
| `schemas.ts`       | Zod schema edge cases (empty, overflow, invalid types) |
| `sse.ts`           | SSE encoder/decoder format correctness                 |
| `ai-utils.ts`      | AI response parsing, JSON extraction                   |
| `contentParser.ts` | Already tested — add edge case coverage                |
| `rag/chunking.ts`  | Chunk size boundaries, overlap correctness             |
| `rag/retrieval.ts` | RRF ranking logic, threshold filtering                 |

---

## Phase 3: Repository Layer Tests (7-8 files)

### Pattern

Each repo test:

1. `createMockSupabase()` with preset data
2. Verify correct Supabase calls (table name, fields, conditions)
3. Verify entity mapping (DB row → domain model)
4. Verify error scenarios (Supabase error → `DatabaseError`)

### Coverage

| Repository              | Key Tests                                                |
| ----------------------- | -------------------------------------------------------- |
| SessionRepository       | CRUD, `findByUserId` pagination, share token             |
| MessageRepository       | `findBySessionId` ordering, `batchCreate`                |
| ProfileRepository       | `findById` null vs entity, `updateProfile`               |
| DocumentRepository      | Status updates, `findByUserId` filtering                 |
| DocumentChunkRepository | `createBatch` bulk insert, `deleteByDocumentId`          |
| ExamPaperRepository     | Joined queries (questions), `verifyOwnership`            |
| MockExamRepository      | `submitAnswer`, `complete` state flow, `verifyOwnership` |

Estimated: 7-8 files, 80-150 lines each.

---

## Phase 4: Service Layer Tests (9 files)

### Pattern

- Mock all Repository dependencies (constructor injection)
- Mock external APIs (Gemini, Stripe)
- Focus: business rules, boundary conditions, error handling paths

### Coverage

| Service              | Key Scenarios                                                                                  | Complexity |
| -------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| **ChatService**      | Non-stream generation, RAG context injection, mode config, retry logic, empty message handling | High       |
| **SessionService**   | CRUD, ownership (non-owner → FORBIDDEN), share token gen/verify, pagination                    | Medium     |
| **QuotaService**     | Already tested — add midnight rollover, concurrent edge cases                                  | Low        |
| **MockExamService**  | Generate from paper, generate from topic, answer judging, batch scoring                        | High       |
| **ExamPaperService** | Post-PDF creation, variant generation, CRUD + permissions                                      | Medium     |
| **DocumentService**  | Create with chunks, cascade delete, status updates                                             | Low        |
| **ProfileService**   | Update profile (simple, fast coverage)                                                         | Low        |

### ChatService Detail

4 `describe` blocks:

1. `generateResponse` — prompt construction, RAG calls, response format
2. Mode behavior — Lecture Helper returns knowledge cards, Assignment Coach no direct answers
3. Error handling — Gemini API errors → retry + fallback
4. Helpers — message history truncation, system instruction building

Estimated: 9 files, 100-300 lines each.

---

## Phase 5: Server Actions + API Routes (12 files)

### Server Actions (6 files)

Mock `requireUser()` / `requireAdmin()` + corresponding Service. Do NOT test Service internals.

| Action File        | Test Focus                                          |
| ------------------ | --------------------------------------------------- |
| `chat.ts`          | Zod schema validation, auth check, ChatService call |
| `documents.ts`     | File upload validation, size limits                 |
| `exam-papers.ts`   | Create/delete permissions, input validation         |
| `mock-exams.ts`    | Generate/submit/score flow                          |
| `admin-content.ts` | `requireAdmin()` permission check                   |
| `user.ts`          | Profile update validation                           |

### API Routes (6 files)

| Route                  | Test Focus                                             |
| ---------------------- | ------------------------------------------------------ |
| `/api/chat/stream`     | Auth, quota, SSE format                                |
| `/api/documents/parse` | Auth, request body validation                          |
| `/api/stripe/webhook`  | Signature validation, idempotency, event type handling |
| `/api/stripe/checkout` | Auth, customer creation, session response              |
| `/api/quota`           | Auth, correct quota data return                        |
| `/api/health`          | Supabase/Redis connectivity checks                     |

Estimated: 12 files, 60-150 lines each.

---

## Execution Order

| Phase | Content                                         | New Test Files | Depends On |
| ----- | ----------------------------------------------- | -------------- | ---------- |
| 1     | Infrastructure (mocks, fixtures, vitest config) | 0              | —          |
| 2     | Utility / Lib tests                             | 5-7            | Phase 1    |
| 3     | Repository tests                                | 7-8            | Phase 1    |
| 4     | Service tests                                   | 9              | Phase 1, 3 |
| 5     | Action + Route tests                            | 12             | Phase 1, 4 |

**Total: ~35 new test files**

## Coverage Targets

| Metric             | Current | Target |
| ------------------ | ------- | ------ |
| Test files         | 5       | ~40    |
| Test count         | 26      | ~300+  |
| Statement coverage | ~3%     | 60%+   |
| Branch coverage    | unknown | 50%+   |

## Conventions

- File naming: `<module>.test.ts` colocated with source
- Test structure: `describe` / `it` blocks
- Naming: `should [behavior] when [condition]`
- Setup: `beforeEach` for mocks, `afterEach` for cleanup
- No snapshot tests — prefer explicit assertions
