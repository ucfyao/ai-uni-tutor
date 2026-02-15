# UI/UX Full Frontend Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all UI/UX improvements from the approved design doc (PR #136) across 6 page groups, using a team-parallel execution model.

**Architecture:** Phase 0 delivers shared infrastructure (FullScreenModal wrapper + toast usage verification) as a single blocking PR. Phase 1 spawns 6 independent agents, each working in its own worktree/branch, producing 1 PR per page group. All changes are pure frontend — no backend/API/DB changes.

**Tech Stack:** Next.js 16 (App Router, React 19), Mantine v8, Tailwind CSS v4, `@mantine/notifications` (already installed), `lucide-react` + `@tabler/icons-react` icons.

**Design Doc:** `docs/plans/2026-02-16-uiux-improvement-design.md` (PR #136)

---

## Pre-requisites

- PR #136 (design doc) must be merged before starting
- All agents must `git fetch origin main && git merge origin/main --no-edit` before pushing

## Existing Infrastructure (already in place)

| What | Where | Status |
|------|-------|--------|
| `@mantine/notifications` | `package.json`, `src/app/layout.tsx` line 40 | Installed, `<Notifications position="top-right" zIndex={1000} />` configured |
| `showNotification()` wrapper | `src/lib/notifications.ts` | Throttled (2s dedup), ready to use |
| `useIsMobile()` hook | `src/hooks/use-mobile.tsx` | Exists (768px breakpoint), **unused** |
| `@mantine/core` Skeleton | Available via Mantine v8 | Not yet used for page skeletons |

---

## Phase 0 — Global Infrastructure (Serial Blocker)

**Branch:** `feature/uiux-global-infra`
**PR Scope:** Global utilities consumed by all Phase 1 agents
**Estimated Size:** S (Small) — 2 new files, 6 modal file edits
**Commit scope:** `ui`

> This PR **MUST merge before** any Phase 1 agent starts.

---

### Task 0.1: Create FullScreenModal wrapper component

**Files:**
- Create: `src/components/FullScreenModal.tsx`

**Step 1: Create the FullScreenModal component**

This wrapper makes any Mantine `Modal` go fullscreen on mobile with a slide-up transition. All 6 existing modals will be migrated to use this.

```tsx
'use client';

import { Modal, type ModalProps } from '@mantine/core';
import { useIsMobile } from '@/hooks/use-mobile';

export function FullScreenModal({ children, ...props }: ModalProps) {
  const isMobile = useIsMobile();

  return (
    <Modal
      {...props}
      fullScreen={isMobile}
      transitionProps={isMobile ? { transition: 'slide-up', duration: 300 } : props.transitionProps}
    >
      {children}
    </Modal>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/FullScreenModal.tsx
git commit -m "feat(ui): add FullScreenModal wrapper for mobile fullscreen modals"
```

---

### Task 0.2: Migrate all existing modals to FullScreenModal

**Files:**
- Modify: `src/components/NewSessionModal.tsx` — replace `Modal` import with `FullScreenModal`
- Modify: `src/components/MockExamModal.tsx` — replace `Modal` import with `FullScreenModal`
- Modify: `src/components/DeleteSessionModal.tsx` — replace `Modal` import with `FullScreenModal`
- Modify: `src/components/RenameSessionModal.tsx` — replace `Modal` import with `FullScreenModal`
- Modify: `src/components/ShareModal.tsx` — replace `Modal` import with `FullScreenModal`
- Modify: `src/components/UsageLimitModal.tsx` — replace `Modal` import with `FullScreenModal`

**Step 1: In each file, replace the Modal import**

For each of the 6 files above, apply this pattern:

```diff
- import { Modal, ... } from '@mantine/core';
+ import { ... } from '@mantine/core';
+ import { FullScreenModal } from '@/components/FullScreenModal';
```

Then replace every `<Modal` with `<FullScreenModal` and `</Modal>` with `</FullScreenModal>`.

Remove any existing `fullScreen` prop if already set — `FullScreenModal` handles it automatically.

**Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add src/components/NewSessionModal.tsx src/components/MockExamModal.tsx \
  src/components/DeleteSessionModal.tsx src/components/RenameSessionModal.tsx \
  src/components/ShareModal.tsx src/components/UsageLimitModal.tsx
git commit -m "refactor(ui): migrate all modals to FullScreenModal wrapper"
```

---

### Task 0.3: Verify toast infrastructure and add i18n keys

**Files:**
- Modify: `src/i18n/translations.ts` — add shared toast message keys

**Step 1: Add toast translation keys**

Add to both `en` and `zh` translation objects under a new `toast` namespace:

```typescript
// English
toast: {
  copiedToClipboard: 'Copied to clipboard',
  regenerating: 'Regenerating...',
  preferencesSaved: 'Preferences saved',
  changesSaved: 'Changes saved',
  deletedSuccessfully: 'Deleted successfully',
  uploadComplete: 'Upload complete',
  linkCopied: 'Link copied',
  comingSoon: 'Coming Soon',
},

// Chinese
toast: {
  copiedToClipboard: '已复制到剪贴板',
  regenerating: '正在重新生成...',
  preferencesSaved: '偏好已保存',
  changesSaved: '更改已保存',
  deletedSuccessfully: '删除成功',
  uploadComplete: '上传完成',
  linkCopied: '链接已复制',
  comingSoon: '即将推出',
},
```

**Step 2: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add shared toast i18n keys for UI/UX improvements"
```

---

### Task 0.4: Final verification and PR

**Step 1: Run full checks**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

Expected: All pass.

**Step 2: Push and create PR**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-global-infra
gh pr create --title "feat(ui): global infrastructure for UI/UX improvements" \
  --body "$(cat <<'EOF'
## Summary
- Add `FullScreenModal` wrapper (auto-fullscreen on mobile with slide-up transition)
- Migrate all 6 existing modals to `FullScreenModal`
- Add shared toast i18n keys

## Blocker
This PR must merge before Phase 1 page-specific PRs.

## Test plan
- [ ] Verify modals display normally on desktop
- [ ] Verify modals go fullscreen on mobile viewport (<768px)
- [ ] Verify slide-up transition on mobile
- [ ] Verify build passes
EOF
)"
```

**Step 3: Squash merge after approval**

```bash
gh pr merge --squash
```

---

## Phase 1 — Page-Specific Improvements (Parallel)

> All 6 agents below are **independent** and can run concurrently after Phase 0 merges.
> Each agent works in its own worktree and creates 1 PR.

---

## Agent 1: agent-study — Study Page

**Branch:** `feature/uiux-study`
**Worktree:** `.worktrees/uiux-study`
**Estimated Size:** S (Small) — 1 file, ~30 lines changed
**Commit scope:** `ui`

### Task 1.1: Card gradient tint + equal height

**Files:**
- Modify: `src/app/(protected)/study/StudyPageClient.tsx`

**Step 1: Add gradient bottom tint to each mode card**

Find the 3 mode card `Paper` components in `StudyPageClient.tsx`. Add a pseudo-element or inner div for the gradient tint. Each card has a color from `MODES_METADATA` — use it at 0.03-0.05 opacity.

```tsx
// Inside each card Paper, add at the bottom:
<Box
  style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    background: `linear-gradient(to top, ${mode.color}0D, transparent)`,
    borderRadius: 'inherit',
    pointerEvents: 'none',
  }}
