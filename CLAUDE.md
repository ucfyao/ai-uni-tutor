# AI UniTutor - Development Guide

## Commands

- Build: `npm run build`
- Dev: `npm run dev`
- Test: `npx vitest run`
- Lint: `npm run lint`
- Format: `npm run format`
- Type check: `npx tsc --noEmit`

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, Turbopack)
- **UI**: Mantine v8 (primary) + Tailwind CSS v4 (utility/micro-adjustments)
- **Auth**: Supabase SSR (`src/lib/supabase/middleware.ts`)
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini (`src/lib/gemini.ts`)
- **Payments**: Stripe (`src/lib/stripe.ts`)
- **State**: React Context + TanStack Query
- **i18n**: Custom context (`src/i18n/`) — English + Chinese

## Architecture

```
src/
├── app/(public)/          # Unauthenticated: /, /zh, /login, /auth, /share
├── app/(protected)/       # Authenticated: /study, /exam, /knowledge, /admin, ...
├── app/api/               # API routes: chat/stream, quota, stripe
├── app/actions/           # Server actions
├── lib/services/          # Business logic (ChatService, ExamPaperService, etc.)
├── lib/repositories/      # Data access (SessionRepository, DocumentRepository, etc.)
├── lib/domain/            # Domain models and interfaces
├── lib/rag/               # RAG pipeline: chunking, embedding, retrieval
├── components/marketing/  # Landing page sections
├── components/chat/       # Chat interface
├── components/exam/       # Exam components
├── components/ui/         # Shadcn/ui primitives (legacy, still used by some features)
└── components/modes/      # Study mode components
```

**Pattern**: Service/Repository — Services handle business logic, Repositories handle DB queries. Never call Supabase directly from components or API routes.

## CSS & Styling Rules

Mantine is the primary UI library. Tailwind is only for micro-adjustments.

**CSS Specificity (critical)**:

- Mantine runtime CSS (`MantineProvider` injects `<style>`) loads AFTER `globals.css`
- At equal specificity, Mantine always wins over Tailwind
- `.mantine-Text-root` and `.mantine-Title-root` reset `margin`, `padding`, and `color`
- Tailwind color/margin/padding utilities on Mantine components will be overridden silently

**How to handle**:

- Use Mantine props (`c="dimmed"`, `fz="sm"`, `fw={600}`, `mb="md"`) instead of Tailwind classes for typography
- For values Mantine can't express, use `style={{}}` (inline styles beat all CSS classes)
- In `globals.css`, use `!important` to override Mantine runtime variables
- `--mantine-color-text`, `--mantine-color-dimmed`, `--mantine-color-body` are aligned to our design tokens in `globals.css` with `!important`

**Gradient text**: `.gradient-text` uses `-webkit-text-fill-color: transparent` with `!important` to beat Mantine's `color` override.

**Breakpoint mapping**:

- Tailwind `sm:` (640px) = Mantine `xs`
- Tailwind `md:` (768px) = Mantine `sm`
- Tailwind `lg:` (1024px) ~ Mantine `md` (992px)

**Font loading**: Outfit is loaded via `next/font/local` in `layout.tsx` with CSS variable `--font-outfit`. Do NOT add `@font-face` in `globals.css` — it causes FOUT (flash of unstyled text).

## Component Guidelines

- New components: use Mantine (`Box`, `Text`, `Title`, `Button`, `Group`, `Stack`, `SimpleGrid`, `Container`)
- `components/ui/` (Shadcn): legacy, still used by sidebar, pagination, carousel — do not add new Shadcn components
- Marketing sections: all use Mantine + custom CSS classes (`glass-card`, `gradient-text`, `btn-hero`)
- Icons: `lucide-react` for marketing, `@tabler/icons-react` for app UI
- All user-facing text must go through `useLanguage()` hook — never hardcode Chinese or English strings

## Commit Convention

Format: `type(scope): subject`

**Types**: feat, fix, docs, style, refactor, perf, test, chore, revert, build, ci
**Scopes** (required): chat, rag, api, ui, auth, stripe, db, deps, config

Enforced by commitlint via Husky `commit-msg` hook.

## Git Hooks (Husky)

- `pre-commit`: lint-staged (ESLint --fix + Prettier on staged files)
- `pre-push`: `npm run build` (full build must pass before push)
- `commit-msg`: commitlint (validates conventional commit format)

## Import Order

Enforced by Prettier plugin — do not manually reorder:

1. `react`
2. `@mantine/*`
3. `@/*` (project aliases)
4. `./` (relative imports)

## Auth & Routing

- Public routes: `/`, `/zh`, `/login`, `/auth/callback`, `/share/[id]`
- All other routes require Supabase auth (enforced in middleware)
- Auth check: `src/lib/supabase/middleware.ts` → `handleRequest()`

## Known Gotchas

- `Container size={1280}` not `size="lg"` — we use explicit pixel width for consistency
- Mantine `visibleFrom="md"` = 992px, use for desktop-only elements (not `"sm"`)
- `min-width: 0` on flex/grid children prevents overflow — already set on `.glass-card`
- `box-sizing: border-box` is NOT default on all custom CSS classes — add it explicitly
- `@supports` fallback exists for `.gradient-text` in browsers without `background-clip: text`
