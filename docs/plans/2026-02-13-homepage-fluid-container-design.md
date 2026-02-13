# Homepage Fluid Container Design

**Date**: 2026-02-13
**Status**: Approved

## Problem

The homepage uses a fixed `Container size={1280}` across all marketing sections. On screens wider than ~1328px (e.g., standard 1920x1080), content only occupies 67% of the screen, leaving 320px of empty space on each side. This makes the layout feel cramped and underutilized.

## Solution

Replace the fixed 1280px max-width with a fluid container: `min(90vw, 1600px)`.

### Width Behavior by Screen Size

| Screen Width | Content Width | Utilization |
| ------------ | ------------- | ----------- |
| 768px        | 691px         | 90%         |
| 1024px       | 922px         | 90%         |
| 1280px       | 1152px        | 90%         |
| 1440px       | 1296px        | 90%         |
| 1920px       | 1600px (cap)  | 83%         |
| 2560px       | 1600px (cap)  | 63%         |

### Implementation

**Scoped via CSS** — only affects marketing pages, not the app's protected routes.

#### 1. `globals.css` — Add CSS variable + scoped rule

```css
:root {
  --marketing-container: min(90vw, 1600px);
}

.marketing-app .mantine-Container-root {
  max-width: var(--marketing-container) !important;
}
```

#### 2. `MarketingApp.tsx` — Add scope class

Add `marketing-app` to the root Box's className.

### Files Changed

| File                                        | Change                                |
| ------------------------------------------- | ------------------------------------- |
| `src/app/globals.css`                       | Add CSS variable + scoped rule        |
| `src/components/marketing/MarketingApp.tsx` | Add `marketing-app` class to root Box |

### Files NOT Changed

All 7 marketing section components (HeroSection, FeaturesSection, HowItWorksSection, TestimonialsSection, CTASection, Navbar, Footer) — their `Container size={1280} px={24}` is automatically overridden by the CSS scope rule.

### Design Decisions

- **90vw**: Provides natural 5% margin on each side, scales smoothly
- **1600px cap**: Prevents content from becoming too wide on ultrawide monitors, maintaining readability
- **CSS scope via `.marketing-app`**: Isolates the change to marketing pages; app dashboard/chat pages are unaffected
- **`!important`**: Required because Mantine's `size` prop sets inline `max-width`, which has higher specificity than class selectors
- **HeroSection inner constraint**: The `max-w-4xl` (896px) on hero text content is preserved, maintaining readability regardless of container width
- **SimpleGrid columns**: Automatically benefit from wider container — each column gets proportionally more space
- **Mobile/tablet unaffected**: `90vw` at small widths is already less than 1280px, so the original `size={1280}` was never the constraint on mobile