/>
```

Ensure the parent `Paper` has `style={{ position: 'relative', overflow: 'hidden' }}`.

**Step 2: Set min-h on subtitle text area**

Find the description/subtitle `Text` component in each card. Add `mih={48}` (or appropriate value) so all 3 cards align to equal height.

**Step 3: Commit**

```bash
git add src/app/\(protected\)/study/StudyPageClient.tsx
git commit -m "style(ui): add gradient tint and equal-height cards on study page"
```

---

### Task 1.2: Spacing standardization

**Files:**
- Modify: `src/app/(protected)/study/StudyPageClient.tsx`

**Step 1: Update section gaps**

Find the main `Stack` or layout container. Change gap values:
- `gap-4` → `gap-6` (mobile)
- `sm:gap-11` → `sm:gap-12` (desktop)

Use Mantine `gap` prop if on a `Stack`/`Group`, or Tailwind classes if raw HTML.

**Step 2: Commit**

```bash
git add src/app/\(protected\)/study/StudyPageClient.tsx
git commit -m "style(ui): standardize section spacing on study page"
```

---

### Task 1.3: Mobile tweaks

**Files:**
- Modify: `src/app/(protected)/study/StudyPageClient.tsx`

**Step 1: Card padding on mobile**

Find card `Paper` padding. Change from `p="md"` to responsive: `p={{ base: 'lg', sm: 'md' }}`.

**Step 2: CTA pill alignment on mobile**

Find CTA pill button. Change `mx="auto"` to `mx={{ base: 0, sm: 'auto' }}` (left-aligned on mobile).

**Step 3: Commit**

```bash
git add src/app/\(protected\)/study/StudyPageClient.tsx
git commit -m "style(ui): improve mobile card padding and CTA alignment on study page"
```

---

### Task 1.4: Verify and PR

**Step 1: Run checks**

```bash
npm run lint && npx tsc --noEmit && npm run build
```

**Step 2: Push and create PR**

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-study
gh pr create --title "style(ui): polish study page cards, spacing, and mobile layout" \
  --body "$(cat <<'EOF'
## Summary
- Add subtle gradient tint from card color at bottom
- Equalize card heights via min-h on subtitle area
- Standardize section spacing (gap-6/gap-12)
- Improve mobile card padding and CTA alignment

## Test plan
- [ ] Verify gradient tint visible on all 3 cards (subtle, not jarring)
- [ ] Verify cards are equal height
- [ ] Verify mobile layout at 375px viewport
- [ ] Verify build passes
EOF
)"
```

---

## Agent 2: agent-chat — Chat Pages

**Branch:** `feature/uiux-chat`
**Worktree:** `.worktrees/uiux-chat`
**Estimated Size:** L (Large) — 7 files, ~150 lines changed, 8 sub-tasks
**Commit scope:** `chat`

### Task 2.1: Loading skeleton for message list

**Files:**
- Modify: `src/components/chat/MessageList.tsx`

**Step 1: Create chat skeleton component inline**

At the top of MessageList.tsx, add a `ChatSkeleton` component:

```tsx
import { Skeleton, Stack, Group } from '@mantine/core';

function ChatSkeleton() {
  return (
    <Stack gap="lg" p="md">
      {/* User message - right aligned */}
      <Group justify="flex-end">
        <Skeleton height={40} width="60%" radius="xl" />
      </Group>
      {/* AI message - left aligned, multi-line */}
      <Stack gap="xs" align="flex-start">
        <Skeleton height={16} width="80%" radius="md" />
        <Skeleton height={16} width="65%" radius="md" />
        <Skeleton height={16} width="40%" radius="md" />
      </Stack>
      {/* User message */}
      <Group justify="flex-end">
        <Skeleton height={32} width="45%" radius="xl" />
      </Group>
      {/* AI message */}
      <Stack gap="xs" align="flex-start">
        <Skeleton height={16} width="70%" radius="md" />
        <Skeleton height={16} width="55%" radius="md" />
      </Stack>
    </Stack>
  );
}
```

**Step 2: Show skeleton during initial load**

In the MessageList render, when `messages` is empty and the session is still loading (before welcome screen), show `<ChatSkeleton />` instead of blank.

Check existing loading logic — if there's an `isLoading` prop or similar, use it. Otherwise, add a prop: `isLoading?: boolean` and pass from parent.

**Step 3: Commit**

```bash
git add src/components/chat/MessageList.tsx
git commit -m "feat(chat): add loading skeleton for initial message list"
```

---

### Task 2.2: Thinking indicator shimmer upgrade

**Files:**
- Modify: `src/components/chat/ThinkingIndicator.tsx`

**Step 1: Replace bouncing dots with shimmer pulse bar**

Replace the current 3-dot animation with a shimmer gradient bar:

```tsx
'use client';

import { Box, Text } from '@mantine/core';

interface ThinkingIndicatorProps {
  mode?: string;
  color?: string;
}

export function ThinkingIndicator({ mode, color = 'var(--mantine-color-indigo-5)' }: ThinkingIndicatorProps) {
  const label = mode === 'lecture' ? 'Analyzing concepts' : mode === 'assignment' ? 'Organizing thoughts' : 'Thinking';

  return (
    <Box p="xs">
      <Box
        h={4}
        w={120}
        mb={6}
        style={{
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
      <Text fz="xs" c="dimmed">{label}...</Text>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-bar { animation: none !important; }
        }
      `}</style>
    </Box>
  );
}
```

**Step 2: For prefers-reduced-motion**, the `<style>` block above handles it. Users with reduced motion see a static bar + text.

**Step 3: Commit**

```bash
git add src/components/chat/ThinkingIndicator.tsx
git commit -m "style(chat): replace bouncing dots with shimmer thinking indicator"
```

---

### Task 2.3: WelcomeScreen decoration + pill buttons

**Files:**
- Modify: `src/components/chat/WelcomeScreen.tsx`

**Step 1: Add decorative mode icon composition**

Above the intro text, add a large ThemeIcon with the mode-specific icon:

```tsx
import { ThemeIcon } from '@mantine/core';

// In the render, before the intro text:
<ThemeIcon size={64} radius="xl" variant="light" color={modeColor}>
  <ModeIcon size={32} />
</ThemeIcon>
```

**Step 2: Convert suggested prompts to pill buttons**

Replace the current prompt cards/buttons with Mantine `Button` pills:

```tsx
<Group gap="sm" wrap="wrap">
  {prompts.map((prompt, i) => (
    <Button
      key={i}
      variant="light"
      color="gray"
      radius="xl"
      size="sm"
      leftSection={<IconMessageCircle size={14} />}
      onClick={() => onPromptClick(prompt)}
      styles={{ root: { '&:hover': { backgroundColor: 'var(--mantine-color-indigo-0)' } } }}
    >
      {prompt}
    </Button>
  ))}
