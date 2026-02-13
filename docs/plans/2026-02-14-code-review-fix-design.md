# Code Review Fix Design

Date: 2026-02-14
Status: Approved

## Background

Three-reviewer Agent Team audit identified ~20 issues across security, architecture, and performance. Additionally, i18n coverage is limited to marketing pages only -- authenticated app uses hardcoded English.

## Approach: Wave-Based Serial-Parallel Workflow

Tasks grouped into 4 waves by file dependency. Within each wave, teammates work in parallel on non-overlapping files using separate git worktrees. Between waves, PRs merge to main sequentially to avoid conflicts.

```
Wave 1: [security] [perf-memoize]        ← parallel, no file overlap
  ↓ merge to main
Wave 2: [architecture-refactor]           ← serial, depends on Wave 1
  ↓ merge to main
Wave 3: [rag-pipeline] [ui-bundle]        ← parallel, no file overlap
  ↓ merge to main
Wave 4: [i18n-core] [i18n-features]       ← parallel, last (touches most files)
```

## Wave 1: Security + Independent Performance (Parallel)

### 1A — security-fixer (Opus)

| ID  | Issue                              | File                   |
| --- | ---------------------------------- | ---------------------- |
| M1  | PostgREST filter injection         | ExamPaperRepository.ts |
| M5  | CSP unsafe-eval/unsafe-inline      | next.config.ts         |
| L1  | Auth callback open redirect        | auth/callback/route.ts |
| L2  | Health endpoint info disclosure    | api/health/route.ts    |
| L4  | updateDocumentMeta missing Zod     | actions/documents.ts   |
| L5  | getMockExamIdBySessionId ownership | actions/mock-exams.ts  |

Branch: `fix/security-hardening`

### 1B — perf-fixer (Sonnet)

| ID  | Issue                                 | File                 |
| --- | ------------------------------------- | -------------------- |
| P3  | sortSessions not memoized             | SessionContext.tsx   |
| P4  | extractCards on every render          | MessageList.tsx      |
| P5  | ShellClient redundant refetch         | ShellClient.tsx      |
| P8  | useKnowledgeCards streaming recompute | useKnowledgeCards.ts |
| P9  | contentParser O(n\*m) regex           | contentParser.ts     |
| P12 | TanStack Query missing staleTime      | Providers.tsx        |

Branch: `fix/perf-memoize-and-cache`

## Wave 2: Architecture Refactor (Serial, Single Teammate)

### arch-fixer (Opus)

| ID  | Issue                                 | File                                                  |
| --- | ------------------------------------- | ----------------------------------------------------- |
| A1  | Data flow violation: exam-papers      | actions/exam-papers.ts + ExamPaperService             |
| A2  | Data flow violation: admin-content    | actions/admin-content.ts + DocumentService            |
| A3  | Thick action: uploadDocument 180 LOC  | actions/documents.ts + DocumentService                |
| A4  | Upload pipeline duplication x3        | documents.ts + admin-content.ts + api/documents/parse |
| A5  | Stripe routes bypass service layer    | api/stripe/\* + ProfileService                        |
| M2  | Chunk IDOR                            | actions/documents.ts + DocumentChunkRepository        |
| M3  | regenerateEmbeddings defense-in-depth | DocumentChunkRepository                               |

Branch: `refactor/architecture-data-flow`

## Wave 3: RAG Pipeline + UI/Bundle Optimization (Parallel)

### 3A — rag-optimizer (Opus)

| ID  | Issue                                  | File                                               |
| --- | -------------------------------------- | -------------------------------------------------- |
| P1  | Embedding generation no batching       | rag/embedding.ts + api/documents/parse             |
| P2  | Parser single LLM call for all pages   | rag/parsers/lecture-parser.ts + question-parser.ts |
| P18 | Chunk query fetches embedding column   | DocumentChunkRepository.ts                         |
| P15 | MessageRepository extra session update | MessageRepository.ts                               |

Branch: `fix/rag-pipeline-optimization`

### 3B — ui-optimizer (Sonnet)

| ID    | Issue                                | File                 |
| ----- | ------------------------------------ | -------------------- |
| P6    | MarkdownRenderer KaTeX lazy load     | MarkdownRenderer.tsx |
| P7    | MessageBubble listener consolidation | MessageBubble.tsx    |
| P11   | LectureClient session rehydration    | LectureClient.tsx    |
| P13   | Marketing below-fold lazy load       | MarketingApp.tsx     |
| A-err | Error handling + any type cleanup    | Multiple files       |

Branch: `fix/ui-bundle-optimization`

## Wave 4: i18n Internationalization (Parallel, Last)

### 4A — i18n-core (Sonnet)

- Extend `src/i18n/translations.ts` with all authenticated app translation keys
- Convert Sidebar.tsx, all modal components, pricing/page.tsx

Branch: `feat/i18n-authenticated-app`

### 4B — i18n-features (Sonnet)

- Convert components/chat/_, components/rag/_, components/exam/\*
- Convert error messages in actions and services layers

Branch: `feat/i18n-feature-components`

## Execution Mechanics

### Per-Wave Flow

1. `git pull origin main` to ensure latest
2. Create worktrees: `git worktree add ../ai-uni-tutor-<name> <branch>`
3. Create Agent Team + task list
4. Spawn teammates into respective worktree directories
5. Teammates fix + run `npx vitest run` to verify
6. Team lead runs full validation: build + test + lint + typecheck
7. Create PRs via `gh pr create`
8. Merge PRs, clean worktrees: `git worktree remove`
9. Pull main, proceed to next wave

### Validation Between Waves

```bash
npm run build
npx vitest run
npm run lint
npx tsc --noEmit
```

All four must pass before proceeding to next wave.

### Model Assignment

| Wave | Teammate       | Model  | Rationale                        |
| ---- | -------------- | ------ | -------------------------------- |
| 1A   | security-fixer | Opus   | Security requires precision      |
| 1B   | perf-fixer     | Sonnet | Memoize/config changes direct    |
| 2    | arch-fixer     | Opus   | Most complex cross-file refactor |
| 3A   | rag-optimizer  | Opus   | Core business logic              |
| 3B   | ui-optimizer   | Sonnet | Clear UI optimization patterns   |
| 4A   | i18n-core      | Sonnet | High volume, fixed pattern       |
| 4B   | i18n-features  | Sonnet | High volume, fixed pattern       |

### Error Handling

| Scenario                   | Resolution                                         |
| -------------------------- | -------------------------------------------------- |
| Tests fail after fix       | SendMessage feedback to teammate, fix in worktree  |
| Unexpected file overlap    | Merge conflict-free branch first, rebase the other |
| Vercel check fails         | Fix in worktree, push to branch                    |
| Fix scope creep discovered | Record as new issue, don't expand current PR       |
| Build validation fails     | Fix in current worktree before next wave           |

## Expected Output

| Wave      | PRs   | Estimated files changed |
| --------- | ----- | ----------------------- |
| Wave 1    | 2     | ~15                     |
| Wave 2    | 1     | ~12                     |
| Wave 3    | 2     | ~12                     |
| Wave 4    | 2     | ~25                     |
| **Total** | **7** | **~60**                 |
