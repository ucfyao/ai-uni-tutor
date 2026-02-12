# AI UniTutor

## Toolchain

- Node.js version pinned via Volta (`"volta"` key in package.json)
- Developers with Volta installed get automatic version switching
- Package manager: npm (bundled with Node)

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
│   ├── actions/             # Server Actions (6 files)
│   │   ├── chat.ts          # Session CRUD, send message
│   │   ├── documents.ts     # Upload, delete documents
│   │   ├── user.ts          # Profile, language prefs
│   │   ├── exam-papers.ts   # Exam paper CRUD
│   │   ├── mock-exams.ts    # Mock exam lifecycle
│   │   └── admin-content.ts # Admin operations
│   └── api/                 # API Routes
│       ├── chat/stream/     # SSE chat streaming
│       ├── documents/parse/ # SSE document parsing
│       ├── health/          # Health check
│       ├── quota/           # Usage quota check
│       └── stripe/          # checkout + webhook
├── components/              # React components
│   ├── chat/                # Chat interface
│   ├── exam/                # Exam system
│   ├── marketing/           # Landing pages
│   ├── modes/               # Tutoring mode UIs
│   └── rag/                 # Document upload
├── context/                 # React Context (Session, Profile, Sidebar, Header)
├── hooks/                   # Custom hooks (useChatStream, useStreamingParse, etc.)
├── i18n/                    # Translation files (en + zh)
├── lib/
│   ├── domain/              # Domain models & interfaces
│   ├── rag/                 # RAG pipeline (chunking, embedding, parsers/)
│   ├── repositories/        # Data access layer (8 repos)
│   ├── services/            # Business logic (7 services)
│   ├── supabase/            # Client/server Supabase helpers
│   └── *.ts                 # Utilities (redis, contentParser, notifications, etc.)
└── types/                   # TypeScript types (database, knowledge, exam, actions)
```

## Data Flow

```
Component → Server Action → Service → Repository → Supabase
```

- **Server Actions** (`app/actions/`): thin wrappers, handle auth + validation + error mapping
- **Services** (`lib/services/`): business logic, orchestrate repositories
- **Repositories** (`lib/repositories/`): data access, raw Supabase queries
- Never call Supabase directly from components or API routes
- Auth helpers: `requireUser()` / `requireAdmin()` from `lib/supabase/server.ts`

## Environment Variables

Required (see `.env.example` for full list with comments):

| Variable                        | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public)          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role (server-only) |
| `GEMINI_API_KEY`                | Google Gemini API                   |
| `STRIPE_SECRET_KEY`             | Stripe server key                   |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook verification         |
| `STRIPE_PRO_PRICE_ID`           | Stripe Pro plan price ID            |
| `UPSTASH_REDIS_REST_URL`        | Redis for rate limiting             |
| `UPSTASH_REDIS_REST_TOKEN`      | Redis auth token                    |

Rate limiting env vars configure two layers: DDoS (proxy-level, all requests) and LLM (daily + per-window quotas). Defaults in `.env.example`.

## Database

Core tables (Supabase PostgreSQL with RLS):

- `profiles` — user info, subscription tier, preferences
- `chat_sessions` — conversations (mode, course, pinned)
- `chat_messages` — individual messages
- `documents` — uploaded PDFs
- `document_chunks` — RAG chunks with embeddings
- `exam_papers` / `mock_exams` / `mock_exam_answers` — exam system
- `stripe_events` — idempotent webhook processing

Migrations: `supabase/migrations/`. Schema changes require new migration files.

## Security

- **Auth**: `requireUser()` / `requireAdmin()` in every server action and API route
- **RLS**: All Supabase tables protected by Row Level Security
- **Input validation**: Zod schemas in server actions
- **Rate limiting**: Two-layer (DDoS proxy + LLM quota) via Upstash Redis
- **CSP**: Content-Security-Policy header in `next.config.ts` — update when adding external services
- **Security headers**: X-Frame-Options DENY, HSTS, nosniff, strict referrer (see `next.config.ts`)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to client

## CSS & Styling

Mantine is the primary UI library. Tailwind only for micro-adjustments.

**Specificity rule**: Mantine runtime CSS loads AFTER globals.css → at equal specificity, Mantine wins.

| Want to set...         | Do this                           | Not this                    |
| ---------------------- | --------------------------------- | --------------------------- |
| Text color/size/weight | `c="dimmed"` `fz="sm"` `fw={600}` | `className="text-gray-500"` |
| Spacing                | `mb="md"` `p="lg"`                | `className="mb-4 p-6"`      |
| Override Mantine       | `style={{ color: 'red' }}`        | `className="text-red-500"`  |
| Global CSS var         | `!important` in globals.css       | Without !important          |

**Breakpoint mapping**: Tailwind `sm:`(640) = Mantine `xs` · Tailwind `md:`(768) = Mantine `sm` · Tailwind `lg:`(1024) ≈ Mantine `md`(992)

**Font**: Outfit loaded via `next/font` → CSS var `--font-outfit`. Never add `@font-face` (causes FOUT).

## Components

- New UI: Mantine (`Box`, `Text`, `Title`, `Button`, `Group`, `Stack`, `SimpleGrid`)
- Shadcn/ui has been fully removed — do not reintroduce @radix-ui or components/ui/
- Icons: `lucide-react` (marketing), `@tabler/icons-react` (app)
- All user-facing text via `useLanguage()` — never hardcode strings

## Commit

`type(scope): subject` — enforced by commitlint hook.

Scopes (required): `chat` `rag` `api` `ui` `auth` `stripe` `db` `deps` `config`

Git hooks: pre-commit (lint-staged) · pre-push (build) · commit-msg (commitlint). Main branch is protected — must go through PR with Vercel check.

## Gotchas

- `.mantine-Text-root` silently resets `margin`, `padding`, `color` — Tailwind utilities on Mantine components get overridden
- `.gradient-text` needs `-webkit-text-fill-color: transparent !important` to beat Mantine color
- `Container size={1280}` not `size="lg"` — explicit pixel width for consistency
- Mantine `visibleFrom="md"` = 992px (not 768px) — use for desktop-only elements
- `min-width: 0` on flex/grid children prevents overflow (set on `.glass-card`)
- Public routes: `/`, `/zh`, `/login`, `/auth/callback`, `/share/[id]` — all others require auth
- Import order auto-enforced by Prettier: react → @mantine → @/ → ./
- ESLint uses flat config (`eslint.config.mjs`) — do not add `.eslintrc.*` files