</Group>
```

**Step 3: Commit**

```bash
git add src/components/chat/WelcomeScreen.tsx
git commit -m "style(chat): add mode icon decoration and pill prompt buttons to welcome screen"
```

---

### Task 2.4: Toast feedback for copy, regenerate, knowledge actions

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx` — copy + regenerate toasts
- Modify: `src/components/modes/LectureHelper.tsx` — knowledge card action toasts

**Step 1: Add toast on copy**

In `MessageBubble.tsx`, find the copy-to-clipboard handler. After `navigator.clipboard.writeText(...)`, add:

```tsx
import { showNotification } from '@/lib/notifications';
import { IconCheck } from '@tabler/icons-react';

// After clipboard write:
showNotification({
  message: t.toast.copiedToClipboard,
  color: 'green',
  icon: <IconCheck size={16} />,
  autoClose: 3000,
});
```

**Step 2: Add toast on regenerate**

Find the regenerate handler. Add:

```tsx
showNotification({
  message: t.toast.regenerating,
  color: 'indigo',
  autoClose: 3000,
});
```

**Step 3: Add toast for knowledge card actions in LectureHelper**

Find where user cards are created/deleted. Add appropriate `showNotification` calls.

**Step 4: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/modes/LectureHelper.tsx
git commit -m "feat(chat): add toast feedback for copy, regenerate, and knowledge card actions"
```

---

### Task 2.5: Chat input drag-over highlight + send button disable

**Files:**
- Modify: `src/components/chat/ChatInput.tsx`

**Step 1: Add drag-over visual highlight**

Find the drag event handlers. On `onDragOver`, set a state `isDragOver = true`. On `onDragLeave`/`onDrop`, set `false`. Apply conditional styles:

```tsx
const [isDragOver, setIsDragOver] = useState(false);

// On the input container:
style={{
  borderColor: isDragOver ? 'var(--mantine-color-indigo-5)' : undefined,
  backgroundColor: isDragOver ? 'var(--mantine-color-indigo-0)' : undefined,
  transition: 'border-color 0.2s, background-color 0.2s',
}}
```

**Step 2: Disable send button when input empty**

Find the send `ActionIcon`/`Button`. Add `disabled={!input.trim() && images.length === 0}`.

**Step 3: Commit**

```bash
git add src/components/chat/ChatInput.tsx
git commit -m "style(chat): add drag-over highlight and disable empty send button"
```

---

### Task 2.6: Knowledge panel empty state

**Files:**
- Modify: `src/components/chat/KnowledgePanel.tsx`

**Step 1: Add empty state when no cards**

Find where the panel renders when both `officialCards` and `userCards` are empty. Replace blank with:

```tsx
import { IconBook2, IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

<Stack align="center" gap="md" py="xl">
  <ThemeIcon size={48} radius="xl" variant="light" color="gray">
    <IconBook2 size={24} />
  </ThemeIcon>
  <Text ta="center" c="dimmed" fz="sm">
    {t.chat.noKnowledgeFound}
  </Text>
  <Button
    component={Link}
    href="/knowledge"
    variant="subtle"
    size="xs"
    rightSection={<IconArrowRight size={14} />}
  >
    {t.chat.uploadDocuments}
  </Button>
</Stack>
```

**Step 2: Add i18n keys for empty state**

In `src/i18n/translations.ts`, under `chat`:

```typescript
// English
noKnowledgeFound: 'No related knowledge found. Upload documents to enrich your study.',
uploadDocuments: 'Go to Knowledge Base',

// Chinese
noKnowledgeFound: '未找到相关知识。上传文档来丰富你的学习资料。',
uploadDocuments: '前往知识库',
```

**Step 3: Commit**

```bash
git add src/components/chat/KnowledgePanel.tsx src/i18n/translations.ts
git commit -m "feat(chat): add empty state with CTA for knowledge panel"
```

---

### Task 2.7: Mobile fixes (dvh units + drawer drag handle)

**Files:**
- Modify: `src/components/modes/LectureHelper.tsx` — dvh for input area
- Modify: `src/components/chat/KnowledgePanel.tsx` — drawer drag handle

**Step 1: Use dvh for mobile input area**

In `LectureHelper.tsx`, find the main container height. Add CSS for mobile Safari:

```tsx
style={{ height: '100dvh' }}  // or add to existing height calc
```

**Step 2: Add drag handle to knowledge drawer**

In the mobile drawer rendering of KnowledgePanel, add at the top:

```tsx
<Box mx="auto" mt={8} mb={4} w={36} h={4} bg="gray.3" style={{ borderRadius: 2 }} />
```

**Step 3: Commit**

```bash
git add src/components/modes/LectureHelper.tsx src/components/chat/KnowledgePanel.tsx
git commit -m "fix(chat): use dvh units for mobile input and add drawer drag handle"
```

---

### Task 2.8: Verify and PR

```bash
npm run lint && npx tsc --noEmit && npm run build
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-chat
gh pr create --title "feat(chat): loading skeleton, shimmer indicator, toasts, and mobile fixes" \
  --body "$(cat <<'EOF'
## Summary
- Add 3-line message skeleton on initial session load
- Replace bouncing dots with shimmer pulse thinking indicator
- Add decorative icon + pill prompt buttons to WelcomeScreen
- Toast feedback for copy, regenerate, knowledge card actions
- Drag-over highlight on chat input + disabled send on empty
- Knowledge panel empty state with CTA
- Mobile: dvh units + drawer drag handle

## Test plan
- [ ] Verify skeleton shows during initial load, then disappears
- [ ] Verify shimmer indicator replaces bouncing dots
- [ ] Verify pill buttons work for suggested prompts
- [ ] Verify toasts appear on copy/regenerate
- [ ] Verify drag-over shows highlight
- [ ] Verify send button disabled when empty
- [ ] Verify knowledge empty state shows when no cards
- [ ] Verify mobile input doesn't hide behind Safari keyboard
- [ ] Verify prefers-reduced-motion fallback
- [ ] Verify build passes
EOF
)"
```

---

## Agent 3: agent-exam — Exam Pages

**Branch:** `feature/uiux-exam`
**Worktree:** `.worktrees/uiux-exam`
**Estimated Size:** L (Large) — 5 files, ~200 lines changed, 8 sub-tasks
**Commit scope:** `ui`

### Task 3.1: No-papers info card on exam entry

**Files:**
- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Add empty state info card**

When no exam papers exist for the selected course, show an info card:

```tsx
import { IconFileQuestion, IconArrowRight } from '@tabler/icons-react';

