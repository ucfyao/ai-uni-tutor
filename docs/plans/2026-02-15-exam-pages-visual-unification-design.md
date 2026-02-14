# Exam Pages Visual Unification Design

**Date**: 2026-02-15
**Scope**: Visual-only changes to all exam pages — no functional changes
**Reference**: Knowledge page (Notion-style redesign) as the design language source

## Goal

Align all exam pages (`/exam`, `/exam/mock/[id]`, `/exam/history`) and shared components (`QuestionCard`, `FeedbackCard`) with the design language established in the Knowledge page.

## Design Language Reference (Knowledge Page)

| Token             | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Title             | `order={2} fw={700} letterSpacing: '-0.02em'`                  |
| Subtitle          | `Text c="dimmed" size="md" fw={400} mt={2}`                    |
| Card border       | `borderColor: 'var(--mantine-color-gray-2)'`                   |
| Card shadow       | `boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'`                   |
| Card radius       | `radius="lg"`                                                  |
| Container padding | `py={48}`                                                      |
| Background glow   | Radial gradient `indigo-0 → transparent`, centered, 120% width |
| Entry animations  | `animate-fade-in-up` + staggered `animate-delay-{100,200,...}` |
| Empty state       | Icon circle 72x72 + centered text + action button              |

## Changes by Page

### 1. Exam Entry Page (`/exam` + `ExamEntryClient`)

**page.tsx:**

- Add radial gradient background glow (same as Knowledge `page.tsx`)
- Wrap `ExamEntryClient` in `Box` with `position: relative; zIndex: 1`

**ExamEntryClient.tsx:**

- Header: `Title order={1} fw={800}` → `Title order={2} fw={700} letterSpacing: '-0.02em'`
- Subtitle: `Text size="lg"` → `Text c="dimmed" size="md" fw={400} mt={2}`
- Buttons: Add `radius="md"` to action buttons
- Paper Bank two-column section: Wrap in `Card withBorder radius="lg" p={0}` with shadow
- Empty state: Restyle to Knowledge pattern (icon circle + centered text)
- Recent Mock Exams cards: Add `boxShadow` + `borderColor: gray-2`
- Animations: Add `animate-fade-in-up` with staggered delays to each section

### 2. MockExam Page (`/exam/mock/[id]` + `MockExamClient`)

**page.tsx:**

- Add radial gradient background glow

**MockExamClient.tsx:**

- Container: `py={32}` → `py={48}`
- Header: Replace `Text size="sm"` with `Title order={2} fw={700} letterSpacing` for mock title
- Add subtitle: `Text c="dimmed" size="md" fw={400} mt={2}` showing mode/question count
- Two-column section: Wrap in `Card withBorder radius="lg" p={0}` with shadow
- Score card: Add shadow, refine styling
- Animations: Add `animate-fade-in-up` with delays

### 3. History Page (`/exam/history`)

**page.tsx:**

- Add radial gradient background glow (wrap content similarly to Knowledge)
- Header: `Title order={1} fw={800}` → `Title order={2} fw={700} letterSpacing`
- Add subtitle: `Text c="dimmed" size="md" fw={400} mt={2}` — "Review your past exam attempts"
- Add header right-side action: "Back to Exam Practice" button
- Empty state: Restyle to Knowledge pattern (icon circle + centered text + action button)
- Cards: Add `boxShadow` + `borderColor: gray-2`
- Animations: Add `animate-fade-in-up` with delays

### 4. Shared Components

**QuestionCard.tsx:**

- Add `borderColor: 'var(--mantine-color-gray-2)'` to Card style
- Add `boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'` to Card style

**FeedbackCard.tsx:**

- Add `boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'` to Card style
- Keep green/red background colors as-is (functional colors)

## Files to Modify

1. `src/app/(protected)/exam/page.tsx` — background glow
2. `src/app/(protected)/exam/ExamEntryClient.tsx` — header, cards, empty state, animations
3. `src/app/(protected)/exam/mock/[id]/page.tsx` — background glow
4. `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx` — header, cards, spacing, animations
5. `src/app/(protected)/exam/history/page.tsx` — header, cards, empty state, animations, background glow
6. `src/components/exam/QuestionCard.tsx` — card styling
7. `src/components/exam/FeedbackCard.tsx` — card styling

## Out of Scope

- No functional changes (no new features, no logic changes)
- No i18n changes (keep existing English text)
- No data flow changes
- ExamPaperUploadModal and Quick Generate Modal are not being restyled (they're modals, not page-level)
