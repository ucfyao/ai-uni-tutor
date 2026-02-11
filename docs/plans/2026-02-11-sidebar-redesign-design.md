# Sidebar Redesign: Module-Grouped Navigation

## Goal

Replace the current flat sidebar ("+New" button + "Your chats" list) with a module-grouped sidebar that surfaces the 3 core product features as first-class entries, with chat history grouped under each chat-based module.

## Target User

Australian university students (MVP), expanding later.

## Architecture

### Sidebar Layout (Expanded)

```
┌──────────────────────────┐
│  Logo                [≡] │  52px header
├──────────────────────────┤
│                          │
│  📖 课件讲解    [+]      │  module row: icon + label + [+] on hover
│  ┊  线性代数 期末复习     │  chat list (auto-expanded for active module)
│  ┊  高数 第三章笔记      │
│  ┊  COMP9417 Week5       │
│                          │
│  ✏️ 作业分析    [+]      │  collapsed: only module row visible
│  ▸                       │
│                          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  subtle divider
│  📝 模拟考试          →  │  no [+], full-row click → /exam
│  📚 知识库            →  │  no [+], full-row click → /knowledge
│                          │
├──────────────────────────┤
│  👤 Name          [Plus] │
└──────────────────────────┘
```

### Sidebar Layout (Collapsed / Icon-only)

```
┌────┐
│ ≡  │
│ 📖 │  tooltip: 课件讲解 → expand sidebar + open module
│ ✏️ │  tooltip: 作业分析 → expand sidebar + open module
│ 📝 │  tooltip: 模拟考试 → navigate /exam
│ 📚 │  tooltip: 知识库 → navigate /knowledge
│    │
│ 👤 │
└────┘
```

### Interaction Rules

- Click module label (e.g. "课件讲解") → toggle expand/collapse chat list
- Click `[+]` → open NewSessionModal with mode pre-selected (only pick course)
- Active session's module auto-expands, others collapse
- Chat list sorted by `lastUpdated`, pinned first
- Each module shows max 10 sessions, "查看全部" link if more
- `[+]` button only visible on module row hover (prevents clutter)

## New Chat Flow

### Before (4 steps)

```
+New → select Mode → select University → select Course → create session
```

### After (2 steps)

```
Click [+] on module → select University + Course → create session
```

Mode is implicit from which module's [+] was clicked.

### Simplified NewSessionModal

```
┌─────────────────────────────┐
│  新建课件讲解对话        [×] │  title includes mode name
├─────────────────────────────┤
│  🏫 Institution             │
│  [UNSW Sydney          ▾]   │  remembers last selection (localStorage)
│                             │
│  📖 Target Subject          │
│  [COMP9417 ML          ▾]   │  remembers last selection (localStorage)
│                             │
│  [ 开始对话 →              ]│  button color follows module theme
└─────────────────────────────┘
```

- Remove mode selection row from modal entirely
- CTA button color: indigo (课件), violet (作业)
- Pre-fill university/course from localStorage (existing behavior)

## /study Page Changes

Retain as onboarding/guide page for new users. 3 cards with updated behavior:

- 课件讲解 card → open NewSessionModal (mode=Lecture Helper)
- 作业分析 card → open NewSessionModal (mode=Assignment Coach)
- 模拟考试 card → `router.push('/exam')`

Remove Exam Prep as a chat mode from this page.

## Route Changes

| Route              | Action                                   |
| ------------------ | ---------------------------------------- |
| `/study`           | Keep — simplified guide page             |
| `/lecture/[id]`    | Keep — no change                         |
| `/assignment/[id]` | Keep — no change                         |
| `/exam/[id]`       | **Delete** — Exam Prep chat mode removed |
| `/exam`            | Keep — mock exam entry                   |
| `/exam/mock/[id]`  | Keep — mock exam taking                  |
| `/exam/history`    | Keep — mock exam history                 |

## Type Changes

```typescript
// Before
type TutoringMode = 'Lecture Helper' | 'Assignment Coach' | 'Exam Prep';

// After
type TutoringMode = 'Lecture Helper' | 'Assignment Coach';
```

## Files to Delete

- `src/app/(protected)/exam/[id]/` — entire directory (Exam Prep chat page)
- `src/constants/modes.ts` — remove 'Exam Prep' entry
- `src/lib/strategies/ExamPrepStrategy.ts` — if exists
- Any ExamPrep-specific components in `src/components/modes/`

## SessionContext Changes

No DB or type changes. Frontend-only grouping:

```typescript
const lectureSessions = sessions.filter((s) => s.mode === 'Lecture Helper');
const assignmentSessions = sessions.filter((s) => s.mode === 'Assignment Coach');
```

## Visual Design

### Module Row

- Height: 36px (matches existing nav items)
- Normal: `bg: transparent`, `text: gray.7`
- Hover: `bg: gray.0`
- Expanded: `text: gray.9`, `fw: 600`
- Icons: lucide-react (Presentation, Compass, FileQuestion, GraduationCap)

### [+] Button

- Visible only on module row hover
- 16px, `variant: subtle`, `color: gray`
- Click does NOT bubble to expand/collapse

### Chat List Items

- Reuse existing `SessionItem` component
- Indent: `pl={24}` to show hierarchy
- Active session: `bg: gray.1`

### Jump Links (模拟考试 / 知识库)

- No [+], no expand arrow
- Hover shows `→` arrow hint
- Click navigates, sidebar stays

### Divider

- Between chat modules and jump links
- `borderTop: 1px solid gray.1`
