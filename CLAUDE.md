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