// When papers list is empty:
<Paper p="lg" radius="md" withBorder>
  <Group>
    <ThemeIcon size={40} radius="md" variant="light" color="indigo">
      <IconFileQuestion size={20} />
    </ThemeIcon>
    <Box flex={1}>
      <Text fw={500}>{t.exam.noPapersTitle}</Text>
      <Text fz="sm" c="dimmed">{t.exam.noPapersDescription}</Text>
    </Box>
    <Button
      component={Link}
      href="/knowledge"
      variant="light"
      rightSection={<IconArrowRight size={14} />}
    >
      {t.exam.uploadPapers}
    </Button>
  </Group>
</Paper>
```

**Step 2: Add i18n keys**

```typescript
// English (under exam)
noPapersTitle: 'No exam papers available',
noPapersDescription: 'Upload exam papers in the Knowledge Base to get started.',
uploadPapers: 'Upload Papers',

// Chinese
noPapersTitle: '暂无考卷',
noPapersDescription: '在知识库中上传考卷以开始使用。',
uploadPapers: '上传考卷',
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx src/i18n/translations.ts
git commit -m "feat(ui): add no-papers info card on exam entry page"
```

---

### Task 3.2: SourceCard/ModeCard selected state + start button fix

**Files:**
- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Add visual selected state to SourceCard/ModeCard**

Find the inline `SourceCard` component (~line 337). Add a checkmark or radio dot when selected:

```tsx
// Add to the SourceCard when selected:
{isSelected && (
  <ThemeIcon size={20} radius="xl" color="indigo" style={{ position: 'absolute', top: 8, right: 8 }}>
    <IconCheck size={12} />
  </ThemeIcon>
)}
```

Apply same pattern to `ModeCard` (~line 377).

**Step 2: Fix start button double loading**

Find the start/submit button. Remove any manual loading spinner if `loading` prop is already set. Should be `<Button loading={isLoading}>` only.

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx
git commit -m "style(ui): add selected state checkmarks and fix start button loading"
```

---

### Task 3.3: Question nav color-coded badges

**Files:**
- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Add color-coded question number badges in sidebar**

Find the question list sidebar section. Replace plain number buttons with color-coded badges:

```tsx
const getQuestionColor = (index: number) => {
  if (index === currentQuestion) return 'indigo';      // current = blue
  if (submittedAnswers[index]?.isCorrect) return 'green';  // correct = green
  if (submittedAnswers[index] && !submittedAnswers[index].isCorrect) return 'red'; // incorrect = red
  if (answers[index]) return 'teal';                    // answered = teal
  return 'gray';                                        // unanswered = gray
};

// Render:
<Button
  size="xs"
  radius="xl"
  variant={index === currentQuestion ? 'filled' : 'light'}
  color={getQuestionColor(index)}
  onClick={() => setCurrentQuestion(index)}
>
  {index + 1}
</Button>
```

**Step 2: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/MockExamClient.tsx
git commit -m "style(ui): add color-coded question navigation badges"
```

---

### Task 3.4: Mobile bottom navigation bar

**Files:**
- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Add horizontal scroll question pills for mobile**

Below the question card area, add a mobile-only nav bar:

```tsx
import { ScrollArea } from '@mantine/core';

// Mobile question nav (show only on mobile):
<Box hiddenFrom="sm" py="xs" px="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
  <ScrollArea type="never">
    <Group gap={6} wrap="nowrap">
      {questions.map((_, i) => (
        <Button
          key={i}
          size="compact-xs"
          radius="xl"
          variant={i === currentQuestion ? 'filled' : 'light'}
          color={getQuestionColor(i)}
          onClick={() => setCurrentQuestion(i)}
          miw={32}
        >
          {i + 1}
        </Button>
      ))}
    </Group>
  </ScrollArea>
</Box>
```

**Step 2: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/MockExamClient.tsx
git commit -m "feat(ui): add mobile bottom question navigation bar"
```

---

### Task 3.5: FeedbackCard icon indicators

**Files:**
- Modify: `src/components/exam/FeedbackCard.tsx`

**Step 1: Add CheckCircle2 / XCircle icons**

```tsx
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';

// At the top of the feedback card, next to the result text:
{isCorrect ? (
  <IconCircleCheck size={20} color="var(--mantine-color-green-6)" />
) : (
  <IconCircleX size={20} color="var(--mantine-color-red-6)" />
)}
```

**Step 2: Commit**

```bash
git add src/components/exam/FeedbackCard.tsx
git commit -m "style(ui): add correct/incorrect icons to FeedbackCard"
```

---

### Task 3.6: Timer red flash + score ring chart

**Files:**
- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Add red flash animation when timer < 60s**

Find the timer display. Add conditional class:

```tsx
<Text
  fw={600}
  c={timeRemaining < 60 ? 'red' : undefined}
  style={timeRemaining < 60 ? { animation: 'timer-flash 1s ease-in-out infinite' } : undefined}
>
  {formatTime(timeRemaining)}
</Text>

// Add keyframes:
<style>{`
  @keyframes timer-flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .timer-flash { animation: none !important; }
  }
`}</style>
```

**Step 2: Add score ring chart on results**

Find the completion/results section. Add a `RingProgress` component:

```tsx
import { RingProgress } from '@mantine/core';

const scorePercent = Math.round((correctCount / totalQuestions) * 100);
const ringColor = scorePercent >= 80 ? 'green' : scorePercent >= 50 ? 'yellow' : 'red';

<RingProgress
  size={120}
  thickness={10}
  roundCaps
  sections={[{ value: scorePercent, color: ringColor }]}
  label={
    <Text ta="center" fw={700} fz="lg">
      {scorePercent}%
    </Text>
  }
/>
```

Add summary stats cards (total questions, correct, incorrect, time taken) below the ring using a `SimpleGrid`.

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/MockExamClient.tsx
git commit -m "feat(ui): add timer flash warning and score ring chart on exam results"
```

---

### Task 3.7: MockExamModal SegmentedControl icons

**Files:**
- Modify: `src/components/MockExamModal.tsx`

**Step 1: Add icons to SegmentedControl labels**

Find the `SegmentedControl` for source selection. Update the `data` prop to use objects with `label` as a ReactNode:

```tsx
import { IconFileText, IconShuffle, IconSparkles } from '@tabler/icons-react';

const sourceData = [
  { value: 'real', label: <Group gap={6} wrap="nowrap"><IconFileText size={14} /><span>{t.exam.realExam}</span></Group> },
  { value: 'random', label: <Group gap={6} wrap="nowrap"><IconShuffle size={14} /><span>{t.exam.randomMix}</span></Group> },
  { value: 'ai', label: <Group gap={6} wrap="nowrap"><IconSparkles size={14} /><span>{t.exam.aiMock}</span></Group> },
];
```

**Step 2: Commit**

```bash
git add src/components/MockExamModal.tsx
git commit -m "style(ui): add icons to MockExamModal source segment labels"
```

---

### Task 3.8: Verify and PR

```bash
npm run lint && npx tsc --noEmit && npm run build
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-exam
gh pr create --title "feat(ui): exam page polish — info cards, nav badges, score ring, mobile bar" \
  --body "$(cat <<'EOF'
