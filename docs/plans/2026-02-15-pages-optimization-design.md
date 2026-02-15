# Pages Optimization Design: Settings, Personalization, Help, Pricing

**Date:** 2026-02-15
**Style direction:** Clean & minimal (Linear/Notion aesthetic)

## Overview

Optimize four pages with content reorganization and visual polish. Key structural change: swap content between Settings and Personalization to create clearer separation of concerns.

## Content Migration

| From            | To              | Content                                               |
| --------------- | --------------- | ----------------------------------------------------- |
| Settings        | Personalization | Profile Information (Display Name, Email)             |
| Personalization | Settings        | Theme toggle, Language selector, Notifications toggle |

## Design Principles

- Continue using `PageShell` shared layout (Container 700, Stack gap 40)
- Paper cards: `withBorder radius="lg" p="xl"`
- Remove Avatar icon decorations — use clean title + description row layout
- All copy supports i18n (en + zh)
- Clean & minimal: more whitespace, subtle borders, clean typography

---

## 1. Settings Page

**Focus:** Preferences + Account Management

### Section A: Preferences

Single Paper card with divider-separated rows:

- **Theme** — Label + description + dark mode Switch toggle
- **Language** — Label + description + Select dropdown (English, Chinese)
- **Notifications** — Label + description + Switch toggle

Row layout: `Group justify="space-between"` with left side (title + dimmed description) and right side (control).

### Section B: Plan & Billing

Keep existing content (subscription status badge, invoice date, Stripe manage button). No visual changes needed.

### Section C: Usage & Limits

Keep existing content (LLM usage progress bar, file size badge, storage badge). No visual changes needed.

### Section D: Data & Privacy

Keep existing content (delete account danger zone). No visual changes needed.

### Removals

- Remove Profile Information section (moved to Personalization)

---

## 2. Personalization Page

**Focus:** Personal Identity + Partner Program

### Section A: Profile Information

Paper card with inline editing (no modal):

- **Display Name** — TextInput with Save button (same UX as current Settings profile section)
- **Email** — TextInput disabled, read-only with description

### Section B: Partner Program (Coming Soon)

Paper card:

- Title: "Partner Program"
- Description: "Invite friends to register and earn commission on their course purchases"
- Badge: "Coming Soon" (gray, light variant)
- Future: Application form, invite link generator, commission dashboard

### Removals

- Remove Theme toggle (moved to Settings)
- Remove Language selector (moved to Settings)
- Remove Notifications toggle (moved to Settings)
- Remove profile edit Modal (replaced with inline editing)

---

## 3. Help Page

**Focus:** Rich FAQ by category + Contact Support

### Section A: FAQ (Categorized)

Multiple Paper cards, one per category, each containing an Accordion:

**Getting Started** (BookOpen icon)

- How do I upload course materials?
- How do I start a conversation with the AI tutor?
- What file formats are supported?

**Tutoring Modes** (GraduationCap icon)

- What are the different tutoring modes?
- How do I switch between modes?
- Which mode is best for exam preparation?

**Account & Billing** (CreditCard icon)

- How do I upgrade my plan?
- How do I manage my subscription?
- How is my data handled?

**Technical** (Cpu icon)

- Which AI model is used?
- What are the usage limits?
- Which browsers are supported?

### Section B: Contact Support

Paper card with:

- Title: "Still need help?"
- Description: "Can't find what you're looking for? Reach out to our support team."
- Email link (mailto:) — placeholder email, user to provide actual address
- Clean layout: icon + text + link

---

## 4. Pricing Page

**Focus:** Course-based purchasing + Partner program entry

### Section A: Pricing Introduction

Header area (within PageShell title/subtitle):

- Title: "Pricing" / "定价"
- Subtitle: Brief explanation of the course-based pricing model

### Section B: Course Pricing Cards

Flexible card grid/list layout:

- Each card: Course name, price, feature list, purchase CTA button
- Currently: 1-2 placeholder cards with "Coming Soon" badge
- Future: Connected to actual course catalog data
- Layout: Responsive grid (1 column mobile, 2 columns desktop)

Card design:

- Paper card with subtle border
- Course name as title
- Price displayed prominently
- 3-4 feature bullet points with check icons
- CTA button at bottom

### Section C: Partner Program Entry

Paper card linking to the partner section:

- Brief intro: "Earn commission by inviting friends"
- CTA button → navigates to /personalization (partner section)
- Or: inline short description with "Learn More" link

---

## Sidebar Changes

- Keep both Personalization and Settings as separate menu items
- Keep Pricing/Upgrade entry in user menu
- No navigation structure changes needed

---

## Implementation Notes

- Profile save logic already exists in both pages — consolidate into Personalization only
- Theme/Language/Notifications controls already exist in Personalization — move to Settings
- Help FAQ content is static — just add more items, no API needed
- Pricing placeholder cards are static — no backend work needed yet
- Partner Program section is a visual placeholder — no backend integration
- All new copy needs i18n entries in `src/i18n/translations.ts`
