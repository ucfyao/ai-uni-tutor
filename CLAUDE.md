# AI UniTutor

## Toolchain

- Node.js pinned via Volta (`package.json` → `"volta"`)
- Package manager: npm

## Commands

- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npx vitest run`
- Test single: `npx vitest run path/to/file.test.ts`
- Lint: `npm run lint`
- Format: `npm run format`
- Type check: `npx tsc --noEmit`

## Tech Stack

- Next.js 16 (App Router, React 19) + Mantine v8 + Tailwind CSS v4
- Supabase (auth SSR + PostgreSQL) + Google Gemini + Stripe
- TanStack Query for async state, React Context for app state
- Upstash Redis for rate limiting (DDoS + LLM quota)
- i18n: `useLanguage()` hook — English + Chinese

## Project Structure

```
src/
├── app/
│   ├── (protected)/         # Auth-required routes
│   ├── (public)/            # Public routes (/, /zh, /login)
│   ├── actions/             # Server Actions (7 files)
│   └── api/                 # API Routes (chat/stream, documents/parse, health, quota, stripe)
├── components/              # chat/, exam/, marketing/, modes/, rag/
├── context/                 # React Context (Session, Profile, Sidebar, Header)
├── hooks/                   # useChatStream, useStreamingParse, etc.
├── i18n/                    # Translation files (en + zh)
├── lib/
│   ├── domain/              # Domain models & interfaces
│   ├── rag/                 # RAG pipeline (chunking, embedding, parsers/)
│   ├── repositories/        # Data access layer (11 repos)
│   ├── services/            # Business logic (8 services)
│   ├── supabase/            # Client/server Supabase helpers
│   └── *.ts                 # Utilities (redis, errors, notifications, etc.)
└── types/                   # TypeScript types (database, knowledge, exam, actions)
```

## Data Flow

```
Component → Server Action → Service → Repository → Supabase
```

- **Actions** (`app/actions/`): thin wrappers — auth + Zod validation + error mapping
- **Services** (`lib/services/`): business logic, orchestrate repositories
- **Repositories** (`lib/repositories/`): data access, raw Supabase queries
- Never call Supabase directly from components or API routes

## Commit

`type(scope): subject` — enforced by commitlint hook.

Scopes: `chat` `rag` `api` `ui` `auth` `stripe` `db` `deps` `config`

Git hooks: pre-commit (lint-staged) · pre-push (build) · commit-msg (commitlint). Main branch is protected — must go through PR with Vercel check.

## Pre-Commit / Pre-Push Verification

Before every commit and push, run **all four checks** in order. Do NOT skip any step. Do NOT create a PR until all pass.

```bash
npm run lint          # 1. Lint — must be 0 errors
npx vitest run        # 2. Test — must be 0 failures
npx tsc --noEmit      # 3. Type check — must be 0 errors
npm run build         # 4. Build — must succeed
```

If any check fails, fix the issue before proceeding. This is mandatory — no exceptions.

## UI/CSS Changes

- Before making any CSS/layout change, identify the root cause — do NOT trial-and-error CSS adjustments
- Describe what will change (which CSS properties, before → after values) and wait for approval BEFORE editing
- For responsive layout work, check all breakpoints (mobile <768px, tablet 768-1024px, desktop >1024px) in a single pass
- Never revert or remove code the user hasn't explicitly asked to remove
- If the user says something looks wrong, ask for specifics (which element, current vs desired appearance) — do NOT guess

## Sub-Agent / Team Workflow

- When spawning sub-agents for code changes, explicitly grant Edit, Write, and Bash permissions
- If a sub-agent fails with permission errors, retry with Bash-based file operations as fallback
- Verify sub-agent outputs (lint, type-check) before marking tasks complete
- For large plans (10+ tasks), execute in waves of 5 — verify each wave before starting the next
- Implement backend first (API/service layer), then frontend — do NOT run backend and frontend sub-agents in parallel unless APIs are already stable

## Key Rules

- Public routes: `/`, `/zh`, `/login`, `/auth/callback`, `/share/[id]` — all others require auth
- ESLint flat config (`eslint.config.mjs`) — do not add `.eslintrc.*` files
- Import order auto-enforced by Prettier: react → @mantine → @/ → ./
- Shadcn/ui removed — do not reintroduce @radix-ui or components/ui/
- Path-specific rules in `.claude/rules/` — see individual files for CSS, security, data layer, API, and testing conventions

## Architecture Decisions

- **Knowledge cards:** DB-backed tables (`knowledge_cards`, `user_cards`, `card_conversations`), not LLM-generated. Populated at document upload via Gemini extraction, retrieved at chat time via pgvector embedding similarity. (#128)
- **Document upload pipeline:** LLM-powered parsing by doc type — lecture → knowledge points, exam/assignment → structured questions. SSE streaming for progress. (`DocumentProcessingService`)
- **Mock exam sources:** 3 modes — Real Exam (from paper), Random Mix (shuffle across papers), AI Mock (AI-generated). Mode stored in `mock_exams.mode` column at creation. (#116)
- **Pricing model:** Free vs Pro subscription with monthly/semester billing toggle. Stripe Checkout for payment, Stripe Portal for management. (#117)
- **Settings vs Personalization split:** Personalization = profile + account overview + partner program + data/privacy. Settings = theme/language preferences + plan/billing + usage limits. (#118, #119)
- **Environment variables:** Centralized via `src/lib/env.ts` — single source of truth, validated at import. (#129)
- **FullScreenModal pattern:** `src/components/FullScreenModal.tsx` wraps Mantine `Modal` — auto-fullscreen with slide-up on mobile (<768px via `useIsMobile`). All 6 app modals use it. New modals must use `FullScreenModal` instead of `Modal`. (#138)
- **Toast system:** `showNotification()` from `src/lib/notifications.ts` — throttled wrapper (2s dedup). Shared i18n keys in `t.toast.*` namespace. Use for all user feedback. (#138)
- **UI/UX polish (full frontend):** Page-by-page improvements across study, chat, exam, knowledge, settings/pricing/help/personalization, landing/login. Design doc in `docs/plans/2026-02-16-uiux-improvement-design.md`. (#136-#144)
