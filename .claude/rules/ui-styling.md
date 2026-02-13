---
paths:
  - 'src/components/**'
  - 'src/app/**/page.tsx'
  - 'src/app/**/layout.tsx'
  - 'src/app/globals.css'
---

# UI & Styling

Mantine is the primary UI library. Tailwind only for micro-adjustments.

## Mantine vs Tailwind

Mantine runtime CSS loads AFTER globals.css — at equal specificity, Mantine wins.

| Want to set...         | Do this                           | Not this                    |
| ---------------------- | --------------------------------- | --------------------------- |
| Text color/size/weight | `c="dimmed"` `fz="sm"` `fw={600}` | `className="text-gray-500"` |
| Spacing                | `mb="md"` `p="lg"`                | `className="mb-4 p-6"`      |
| Override Mantine       | `style={{ color: 'red' }}`        | `className="text-red-500"`  |
| Global CSS var         | `!important` in globals.css       | Without !important          |

## Breakpoints

Tailwind `sm:`(640) = Mantine `xs` · Tailwind `md:`(768) = Mantine `sm` · Tailwind `lg:`(1024) ≈ Mantine `md`(992)

Mantine `visibleFrom="md"` = 992px (not 768px) — use for desktop-only elements.

## Components

- Mantine primitives: `Box`, `Text`, `Title`, `Button`, `Group`, `Stack`, `SimpleGrid`
- `Container size={1280}` not `size="lg"` — explicit pixel width
- Icons: `lucide-react` (marketing), `@tabler/icons-react` (app)
- All user-facing text via `useLanguage()` — never hardcode strings

## CSS Gotchas

- `.mantine-Text-root` silently resets `margin`, `padding`, `color` — Tailwind utilities on Mantine components get overridden
- `.gradient-text` needs `-webkit-text-fill-color: transparent !important` to beat Mantine color
- `min-width: 0` on flex/grid children prevents overflow (set on `.glass-card`)
- Font: Outfit via `next/font` → CSS var `--font-outfit`. Never add `@font-face` (causes FOUT)
