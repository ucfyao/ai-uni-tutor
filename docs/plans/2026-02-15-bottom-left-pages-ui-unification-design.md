# Bottom-Left Pages UI Unification Design

**Date:** 2026-02-15
**Scope:** Settings, Personalization, Help, Pricing pages
**Status:** Approved

## Problem

The 4 pages accessible from the sidebar bottom-left user dropdown (Settings, Personalization, Help, Pricing) have inconsistent layouts, title styles, container sizes, loading states, and mobile header behavior.

| Page            | Container    | Padding   | Title Style       | Loading           | Mobile Header |
| --------------- | ------------ | --------- | ----------------- | ----------------- | ------------- |
| Settings        | `size={700}` | `py={60}` | Left 32px/800     | Skeleton inline   | Not synced    |
| Personalization | `size={700}` | `py={60}` | Left 32px/800     | "Loading..." text | Not synced    |
| Help            | `size="lg"`  | `py={80}` | Centered 48px/900 | None              | Not synced    |
| Pricing         | `size="lg"`  | `py={80}` | Centered 48px/900 | None              | Not synced    |

## Decision

Unify all 4 pages to a **left-aligned compact layout** with a shared `PageShell` component. Rationale:

- Pages live inside the app shell (sidebar visible, user authenticated) — centered marketing layouts feel misplaced
- All are utility/settings pages from user dropdown — not public landing pages
- Left-aligned is more scannable and consistent with the "inside the app" mental model

## Design

### PageShell Component

New file: `src/components/PageShell.tsx`

```tsx
interface PageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  mobileTitle?: string;
}
```

Renders:

- `Container size={700} py={60}` — centered, narrow for readability
- `Stack gap={40}` — consistent vertical rhythm between sections
- Page header: `Title order={1} fz={28} fw={700}` + optional `Text c="dimmed" fz="md"` subtitle
- Mobile: uses `HeaderContext` to sync `mobileTitle || title` to AppShell header bar
- `children` — page-specific content

### Per-Page Changes

**Settings** (minimal):

- Replace `Container`/`Stack`/header `Box` with `<PageShell title="Settings" subtitle="...">`
- Extract inline skeleton to `loading.tsx`
- Title adjusts from fz=32/fw=800 to fz=28/fw=700 (via PageShell)

**Personalization** (minimal):

- Replace `Container`/`Stack`/header `Box` with `<PageShell>`
- Title adjusts similarly
- Content cards already use `Paper withBorder radius="lg"`

**Help** (moderate):

- Remove centered hero layout (big icon, 48px title, search bar hero)
- Wrap in `<PageShell title="Help" subtitle="...">`
- Keep FAQ accordion content, optionally wrap in `Paper` for card consistency
- Remove double-nested `Container size="sm"` (PageShell's 700px handles width)

**Pricing** (moderate):

- Remove centered hero (badge, 48px title, centered subtitle)
- Wrap in `<PageShell title="Upgrade to Plus" subtitle="...">`
- Keep violet gradient pricing card as-is inside PageShell

### Loading States

Each page gets a `loading.tsx` using Mantine `Skeleton` with pulse animation:

```tsx
<Container size={700} py={60}>
  <Stack gap={40}>
    <Box>
      <Skeleton h={28} w={200} mb="xs" />
      <Skeleton h={16} w={350} />
    </Box>
    <Skeleton h={200} radius="lg" />
    <Skeleton h={150} radius="lg" />
  </Stack>
</Container>
```

Card count/heights vary per page to approximate actual content shape.

### Mobile Header Integration

`PageShell` calls `useHeader()` from `HeaderContext` on mount to set the mobile header title. Ensures navigation to any of these pages shows the correct title in the mobile AppShell header bar.

### Unified Standards (After)

| Element       | Standard                                   |
| ------------- | ------------------------------------------ |
| Container     | `size={700}`, centered                     |
| Padding       | `py={60}`                                  |
| Title         | `order=1 fz={28} fw={700}`                 |
| Subtitle      | `c="dimmed" fz="md"`                       |
| Section gap   | `gap={40}`                                 |
| Content cards | `Paper withBorder radius="lg" p="xl"`      |
| Loading       | Per-page `loading.tsx` with Skeleton pulse |
| Mobile header | Synced via HeaderContext                   |

## Files Changed

- **New:** `src/components/PageShell.tsx`
- **New:** `src/app/(protected)/settings/loading.tsx`
- **New:** `src/app/(protected)/personalization/loading.tsx`
- **New:** `src/app/(protected)/help/loading.tsx`
- **New:** `src/app/(protected)/pricing/loading.tsx`
- **Modified:** `src/app/(protected)/settings/page.tsx`
- **Modified:** `src/app/(protected)/personalization/page.tsx`
- **Modified:** `src/app/(protected)/help/page.tsx`
- **Modified:** `src/app/(protected)/pricing/page.tsx`
