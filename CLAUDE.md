# AI UniTutor

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
- i18n: `useLanguage()` hook — English + Chinese

## Data Flow

```
Component → Server Action → Service → Repository → Supabase
```

- **Server Actions** (`app/actions/`): thin wrappers, handle auth + validation + error mapping
- **Services** (`lib/services/`): business logic, orchestrate repositories
- **Repositories** (`lib/repositories/`): data access, raw Supabase queries
- Never call Supabase directly from components or API routes
- Auth helpers: `requireUser()` / `requireAdmin()` from `lib/supabase/server.ts`

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
