# UI/UX Improvement Design — Full Frontend Polish

**Date:** 2026-02-16
**Status:** Approved
**Strategy:** Page-by-page polish (Approach A), ordered by user-facing priority

## Context

UI/UX Pro Max analysis identified 7 improvement areas across 17 routes:

1. Empty states (HIGH)
2. Loading states (HIGH)
3. Operation feedback / toasts (MEDIUM)
4. Mobile experience (MEDIUM)
5. Spacing & sizing consistency (LOW)
6. First-visit onboarding (LOW)
7. Pricing clarity (LOW)

Design system baseline: Flat Design, indigo primary (#4F46E5), emerald CTA (#10B981), Outfit font family.

## Page Priority Order

1. Study Page
2. Chat Pages (Lecture Helper + Assignment Coach)
3. Exam Pages (Entry + Mock Exam)
4. Knowledge Pages (List + Detail)
5. Settings / Pricing / Help / Personalization
6. Landing / Login / Global Components

---

## 1. Study Page (`/study`)

### 1.1 Card visual enhancement
- Add subtle gradient tint from card color at bottom (opacity 0.03-0.05) — always visible, not only on hover
- Set `min-h` on subtitle text area so all 3 cards are equal height

### 1.2 Spacing standardization
- Section gap: `gap-6 sm:gap-12` (currently `gap-4 sm:gap-11`)
- Establish project-wide spacing tokens to reuse

### 1.3 Mobile tweaks
- Card padding: `md` → `lg` on mobile (single column)
- CTA pill: `mx="auto"` → left-aligned on mobile (`ml-0`)

---

## 2. Chat Pages (`/lecture/[id]`, `/assignment/[id]`)

### 2.1 Loading skeleton
- 3-line message skeleton (alternating left/right rounded rectangles) on initial session load
- Replace current blank state while session data fetches

### 2.2 Thinking indicator upgrade
- Replace bouncing dots with shimmer/pulse gradient bar (quieter, more modern)
- Maintain `prefers-reduced-motion` fallback (static "Thinking..." text)

### 2.3 Empty conversation (WelcomeScreen)
- Add decorative mode icon composition (large ThemeIcon + mode-specific icon)
- Suggested prompts → pill buttons with icon prefix, hover background color change

### 2.4 Operation feedback (toasts)
- Copy message → toast "Copied to clipboard" (3s)
- Regenerate → toast "Regenerating..."
- Knowledge card actions → toast confirmation

### 2.5 Chat input enhancements
- Drag-over: full input area highlight (border color + semi-transparent overlay)
- Send button disabled when input empty

### 2.6 Knowledge panel empty state
- Show: illustration icon + "No related knowledge found. Upload documents to enrich your study." + link to Knowledge page

### 2.7 Mobile
- Ensure `dvh` units for input area (Safari keyboard issue)
- Knowledge drawer: add drag handle indicator (gray bar at top)

---

## 3. Exam Pages

### 3.1 Exam Entry (`/exam`)
- No papers → info card (FileQuestion icon + message + CTA link to Knowledge upload)
- SourceCard/ModeCard: add checkmark or radio dot for selected state
- Start button: remove double loading indicator (use `loading` prop only)

### 3.2 Mock Exam (`/exam/mock/[id]`)
- Question nav sidebar: color-coded number badges (green=answered, gray=unanswered, yellow=skipped, blue=current)
- Mobile nav: bottom horizontal scroll bar of question number pills
- FeedbackCard: add CheckCircle2 / XCircle icon for correct/incorrect
- Timer near zero: red flash animation
- Results: score ring chart + summary stats cards

### 3.3 MockExamModal
- SegmentedControl labels: prepend small icons (FileText, Shuffle, Sparkles)

---

## 4. Knowledge Pages

### 4.1 Knowledge list (`/knowledge`)
- Empty state: illustration + "Your knowledge base is empty." + Upload CTA button
- Table loading: 3-5 row skeleton matching column structure
- Upload progress: top-level Progress bar (parsing 25% → extracting 50% → embedding 75% → complete 100%)
- Processing status badge: add subtle pulse animation

### 4.2 Knowledge detail (`/knowledge/[id]`)
- Chunk table: add row number column
- Empty chunks: skeleton + "Processing document..." message
- Inline edit save: toast "Changes saved"
- Batch operations: checkbox multi-select + bulk delete button

### 4.3 Mobile
- Table at 375px: show only filename + status, rest in expandable row
- Upload modal → full-screen drawer on mobile

---

## 5. Settings / Pricing / Help / Personalization

### 5.1 Settings (`/settings`)
- Section grouping: Card containers with subtle header background
- Usage bar: numeric label above ("42 / 100 queries used")
- Preference changes: toast "Preferences saved"
- Notification toggle: "Coming Soon" badge

### 5.2 Pricing (`/pricing`)
- Feature comparison table below cards (rows: features, columns: Free vs Pro, check/x icons)
- Semester option: "Save X%" badge
- Pro card: "Most Popular" ribbon/corner badge

### 5.3 Help (`/help`)
- Search input at top (real-time FAQ filtering)
- FAQ items: category icon per item
- Contact section: "Response time: within 24h"
- Empty search: "No results found" message

### 5.4 Personalization (`/personalization`)
- Delete account: confirmation modal (type "DELETE" to confirm)
- Profile avatar: clickable upload area (placeholder circle + camera icon)

---

## 6. Landing / Login / Global Components

### 6.1 Landing (`/`, `/zh`)
- Navbar: backdrop-blur + shadow on scroll (sticky enhancement)
- Hero stats: countUp animation (0 → target, triggered on viewport entry)
- Testimonials: carousel/swiper for mobile
- Hero background: pure CSS grid pattern (no extra DOM elements)

### 6.2 Login (`/login`)
- Inline validation: email format, password min length (real-time)
- Password strength indicator (signup mode): weak/medium/strong bar
- Social login buttons: either remove or add "Coming Soon" badge
- Error messages: subtle shake animation

### 6.3 Global Toast System
- Install/configure `@mantine/notifications`
- Position: top-right
- Types: success (green), error (red), info (indigo)
- Auto-dismiss: 3-5 seconds
- Apply across all pages: copy, save, delete, upload complete, preference change

### 6.4 Global Mobile Modal Pattern
- Detect `isMobile` via `useMediaQuery`
- Mobile: all centered modals → `fullScreen` + slide-up transition
- Affected: NewSessionModal, MockExamModal, DeleteSessionModal, RenameSessionModal, ShareModal, UsageLimitModal

### 6.5 Sidebar
- Session count badge per module header
- Pin/unpin operation: toast feedback

---

## Implementation Notes

- All changes use existing Mantine v8 + Tailwind v4 stack
- Toast system requires `@mantine/notifications` package (check if already installed)
- Skeleton components from `@mantine/core` (Skeleton)
- No new UI libraries — reuse Mantine primitives
- Each page = 1 PR, conventional commit format
- Respect `prefers-reduced-motion` for all new animations
