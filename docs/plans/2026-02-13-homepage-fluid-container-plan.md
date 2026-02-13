# Homepage Fluid Container Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Widen the homepage container from fixed 1280px to fluid `min(90vw, 1600px)` so content better utilizes large screens.

**Architecture:** CSS-only approach scoped to marketing pages via a `.marketing-app` wrapper class. Mantine Container's inline `max-width` is overridden with `!important`. No component-level changes needed beyond adding the scope class.

**Tech Stack:** CSS custom properties, Mantine Container, Next.js

**Design doc:** `docs/plans/2026-02-13-homepage-fluid-container-design.md`

---

### Task 1: Add CSS variable and scoped container rule

**Files:**

- Modify: `src/app/globals.css:4-5` (add variable to `:root`)
- Modify: `src/app/globals.css:688` (add scoped rule before `.glass-card`)

**Step 1: Add CSS variable to `:root` block**

In `src/app/globals.css`, add to the existing `:root` block (after line 5):

```css
--marketing-container: min(90vw, 1600px);
```

**Step 2: Add scoped container override**

Before the `.glass-card` rule (line 688), add:

```css
/* Marketing homepage: fluid container width */
.marketing-app .mantine-Container-root {
  max-width: var(--marketing-container) !important;
}
```

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style(ui): add fluid container CSS for marketing pages"
```

---

### Task 2: Add scope class to MarketingApp

**Files:**

- Modify: `src/components/marketing/MarketingApp.tsx:19`

**Step 1: Add `marketing-app` class**

Change line 19 from:

```tsx
<Box className="min-h-screen bg-background overflow-x-hidden">
```

to:

```tsx
<Box className="marketing-app min-h-screen bg-background overflow-x-hidden">
```

**Step 2: Commit**

```bash
git add src/components/marketing/MarketingApp.tsx
git commit -m "style(ui): scope fluid container to marketing pages"
```

---

### Task 3: Visual verification

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Verify in browser**

Open `http://localhost:3000` and check:

- [ ] Content area is wider than before (should be ~1600px on 1920px screen)
- [ ] Navbar, Hero, Features, How It Works, Testimonials, CTA, Footer all use wider container
- [ ] Hero text still centered and readable (constrained by its own `max-w-4xl`)
- [ ] Mobile view (< 768px) unchanged
- [ ] Navigate to a protected page (e.g., `/chat`) — verify it is NOT affected by the wider container

**Step 3: Run build to ensure no regressions**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.