## Summary
- No-papers info card with CTA link to Knowledge upload
- Checkmark selected state on SourceCard/ModeCard
- Fix double loading indicator on start button
- Color-coded question navigation badges (green/gray/red/blue)
- Mobile bottom horizontal scroll question nav
- CheckCircle/XCircle icons on FeedbackCard
- Timer red flash animation when < 60s
- Score ring chart + summary stats on results
- Icons on MockExamModal SegmentedControl

## Test plan
- [ ] Verify info card shows when no papers, links to /knowledge
- [ ] Verify checkmark on selected source/mode cards
- [ ] Verify color-coded nav badges reflect question status
- [ ] Verify mobile bottom bar scrolls with many questions
- [ ] Verify timer flashes red under 60s
- [ ] Verify score ring displays correct percentage
- [ ] Verify SegmentedControl icons display correctly
- [ ] Verify build passes
EOF
)"
```

---

## Agent 4: agent-knowledge — Knowledge Pages

**Branch:** `feature/uiux-knowledge`
**Worktree:** `.worktrees/uiux-knowledge`
**Estimated Size:** M-L (Medium-Large) — 5 files, ~180 lines changed, 8 sub-tasks
**Commit scope:** `rag`

### Task 4.1: Knowledge list empty state

**Files:**
- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Add empty state illustration**

When the document list is empty (no documents), show:

```tsx
import { IconBooks, IconUpload } from '@tabler/icons-react';

<Stack align="center" gap="md" py={60}>
  <ThemeIcon size={64} radius="xl" variant="light" color="gray">
    <IconBooks size={32} />
  </ThemeIcon>
  <Text fw={500} fz="lg">{t.knowledge.emptyTitle}</Text>
  <Text c="dimmed" ta="center" maw={400}>{t.knowledge.emptyDescription}</Text>
  <Button
    leftSection={<IconUpload size={16} />}
    onClick={openUploadModal}
  >
    {t.knowledge.uploadCTA}
  </Button>
</Stack>
```

**Step 2: Add i18n keys**

```typescript
// English
emptyTitle: 'Your knowledge base is empty',
emptyDescription: 'Upload lecture notes, exam papers, or assignments to build your personal knowledge base.',
uploadCTA: 'Upload Document',

// Chinese
emptyTitle: '你的知识库是空的',
emptyDescription: '上传课程笔记、考卷或作业来构建你的个人知识库。',
uploadCTA: '上传文档',
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx src/i18n/translations.ts
git commit -m "feat(rag): add empty state with illustration for knowledge list"
```

---

### Task 4.2: Table loading skeleton

**Files:**
- Modify: `src/components/rag/KnowledgeTable.tsx`

**Step 1: Add skeleton rows when loading**

Add a loading prop and show 3-5 skeleton rows matching column structure:

```tsx
function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <Table.Tr key={i}>
          <Table.Td><Skeleton height={16} width="70%" /></Table.Td>
          <Table.Td><Skeleton height={16} width="50%" /></Table.Td>
          <Table.Td><Skeleton height={16} width="50%" /></Table.Td>
          <Table.Td><Skeleton height={16} width="60%" /></Table.Td>
          <Table.Td><Skeleton height={20} width={60} radius="xl" /></Table.Td>
          <Table.Td><Skeleton height={24} width={50} /></Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}
```

Show `<TableSkeleton />` instead of data rows when `isLoading` is true.

**Step 2: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx
git commit -m "feat(rag): add table skeleton loading state for knowledge list"
```

---

### Task 4.3: Upload progress bar enhancement

**Files:**
- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx`

**Step 1: Enhance the existing upload progress display**

Find the existing progress tracking in KnowledgeClient. Replace or enhance with a multi-stage progress bar:

```tsx
import { Progress, Text, Group } from '@mantine/core';

const stageLabels = {
  parsing: { label: t.knowledge.stageParsing, percent: 25 },
  extracting: { label: t.knowledge.stageExtracting, percent: 50 },
  embedding: { label: t.knowledge.stageEmbedding, percent: 75 },
  complete: { label: t.knowledge.stageComplete, percent: 100 },
};

// In the upload section:
<Box>
  <Group justify="space-between" mb={4}>
    <Text fz="xs" c="dimmed">{stageLabels[currentStage].label}</Text>
    <Text fz="xs" c="dimmed">{stageLabels[currentStage].percent}%</Text>
  </Group>
  <Progress
    value={stageLabels[currentStage].percent}
    color={currentStage === 'complete' ? 'green' : 'indigo'}
    size="sm"
    radius="xl"
    animated={currentStage !== 'complete'}
  />
</Box>
```

**Step 2: Add pulse animation to processing status badge**

Find the status badge for "processing" documents. Add subtle pulse:

```tsx
<Badge
  color="blue"
  variant="light"
  style={status === 'processing' ? { animation: 'pulse 2s ease-in-out infinite' } : undefined}
>
  {status}
</Badge>
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "feat(rag): enhance upload progress bar with multi-stage display"
```

---

### Task 4.4: Document detail — row numbers + empty chunks skeleton

**Files:**
- Modify: `src/app/(protected)/knowledge/[id]/ChunkTable.tsx`

**Step 1: Add row number column**

Add a `#` column as the first column in the table:

```tsx
<Table.Th w={50}>#</Table.Th>
// ...
<Table.Td><Text fz="sm" c="dimmed">{index + 1}</Text></Table.Td>
```

**Step 2: Add empty chunks skeleton**

When chunks are empty and document is still processing, show skeleton + message:

```tsx
{chunks.length === 0 && (
  <Stack align="center" gap="md" py="xl">
    <Skeleton height={16} width="60%" />
    <Skeleton height={16} width="80%" />
    <Skeleton height={16} width="50%" />
    <Text c="dimmed" fz="sm">{t.knowledge.processingDocument}</Text>
  </Stack>
)}
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkTable.tsx
git commit -m "feat(rag): add row numbers and processing skeleton to chunk table"
```

---

### Task 4.5: Inline edit save toast

**Files:**
- Modify: `src/app/(protected)/knowledge/[id]/ChunkActionBar.tsx`

**Step 1: Add toast on successful save**

Find the save handler. After successful save, add:

```tsx
import { showNotification } from '@/lib/notifications';
import { IconCheck } from '@tabler/icons-react';

showNotification({
  message: t.toast.changesSaved,
  color: 'green',
  icon: <IconCheck size={16} />,
  autoClose: 3000,
});
```

**Step 2: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkActionBar.tsx
git commit -m "feat(rag): add toast confirmation for inline chunk edits"
```

---

### Task 4.6: Batch operations (checkbox multi-select + bulk delete)

**Files:**
- Modify: `src/app/(protected)/knowledge/[id]/ChunkTable.tsx`
- Modify: `src/app/(protected)/knowledge/[id]/DocumentDetailClient.tsx`

**Step 1: Add checkbox column to ChunkTable**

Add a `Checkbox` column and track selected IDs:

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const toggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};

const toggleAll = () => {
  if (selectedIds.size === chunks.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(chunks.map(c => c.id)));
  }
};
```

