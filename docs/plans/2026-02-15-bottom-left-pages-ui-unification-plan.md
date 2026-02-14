# Bottom-Left Pages UI Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify Settings, Personalization, Help, and Pricing pages to a consistent left-aligned compact layout with shared PageShell component, skeleton loading states, and mobile header integration.

**Architecture:** Create a reusable `PageShell` client component that wraps page content with consistent Container/Stack/Title layout and syncs the page title to the mobile header via `HeaderContext`. Each page adopts PageShell and gets a dedicated `loading.tsx` with Skeleton placeholders.

**Tech Stack:** Next.js App Router, Mantine v8 (Container, Stack, Title, Text, Skeleton), React (useMemo, useEffect), HeaderContext

---

### Task 1: Create PageShell Component

**Files:**

- Create: `src/components/PageShell.tsx`

**Step 1: Create the PageShell component**

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Box, Container, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useHeader } from '@/context/HeaderContext';

interface PageShellProps {
  title: string;
  subtitle?: string;
  mobileTitle?: string;
  children: React.ReactNode;
}

export function PageShell({ title, subtitle, mobileTitle, children }: PageShellProps) {
  const { setHeaderContent } = useHeader();
  const isMobile = useMediaQuery('(max-width: 48em)', false);

  const headerNode = useMemo(
    () => (
      <Text fw={650} size="md" c="dark.8" truncate>
        {mobileTitle || title}
      </Text>
    ),
    [title, mobileTitle],
  );

  useEffect(() => {
    if (isMobile) {
      setHeaderContent(headerNode);
    } else {
      setHeaderContent(null);
    }
    return () => setHeaderContent(null);
  }, [isMobile, headerNode, setHeaderContent]);

  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Title order={1} fz={28} fw={700} mb="xs">
            {title}
          </Title>
          {subtitle && (
            <Text c="dimmed" fz="md">
              {subtitle}
            </Text>
          )}
        </Box>
        {children}
      </Stack>
    </Container>
  );
}
```

**Step 2: Verify no lint errors**

Run: `npx eslint src/components/PageShell.tsx`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/PageShell.tsx
git commit -m "feat(ui): add PageShell shared layout component"
```

---

### Task 2: Migrate Settings Page

**Files:**

- Modify: `src/app/(protected)/settings/page.tsx`
- Create: `src/app/(protected)/settings/loading.tsx`

**Step 1: Add loading.tsx for Settings**

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function SettingsLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={140} radius="lg" />
        <Skeleton h={280} radius="lg" />
        <Skeleton h={200} radius="lg" />
        <Skeleton h={80} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 2: Update Settings page to use PageShell**

In `src/app/(protected)/settings/page.tsx`:

- Add import: `import { PageShell } from '@/components/PageShell';`
- Replace the loading skeleton block (lines 84-93) — keep the inline skeleton as-is since it handles the data-loading state (not route-loading). The new `loading.tsx` handles route transitions.
- Replace the outer `<Container size={700} py={60}>` / `<Stack gap={40}>` / header `<Box>` with:

```tsx
<PageShell title="Settings" subtitle="Manage your account and subscription preferences">
  {/* Profile Section — keep as-is */}
  <Paper withBorder p="xl" radius="lg">...</Paper>
  {/* Plan & Billing — keep as-is */}
  <Paper withBorder p={0} radius="lg" ...>...</Paper>
  {/* Usage & Limits — keep as-is */}
  <Paper withBorder p="xl" radius="lg">...</Paper>
  {/* Data & Privacy — keep as-is */}
  <Box>...</Box>
</PageShell>
```

- Remove the manual `<Title order={1} fz={32} fw={800}>Settings</Title>` and subtitle `<Text>` — PageShell handles this.
- Also update the inline loading skeleton to use PageShell-consistent container:

```tsx
if (loading || profileLoading) {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={140} radius="lg" />
        <Skeleton h={280} radius="lg" />
        <Skeleton h={200} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 3: Verify**

Run: `npx eslint src/app/\(protected\)/settings/page.tsx src/app/\(protected\)/settings/loading.tsx`
Expected: No errors

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/settings/page.tsx src/app/\(protected\)/settings/loading.tsx
git commit -m "refactor(ui): migrate Settings page to PageShell layout"
```

---

### Task 3: Migrate Personalization Page

**Files:**

- Modify: `src/app/(protected)/personalization/page.tsx`
- Create: `src/app/(protected)/personalization/loading.tsx`

**Step 1: Add loading.tsx for Personalization**

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function PersonalizationLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={320} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 2: Update Personalization page to use PageShell**

In `src/app/(protected)/personalization/page.tsx`:

- Add import: `import { PageShell } from '@/components/PageShell';`
- Replace the outer `<Container size={700} py={60}>` / `<Stack gap={40}>` / header `<Box>` with:

```tsx
return (
  <>
    <Modal ...>...</Modal>
    <PageShell title="Personalization" subtitle="Customize your AI Tutor experience">
      <Paper withBorder p="xl" radius="lg">
        {/* All the preference rows — keep as-is */}
      </Paper>
    </PageShell>
  </>
);
```

- Remove the manual Title and subtitle Text — PageShell handles this.
- Remove `Container`, `Stack`, and header `Box` imports if no longer used.

**Step 3: Verify**

Run: `npx eslint src/app/\(protected\)/personalization/page.tsx src/app/\(protected\)/personalization/loading.tsx`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/personalization/page.tsx src/app/\(protected\)/personalization/loading.tsx
git commit -m "refactor(ui): migrate Personalization page to PageShell layout"
```

---

### Task 4: Migrate Help Page

**Files:**

- Modify: `src/app/(protected)/help/page.tsx`
- Create: `src/app/(protected)/help/loading.tsx`

**Step 1: Add loading.tsx for Help**

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function HelpLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={60} radius="lg" />
        <Skeleton h={60} radius="lg" />
        <Skeleton h={60} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 2: Rewrite Help page to use PageShell**

This is the most significant change. The current centered hero layout (big icon, 48px title, search bar) is replaced with PageShell's left-aligned layout.

```tsx
'use client';