Add header checkbox for select-all and per-row checkboxes.

**Step 2: Add bulk delete button**

When `selectedIds.size > 0`, show a bulk delete button above the table:

```tsx
{selectedIds.size > 0 && (
  <Group mb="sm">
    <Text fz="sm" c="dimmed">{selectedIds.size} selected</Text>
    <Button size="xs" color="red" variant="light" onClick={handleBulkDelete}>
      {t.knowledge.bulkDelete}
    </Button>
  </Group>
)}
```

Pass `selectedIds` and callbacks from `DocumentDetailClient` → `ChunkTable`.

**Step 3: Commit**

```bash
git add src/app/\(protected\)/knowledge/\[id\]/ChunkTable.tsx \
  src/app/\(protected\)/knowledge/\[id\]/DocumentDetailClient.tsx
git commit -m "feat(rag): add checkbox multi-select and bulk delete for chunks"
```

---

### Task 4.7: Mobile responsiveness

**Files:**
- Modify: `src/components/rag/KnowledgeTable.tsx` — mobile table collapse
- Modify: `src/app/(protected)/knowledge/KnowledgeClient.tsx` — upload modal fullscreen

**Step 1: Mobile table at 375px**

The KnowledgeTable already has mobile card view. Verify it shows only filename + status on small screens. If needed, adjust the mobile card to hide extra fields.

**Step 2: Upload modal fullscreen on mobile**

Replace `Modal` with `FullScreenModal` in KnowledgeClient's upload modal:

```tsx
import { FullScreenModal } from '@/components/FullScreenModal';

// Replace <Modal with <FullScreenModal
```

**Step 3: Commit**

```bash
git add src/components/rag/KnowledgeTable.tsx src/app/\(protected\)/knowledge/KnowledgeClient.tsx
git commit -m "style(rag): improve mobile table and fullscreen upload modal"
```

---

### Task 4.8: Verify and PR

```bash
npm run lint && npx tsc --noEmit && npm run build
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-knowledge
gh pr create --title "feat(rag): knowledge page polish — empty states, skeleton, progress, batch ops" \
  --body "$(cat <<'EOF'
## Summary
- Empty state illustration + upload CTA for empty knowledge list
- Table skeleton loading state (4 rows)
- Multi-stage upload progress bar (parsing → extracting → embedding → complete)
- Processing badge pulse animation
- Row number column in chunk table
- Empty chunks skeleton with "Processing..." message
- Toast confirmation on inline edits
- Checkbox multi-select + bulk delete for chunks
- Mobile: fullscreen upload modal

## Test plan
- [ ] Verify empty state shows when no documents
- [ ] Verify skeleton shows during document list loading
- [ ] Verify progress bar advances through stages during upload
- [ ] Verify processing badge pulses
- [ ] Verify row numbers display correctly
- [ ] Verify checkbox select/deselect and bulk delete
- [ ] Verify toast on save
- [ ] Verify mobile upload modal goes fullscreen
- [ ] Verify build passes
EOF
)"
```

---

## Agent 5: agent-settings — Settings / Pricing / Help / Personalization

**Branch:** `feature/uiux-settings`
**Worktree:** `.worktrees/uiux-settings`
**Estimated Size:** M (Medium) — 4 page files, ~150 lines changed, 8 sub-tasks
**Commit scope:** `ui`

### Task 5.1: Settings page — section grouping + usage label + toasts

**Files:**
- Modify: `src/app/(protected)/settings/page.tsx`

**Step 1: Wrap sections in Card containers**

Group related settings into `Paper` or `Card` components with subtle header backgrounds:

```tsx
<Paper p="lg" radius="md" withBorder>
  <Text fw={600} mb="md">{t.settings.preferences}</Text>
  {/* theme toggle, language select, notifications */}
</Paper>
```

**Step 2: Add numeric label above usage bar**

Find the usage `Progress` bar. Add label above:

```tsx
<Text fz="sm" c="dimmed" mb={4}>
  {used} / {limit} {t.settings.queriesUsed}
</Text>
<Progress value={(used / limit) * 100} color="indigo" size="sm" radius="xl" />
```

**Step 3: Add toast on preference save**

After language or theme changes:

```tsx
showNotification({
  message: t.toast.preferencesSaved,
  color: 'green',
  icon: <IconCheck size={16} />,
  autoClose: 3000,
});
```

**Step 4: Add "Coming Soon" badge to notification toggle**

```tsx
<Badge variant="light" color="gray" size="sm">
  {t.toast.comingSoon}
</Badge>
```

**Step 5: Commit**

```bash
git add src/app/\(protected\)/settings/page.tsx
git commit -m "style(ui): settings page section grouping, usage label, and toasts"
```

---

### Task 5.2: Pricing page — comparison table + badges

**Files:**
- Modify: `src/app/(protected)/pricing/page.tsx`

**Step 1: Add feature comparison table below plan cards**

```tsx
import { Table } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

const features = [
  { name: t.pricing.featureDailyQueries, free: '3/day', pro: '30/day' },
  { name: t.pricing.featureDocUploads, free: '5', pro: t.pricing.unlimited },
  { name: t.pricing.featureExamModes, free: t.pricing.practiceOnly, pro: t.pricing.allModes },
  { name: t.pricing.featureKnowledgeCards, free: <IconCheck size={16} color="green" />, pro: <IconCheck size={16} color="green" /> },
  { name: t.pricing.featurePriority, free: <IconX size={16} color="gray" />, pro: <IconCheck size={16} color="green" /> },
];

<Table mt="xl">
  <Table.Thead>
    <Table.Tr>
      <Table.Th>{t.pricing.feature}</Table.Th>
      <Table.Th ta="center">Free</Table.Th>
      <Table.Th ta="center">Pro</Table.Th>
    </Table.Tr>
  </Table.Thead>
  <Table.Tbody>
    {features.map((f, i) => (
      <Table.Tr key={i}>
        <Table.Td>{f.name}</Table.Td>
        <Table.Td ta="center">{f.free}</Table.Td>
        <Table.Td ta="center">{f.pro}</Table.Td>
      </Table.Tr>
    ))}
  </Table.Tbody>
</Table>
```

**Step 2: Add "Save X%" badge to semester toggle**

Find the billing toggle. Add badge next to semester option:

```tsx
<Badge color="green" variant="light" size="sm" ml={4}>
  {t.pricing.save33}
</Badge>
```

**Step 3: Add "Most Popular" ribbon to Pro card**

```tsx
<Box style={{ position: 'relative' }}>
  <Badge
    color="indigo"
    variant="filled"
    size="sm"
    style={{ position: 'absolute', top: -10, right: 16, zIndex: 1 }}
  >
    {t.pricing.mostPopular}
  </Badge>
  <Paper ...>
    {/* Pro plan card */}
  </Paper>
</Box>
```