import { FileText, GraduationCap, Sparkles } from 'lucide-react';
import { Accordion, Paper, Stack, Text } from '@mantine/core';
import { PageShell } from '@/components/PageShell';

export default function HelpPage() {
  return (
    <PageShell
      title="Help"
      subtitle="Browse frequently asked questions to find the answers you need"
    >
      <Paper withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Text fw={600} fz="lg">
            Frequently Asked Questions
          </Text>
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="upload">
              <Accordion.Control icon={<FileText size={20} />}>
                How do I upload course materials?
              </Accordion.Control>
              <Accordion.Panel>
                You can upload PDF documents (syllabus, notes, etc.) directly in the chat interface
                or through the &quot;Knowledge Base&quot; section in the sidebar. Simply drag and
                drop your files or click to select them.
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="modes">
              <Accordion.Control icon={<GraduationCap size={20} />}>
                What are the different tutoring modes?
              </Accordion.Control>
              <Accordion.Panel>
                AI Tutor offers several modes: &quot;Lecture Helper&quot; for understanding
                concepts, &quot;Assignment Coach&quot; for help with tasks, and &quot;Exam
                Prep&quot; for study sessions. You can switch modes in the session settings.
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="ai">
              <Accordion.Control icon={<Sparkles size={20} />}>
                Which AI model is used?
              </Accordion.Control>
              <Accordion.Panel>
                We utilize advanced models like Gemini 2.0 to provide the best possible tutoring
                experience.
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      </Paper>
    </PageShell>
  );
}
```

Key changes:

- Removed: `HelpCircle` icon, centered hero, search bar, `Title order={2}`, double Container nesting
- Added: `PageShell` wrapper, `Paper withBorder` card around FAQ
- Kept: All FAQ accordion content unchanged
- Accordion variant stays `separated`, radius changed from `lg` to `md` for consistency inside the Paper card

**Step 3: Verify**

Run: `npx eslint src/app/\(protected\)/help/page.tsx src/app/\(protected\)/help/loading.tsx`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/help/page.tsx src/app/\(protected\)/help/loading.tsx
git commit -m "refactor(ui): migrate Help page to PageShell layout"
```

---

### Task 5: Migrate Pricing Page

**Files:**

- Modify: `src/app/(protected)/pricing/page.tsx`
- Create: `src/app/(protected)/pricing/loading.tsx`

**Step 1: Add loading.tsx for Pricing**

```tsx
import { Box, Container, Skeleton, Stack } from '@mantine/core';

export default function PricingLoading() {
  return (
    <Container size={700} py={60}>
      <Stack gap={40}>
        <Box>
          <Skeleton h={28} w={200} mb="xs" />
          <Skeleton h={16} w={350} />
        </Box>
        <Skeleton h={400} radius="lg" />
      </Stack>
    </Container>
  );
}
```

**Step 2: Update Pricing page to use PageShell**

In `src/app/(protected)/pricing/page.tsx`:

- Add import: `import { PageShell } from '@/components/PageShell';`
- Replace the outer `<Container size="lg" py={80}>` / centered hero section with PageShell.
- Keep the pricing Card content intact (violet gradient, features list, checkout button).

```tsx
return (
  <PageShell title={t.pricing.title} subtitle={t.pricing.subtitle}>
    <Card
      withBorder
      radius="xl"
      p="xl"
      style={{
        border: '2px solid var(--mantine-color-violet-2)',
        background: 'linear-gradient(135deg, white 0%, #f5f3ff 100%)',
      }}
    >
      <Stack gap="xl">
        {/* Keep all existing card content as-is */}
        <Group justify="space-between" align="flex-start">
          ...
        </Group>
        <List ...>...</List>
        <Button ...>{t.pricing.getStarted}</Button>
        <Text size="xs" c="dimmed" ta="center">
          {t.pricing.securePayment}
        </Text>
      </Stack>
    </Card>
  </PageShell>
);
```

Key changes:

- Removed: outer `Container size="lg" py={80}`, centered hero Stack (Badge, 48px Title, subtitle), inner `Container size="sm"`
- Added: `PageShell` with translated title/subtitle
- Kept: Pricing Card with violet gradient, features list, checkout button — all unchanged

**Step 3: Verify**

Run: `npx eslint src/app/\(protected\)/pricing/page.tsx src/app/\(protected\)/pricing/loading.tsx`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/pricing/page.tsx src/app/\(protected\)/pricing/loading.tsx
git commit -m "refactor(ui): migrate Pricing page to PageShell layout"
```

---

### Task 6: Final Verification & Type Check

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 2: Run lint on all changed files**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Visual verification checklist**

Run: `npm run dev`

Check each page in browser:

- [ ] `/settings` — Left-aligned title "Settings", subtitle below, cards stacked with consistent spacing
- [ ] `/personalization` — Left-aligned title "Personalization", preference card
- [ ] `/help` — Left-aligned title "Help", FAQ in Paper card
- [ ] `/pricing` — Left-aligned title (translated), violet pricing card below
- [ ] Mobile (< 768px): Each page shows title in mobile header bar
- [ ] Loading states: Navigate to each page and verify skeleton appears during route transitions

**Step 5: Commit any fixes if needed, then final commit**

```bash
git add -A
git commit -m "refactor(ui): complete bottom-left pages UI unification"
```