**Step 4: Add i18n keys for comparison features**

**Step 5: Commit**

```bash
git add src/app/\(protected\)/pricing/page.tsx src/i18n/translations.ts
git commit -m "feat(ui): pricing comparison table, save badge, and most popular ribbon"
```

---

### Task 5.3: Help page — search + icons + response time

**Files:**
- Modify: `src/app/(protected)/help/page.tsx`

**Step 1: Add search input at top**

```tsx
const [search, setSearch] = useState('');

const filteredFaqs = faqs.filter(faq =>
  faq.question.toLowerCase().includes(search.toLowerCase()) ||
  faq.answer.toLowerCase().includes(search.toLowerCase())
);

<TextInput
  placeholder={t.help.searchPlaceholder}
  leftSection={<IconSearch size={16} />}
  value={search}
  onChange={(e) => setSearch(e.currentTarget.value)}
  mb="lg"
/>
```

**Step 2: Add category icon per FAQ item**

Map categories to icons: Getting Started → `IconRocket`, Tutoring → `IconSchool`, Billing → `IconCreditCard`, Technical → `IconSettings`.

**Step 3: Add empty search state**

```tsx
{filteredFaqs.length === 0 && (
  <Text c="dimmed" ta="center" py="xl">{t.help.noResults}</Text>
)}
```

**Step 4: Add response time to contact section**

```tsx
<Text fz="sm" c="dimmed">{t.help.responseTime}</Text>
```

**Step 5: Commit**

```bash
git add src/app/\(protected\)/help/page.tsx src/i18n/translations.ts
git commit -m "feat(ui): help page search, category icons, and response time"
```

---

### Task 5.4: Personalization — delete confirmation + avatar placeholder

**Files:**
- Modify: `src/app/(protected)/personalization/page.tsx`

**Step 1: Add delete account confirmation modal**

```tsx
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
const [deleteInput, setDeleteInput] = useState('');

<FullScreenModal
  opened={deleteConfirmOpen}
  onClose={() => { setDeleteConfirmOpen(false); setDeleteInput(''); }}
  title={t.personalization.deleteAccountTitle}
>
  <Stack>
    <Text c="dimmed">{t.personalization.deleteConfirmMessage}</Text>
    <TextInput
      label={t.personalization.typeDelete}
      value={deleteInput}
      onChange={(e) => setDeleteInput(e.currentTarget.value)}
      placeholder="DELETE"
    />
    <Button
      color="red"
      disabled={deleteInput !== 'DELETE'}
      onClick={handleDeleteAccount}
    >
      {t.personalization.confirmDelete}
    </Button>
  </Stack>
</FullScreenModal>
```

**Step 2: Add avatar upload placeholder**

```tsx
<Box
  w={80}
  h={80}
  style={{
    borderRadius: '50%',
    border: '2px dashed var(--mantine-color-gray-4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }}
  onClick={() => {/* future: open file picker */}}
>
  <IconCamera size={24} color="var(--mantine-color-gray-5)" />
</Box>
```

**Step 3: Commit**

```bash
git add src/app/\(protected\)/personalization/page.tsx src/i18n/translations.ts
git commit -m "feat(ui): delete account confirmation and avatar placeholder on personalization"
```

---

### Task 5.5: Verify and PR

```bash
npm run lint && npx tsc --noEmit && npm run build
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-settings
gh pr create --title "feat(ui): settings, pricing, help, personalization page polish" \
  --body "$(cat <<'EOF'
## Summary
- Settings: section cards, usage numeric label, preference toast, Coming Soon badge
- Pricing: feature comparison table, Save 33% badge, Most Popular ribbon
- Help: search input with real-time filtering, category icons, response time, empty results
- Personalization: type-DELETE confirmation modal, avatar upload placeholder

## Test plan
- [ ] Verify settings sections are visually grouped in cards
- [ ] Verify usage label shows "X / Y queries used"
- [ ] Verify toast appears on preference change
- [ ] Verify Coming Soon badge on notifications
- [ ] Verify comparison table renders with check/x icons
- [ ] Verify save badge appears next to semester toggle
- [ ] Verify Most Popular ribbon on Pro card
- [ ] Verify FAQ search filters in real-time
- [ ] Verify empty search shows "No results"
- [ ] Verify delete account requires typing "DELETE"
- [ ] Verify avatar placeholder renders with camera icon
- [ ] Verify build passes
EOF
)"
```

---

## Agent 6: agent-landing — Landing / Login / Global Components

**Branch:** `feature/uiux-landing`
**Worktree:** `.worktrees/uiux-landing`
**Estimated Size:** M (Medium) — 4 files, ~160 lines changed, 8 sub-tasks
**Commit scope:** `ui`

### Task 6.1: Navbar backdrop-blur + shadow on scroll

**Files:**
- Modify: `src/components/marketing/Navbar.tsx`

**Step 1: Add scroll detection and blur effect**

```tsx
const [scrolled, setScrolled] = useState(false);

useEffect(() => {
  const handleScroll = () => setScrolled(window.scrollY > 10);
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

// On the navbar container:
style={{
  backdropFilter: scrolled ? 'blur(12px)' : undefined,
  WebkitBackdropFilter: scrolled ? 'blur(12px)' : undefined,
  boxShadow: scrolled ? 'var(--mantine-shadow-sm)' : undefined,
  backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
  transition: 'all 0.3s ease',
}}
```

For dark mode, use `rgba(0, 0, 0, 0.8)` via `useMantineColorScheme()`.

**Step 2: Commit**

```bash
git add src/components/marketing/Navbar.tsx
git commit -m "style(ui): add backdrop-blur and shadow-on-scroll to marketing navbar"
```

---

### Task 6.2: Hero countUp animation

**Files:**
- Modify: `src/components/marketing/HeroSection.tsx`

**Step 1: Create inline countUp hook**

```tsx
function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, target, duration]);

  return { count, ref: setRef };
}
```

**Step 2: Apply to stat numbers**

Replace static numbers with `useCountUp`:

```tsx
const stat1 = useCountUp(1000);
const stat2 = useCountUp(50);

<Text ref={stat1.ref} fw={700} fz={36}>{stat1.count.toLocaleString()}+</Text>
```

**Step 3: Commit**

```bash
git add src/components/marketing/HeroSection.tsx
git commit -m "feat(ui): add countUp animation to hero stats on viewport entry"
```

---

### Task 6.3: Hero CSS grid background pattern

**Files:**
- Modify: `src/components/marketing/HeroSection.tsx`

**Step 1: Add pure CSS grid pattern background**

Add to the hero section container:

```tsx
<Box
  style={{
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(79, 70, 229, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79, 70, 229, 0.03) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
    zIndex: 0,
  }}
/>
```

Ensure main content has `position: relative; z-index: 1;`.

**Step 2: Commit**

```bash
git add src/components/marketing/HeroSection.tsx
git commit -m "style(ui): add CSS grid pattern background to hero section"
```

---

### Task 6.4: Login — inline validation + password strength

**Files:**
- Modify: `src/app/(public)/login/page.tsx`

**Step 1: Add real-time validation**

```tsx
const [emailError, setEmailError] = useState('');
const [passwordError, setPasswordError] = useState('');

const validateEmail = (email: string) => {
  if (!email) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : t.login.invalidEmail;
};

// On TextInput:
<TextInput
  error={emailError}
  onBlur={(e) => setEmailError(validateEmail(e.currentTarget.value))}
  onChange={(e) => {
    if (emailError) setEmailError(validateEmail(e.currentTarget.value));
  }}
/>
```

**Step 2: Add password strength indicator (signup mode)**

```tsx
const getPasswordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
};

const strengthColor = ['red', 'red', 'orange', 'yellow', 'green', 'green'];
const strengthLabel = ['', t.login.weak, t.login.weak, t.login.medium, t.login.strong, t.login.strong];

// Below password input (signup mode only):
{isSignup && password && (
  <Box>
    <Progress
      value={(strength / 5) * 100}
      color={strengthColor[strength]}
      size="xs"
      radius="xl"
      mb={4}
    />
    <Text fz="xs" c={strengthColor[strength]}>{strengthLabel[strength]}</Text>
  </Box>
)}
```

**Step 3: Commit**

```bash
git add src/app/\(public\)/login/page.tsx src/i18n/translations.ts
git commit -m "feat(ui): add inline validation and password strength indicator to login"
```

---

### Task 6.5: Login — social login + error shake

**Files:**
- Modify: `src/app/(public)/login/page.tsx`

**Step 1: Add "Coming Soon" badge to social login buttons**

If social login buttons exist, add badge. If they don't exist, skip.

**Step 2: Add error shake animation**

On form submission error, add a shake class:

```tsx
const [shake, setShake] = useState(false);

// On error:
setShake(true);
setTimeout(() => setShake(false), 600);

// On the form container:
style={shake ? { animation: 'shake 0.5s ease-in-out' } : undefined}

// Keyframes:
<style>{`
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`}</style>
```

**Step 3: Commit**

```bash
git add src/app/\(public\)/login/page.tsx
git commit -m "style(ui): add error shake animation and social login badges on login"
```

---

### Task 6.6: Sidebar session count + pin toast

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add session count badge per module header**

Find where module headers are rendered (Lecture Helper, Assignment Coach, Mock Exam). Add count badge:

```tsx
<Badge size="xs" variant="light" color="gray" ml={4}>
  {sessions.filter(s => s.mode === mode).length}
</Badge>
```

**Step 2: Add toast on pin/unpin**

Find pin/unpin handler. Add:

```tsx
showNotification({
  message: isPinned ? t.sidebar.unpinned : t.sidebar.pinned,
  color: 'indigo',
  autoClose: 2000,
});
```

**Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/i18n/translations.ts
git commit -m "feat(ui): add session count badges and pin toast to sidebar"
```

---

### Task 6.7: Testimonials carousel (optional enhancement)

**Files:**
- Modify: `src/components/marketing/TestimonialsSection.tsx`

**Step 1: Mobile carousel**

On mobile, show testimonials in a horizontally scrollable container:

```tsx
<ScrollArea type="never" hiddenFrom="sm">
  <Group wrap="nowrap" gap="md">
    {testimonials.map((t, i) => (
      <Paper key={i} p="md" radius="md" withBorder miw={280}>
        {/* testimonial content */}
      </Paper>
    ))}
  </Group>
</ScrollArea>
```

Keep desktop grid layout unchanged.

**Step 2: Commit**

```bash
git add src/components/marketing/TestimonialsSection.tsx
git commit -m "style(ui): add horizontal scroll carousel for mobile testimonials"
```

---

### Task 6.8: Verify and PR

```bash
npm run lint && npx tsc --noEmit && npm run build
git fetch origin main && git merge origin/main --no-edit
git push -u origin feature/uiux-landing
gh pr create --title "feat(ui): landing, login, and global component polish" \
  --body "$(cat <<'EOF'
## Summary
- Navbar: backdrop-blur + shadow on scroll
- Hero: countUp animation on stats, CSS grid background pattern
- Login: inline email/password validation, password strength indicator, error shake
- Sidebar: session count badges per module, pin/unpin toast
- Testimonials: mobile horizontal scroll carousel

## Test plan
- [ ] Verify navbar blur appears on scroll, clears at top
- [ ] Verify dark mode navbar blur uses dark background
- [ ] Verify countUp triggers on viewport entry, only once
- [ ] Verify CSS grid pattern is subtle and doesn't affect readability
- [ ] Verify email validation shows on blur, clears on valid input
- [ ] Verify password strength bar shows weak/medium/strong
- [ ] Verify error shake animation plays on failed submit
- [ ] Verify session count badges are accurate
- [ ] Verify pin toast shows correct message
- [ ] Verify mobile testimonials scroll horizontally
- [ ] Verify build passes
EOF
)"
```

---

## Agent Summary & Sizing

| Agent | Branch | Est. Size | Files Modified | Key Risk |
|-------|--------|-----------|----------------|----------|
| **Phase 0** | `feature/uiux-global-infra` | S | 8 | Must merge first; blocks all others |
| **agent-study** | `feature/uiux-study` | S | 1 | Low — single file, cosmetic |
| **agent-chat** | `feature/uiux-chat` | **L** | 7 | High — most files, skeleton + shimmer + toasts |
| **agent-exam** | `feature/uiux-exam` | **L** | 5 | High — RingProgress, color logic, mobile nav |
| **agent-knowledge** | `feature/uiux-knowledge` | M-L | 5 | Medium — batch operations add state complexity |
| **agent-settings** | `feature/uiux-settings` | M | 4 | Medium — comparison table + delete modal |
| **agent-landing** | `feature/uiux-landing` | M | 4 | Medium — countUp hook, scroll listener |

**Recommended turns allocation:**
- agent-study: 10-15 turns
- agent-chat: 25-30 turns
- agent-exam: 25-30 turns
- agent-knowledge: 20-25 turns
- agent-settings: 15-20 turns
- agent-landing: 15-20 turns

---

## Merge Order

```
1. feature/uiux-global-infra  (Phase 0 — BLOCKER)
2. All Phase 1 PRs in any order (independent):
   ├── feature/uiux-study
   ├── feature/uiux-chat
   ├── feature/uiux-exam
   ├── feature/uiux-knowledge
   ├── feature/uiux-settings
   └── feature/uiux-landing
```

Each Phase 1 PR should `git fetch origin main && git merge origin/main --no-edit` before pushing, to include Phase 0 changes. If two Phase 1 PRs modify the same file (e.g., `translations.ts`), merge one first, then the other rebases on updated main.

**Shared file risk:** `src/i18n/translations.ts` is modified by agents 2, 3, 4, 5, 6. Merge conflicts are likely but trivial (additive keys in different sections). Recommend merging in this order to minimize conflicts: study → chat → exam → knowledge → settings → landing.
