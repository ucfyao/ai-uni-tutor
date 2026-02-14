# Mock Exam Flow Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the mock exam flow to: select course → select mode → start. Remove all unnecessary UI (Paper Bank, Quick Generate, upload, history page, in-exam mode switching). Store mode in DB.

**Architecture:** Backend-first. Add `mode` column to `mock_exams` table, update types/repo/service/action, then rewrite the two frontend pages. Remove dead code last.

**Tech Stack:** Next.js 16 App Router, Mantine v8, Supabase PostgreSQL, TypeScript

---

### Task 1: Add `mode` column to database

**Files:**

- Create: `supabase/migrations/20260215_mock_exam_mode.sql`
- Modify: `src/types/database.ts:279-323`

**Step 1: Write the migration**

```sql
-- Add mode column to mock_exams table
ALTER TABLE mock_exams
  ADD COLUMN mode text NOT NULL DEFAULT 'practice'
  CHECK (mode IN ('practice', 'exam'));
```

Create file: `supabase/migrations/20260215_mock_exam_mode.sql`

**Step 2: Update database types**

In `src/types/database.ts`, add `mode` to all three mock_exams type shapes:

Row (line ~291, after `status`):

```typescript
mode: 'practice' | 'exam';
```

Insert (line ~305, after `status?`):

```typescript
mode?: 'practice' | 'exam';
```

Update (line ~319, after `status?`):

```typescript
mode?: 'practice' | 'exam';
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260215_mock_exam_mode.sql src/types/database.ts
git commit -m "feat(db): add mode column to mock_exams table"
```

---

### Task 2: Update domain types

**Files:**

- Modify: `src/types/exam.ts:55-67`

**Step 1: Add `mode` to MockExam interface**

In `src/types/exam.ts`, add `mode` field to `MockExam` interface after `paperId`:

```typescript
export interface MockExam {
  id: string;
  userId: string;
  paperId: string;
  mode: ExamMode;
  title: string;
  questions: MockExamQuestion[];
  responses: MockExamResponse[];
  score: number | null;
  totalPoints: number;
  currentIndex: number;
  status: 'in_progress' | 'completed';
  createdAt: string;
}
```

**Step 2: Commit**

```bash
git add src/types/exam.ts
git commit -m "feat(ui): add mode field to MockExam type"
```

---

### Task 3: Update Repository to handle `mode`

**Files:**

- Modify: `src/lib/repositories/MockExamRepository.ts`

**Step 1: Update `mapToMockExam` (line 18-32)**

Add `mode` mapping:

```typescript
private mapToMockExam(row: MockExamRow): MockExam {
  return {
    id: row.id,
    userId: row.user_id,
    paperId: row.paper_id,
    mode: row.mode as 'practice' | 'exam',
    title: row.title,
    questions: (row.questions ?? []) as unknown as MockExamQuestion[],
    responses: (row.responses ?? []) as unknown as MockExamResponse[],
    score: row.score,
    totalPoints: row.total_points,
    currentIndex: row.current_index,
    status: row.status,
    createdAt: row.created_at,
  };
}
```

**Step 2: Update `create` method (line 34-66)**

Add `mode` to create signature and insert:

```typescript
async create(data: {
  userId: string;
  paperId: string;
  sessionId?: string | null;
  title: string;
  mode: 'practice' | 'exam';
  questions: Json;
  responses: Json;
  totalPoints: number;
  currentIndex?: number;
  status?: 'in_progress' | 'completed';
}): Promise<string> {
```

Add to the insert object:

```typescript
mode: data.mode,
```

**Step 3: Commit**

```bash
git add src/lib/repositories/MockExamRepository.ts
git commit -m "feat(db): add mode support to MockExamRepository"
```

---

### Task 4: Update Service to accept `mode`

**Files:**

- Modify: `src/lib/services/MockExamService.ts`

**Step 1: Update `generateMock` method (line 214-322)**

Add `mode` parameter:

```typescript
async generateMock(
  userId: string,
  paperId: string,
  mode: 'practice' | 'exam',
  sessionId?: string,
): Promise<{ mockId: string }> {
```

Pass `mode` to `this.mockRepo.create(...)`:

```typescript
const mockId = await this.mockRepo.create({
  userId,
  paperId,
  sessionId: sessionId ?? null,
  title,
  mode,
  questions: generatedQuestions as unknown as Json,
  responses: [] as unknown as Json,
  totalPoints,
  currentIndex: 0,
  status: 'in_progress',
});
```

**Step 2: Update `startFromCourse` method (line 191-209)**

Add `mode` parameter and pass through:

```typescript
async startFromCourse(
  userId: string,
  sessionId: string,
  courseCode: string,
  mode: 'practice' | 'exam' = 'practice',
): Promise<{ mockId: string }> {
  const paperId = await this.paperRepo.findByCourse(courseCode);

  if (!paperId) {
    throw new AppError(
      'NOT_FOUND',
      'No exam papers available for this course yet. Ask your admin to upload past exams.',
    );
  }

  const { mockId } = await this.generateMock(userId, paperId, mode, sessionId);
  return { mockId };
}
```

**Step 3: Update `generateFromTopic` method (line 73-185)**

Add `mode` to create call:

```typescript
const mockId = await this.mockRepo.create({
  userId,
  paperId,
  sessionId: null,
  title,
  mode: 'practice',
  questions: mockQuestions as unknown as Json,
  responses: [] as unknown as Json,
  totalPoints,
  currentIndex: 0,
  status: 'in_progress',
});
```

**Step 4: Commit**

```bash
git add src/lib/services/MockExamService.ts
git commit -m "feat(api): add mode support to MockExamService"
```

---

### Task 5: Update Server Actions

**Files:**

- Modify: `src/app/actions/mock-exams.ts`

**Step 1: Update `generateMockExam` action (line 84-109)**

Change signature from `paperId` to `courseCode, mode`:

```typescript
export async function generateMockExam(
  courseCode: string,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    await getQuotaService().enforce(user.id);

    const service = getMockExamService();
    const paperId = await service.findPaperByCourse(courseCode);
    if (!paperId) {
      return { success: false, error: 'No exam papers available for this course' };
    }
    const { mockId } = await service.generateMock(user.id, paperId, mode);

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Mock exam generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate mock exam',
    };
  }
}
```

Note: We need to expose `findByCourse` from the service. Add a thin wrapper in MockExamService:

```typescript
async findPaperByCourse(courseCode: string): Promise<string | null> {
  return this.paperRepo.findByCourse(courseCode);
}
```

**Step 2: Update `startMockExamSession` (line 13-39)**

Add `mode` parameter:

```typescript
export async function startMockExamSession(
  sessionId: string,
  courseCode: string,
  mode: 'practice' | 'exam' = 'practice',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
```

Pass mode to service:

```typescript
const result = await service.startFromCourse(user.id, sessionId, courseCode, mode);
```

**Step 3: Remove revalidatePath('/exam/history')**

Remove all `revalidatePath('/exam/history')` calls — that page is being deleted.

**Step 4: Commit**

```bash
git add src/app/actions/mock-exams.ts src/lib/services/MockExamService.ts
git commit -m "feat(api): update generateMockExam to accept courseCode + mode"
```

---

### Task 6: Rewrite Exam Entry Page

**Files:**

- Rewrite: `src/app/(protected)/exam/page.tsx`
- Rewrite: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Rewrite `page.tsx`**

Strip out paper fetching. Only pass course data:

```typescript
import { Box, Container } from '@mantine/core';
import { COURSES, UNIVERSITIES } from '@/constants';
import { ExamEntryClient } from './ExamEntryClient';

export default function ExamPage() {
  return (
    <Container size="md" py={48} style={{ position: 'relative' }}>
      <Box
        style={{
          position: 'absolute',
          top: -40,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 200,
          background:
            'radial-gradient(ellipse at center, var(--mantine-color-indigo-0) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.7,
        }}
      />
      <Box style={{ position: 'relative', zIndex: 1 }}>
        <ExamEntryClient courses={COURSES} universities={UNIVERSITIES} />
      </Box>
    </Container>
  );
}
```

Note: No longer async — no server data fetching needed. Courses are constants.

**Step 2: Rewrite `ExamEntryClient.tsx`**

Replace the entire Paper Bank + Quick Generate + Upload + Recent Mocks with a simple form: course selector → mode cards → start button.

```typescript
'use client';

import { IconLoader2, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { generateMockExam } from '@/app/actions/mock-exams';
import { useLanguage } from '@/i18n/LanguageContext';
import type { ExamMode } from '@/types/exam';
import type { Course, University } from '@/types/index';

interface Props {
  courses: Course[];
  universities: University[];
}

export function ExamEntryClient({ courses, universities }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<ExamMode>('practice');
  const [error, setError] = useState<string | null>(null);

  const courseOptions = courses.map((c) => {
    const uni = universities.find((u) => u.id === c.universityId);
    return {
      value: c.code,
      label: `${c.code} — ${c.name}`,
      group: uni?.shortName ?? 'Other',
    };
  });

  const handleStart = () => {
    if (!selectedCourse) return;
    setError(null);

    startTransition(async () => {
      const result = await generateMockExam(selectedCourse, selectedMode);
      if (result.success) {
        router.push(`/exam/mock/${result.mockId}`);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Box className="animate-fade-in-up">
        <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
          {t.exam.startExam}
        </Title>
        <Text c="dimmed" size="md" fw={400} mt={2}>
          Generate mock exams from real past papers
        </Text>
      </Box>

      {/* Course + Mode + Start */}
      <Card
        withBorder
        radius="lg"
        p="xl"
        className="animate-fade-in-up animate-delay-100"
        style={{
          borderColor: 'var(--mantine-color-gray-2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          opacity: 0,
        }}
      >
        <Stack gap="lg">
          {/* Course selector */}
          <Select
            label="Course"
            placeholder="Select a course"
            data={courseOptions}
            value={selectedCourse}
            onChange={setSelectedCourse}
            searchable
            size="md"
          />

          {/* Mode selector */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Mode
            </Text>
            <Group grow gap="md">
              <ModeCard
                active={selectedMode === 'practice'}
                title="Practice"
                description="Answer one question at a time with immediate feedback"
                onClick={() => setSelectedMode('practice')}
              />
              <ModeCard
                active={selectedMode === 'exam'}
                title="Exam"
                description="Answer all questions, then submit for a final score"
                onClick={() => setSelectedMode('exam')}
              />
            </Group>
          </div>

          {/* Error */}
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          {/* Start button */}
          <Button
            size="lg"
            radius="md"
            variant="gradient"
            gradient={{ from: 'indigo', to: 'violet' }}
            leftSection={
              isPending ? (
                <IconLoader2 size={20} className="animate-spin" />
              ) : (
                <IconSparkles size={20} />
              )
            }
            loading={isPending}
            disabled={!selectedCourse}
            onClick={handleStart}
            fullWidth
          >
            Start Mock Exam
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          borderColor: active
            ? 'var(--mantine-color-violet-5)'
            : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <Text fw={600} size="sm">
          {title}
        </Text>
        <Text size="xs" c="dimmed" mt={4}>
          {description}
        </Text>
      </Card>
    </UnstyledButton>
  );
}
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

**Step 4: Commit**

```bash
git add src/app/(protected)/exam/page.tsx src/app/(protected)/exam/ExamEntryClient.tsx
git commit -m "feat(ui): rewrite exam entry page with course + mode selector"
```

---

### Task 7: Update MockExamClient — remove mode switcher, lock mode from record

**Files:**

- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Read mode from mock record instead of local state**

Replace line 50:

```typescript
const [mode, setMode] = useState<ExamMode>('practice');
```

With:

```typescript
const mode = mock.mode;
```

Remove the `ExamMode` import from `@/types/exam` only if it's no longer needed elsewhere in this file (it will still be used as the type of `mock.mode`).

**Step 2: Remove SegmentedControl from header**

Delete the entire SegmentedControl block (lines 272-281):

```typescript
<SegmentedControl
  value={mode}
  onChange={(v) => setMode(v as ExamMode)}
  data={[
    { label: 'Practice', value: 'practice' },
    { label: 'Exam', value: 'exam' },
  ]}
  disabled={hasSubmitted}
  size="sm"
/>
```

Also remove `SegmentedControl` from the Mantine imports.

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(protected)/exam/mock/[id]/MockExamClient.tsx
git commit -m "feat(ui): lock exam mode from record, remove mode switcher"
```

---

### Task 8: Remove dead files

**Files:**

- Delete: `src/app/(protected)/exam/ExamPaperUploadModal.tsx`
- Delete: `src/app/(protected)/exam/history/page.tsx`

**Step 1: Delete ExamPaperUploadModal**

```bash
rm src/app/(protected)/exam/ExamPaperUploadModal.tsx
```

**Step 2: Delete history page**

```bash
rm src/app/(protected)/exam/history/page.tsx
rmdir src/app/(protected)/exam/history
```

**Step 3: Clean up dead imports**

Grep for any remaining references to deleted files and fix:

- `ExamPaperUploadModal` — should be gone from ExamEntryClient (already rewritten in Task 6)
- `/exam/history` — remove any links to this route if still present

**Step 4: Run type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ui): remove ExamPaperUploadModal and history page"
```

---

### Task 9: Verification — build + tests

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

**Step 2: Run linter**

Run: `npm run lint`
Expected: 0 errors

**Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit any remaining fixes**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(ui): address build/test issues from exam flow redesign"
```

---

### Task 10: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feature/exam-flow-redesign
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(ui): simplify mock exam flow — course + mode selector" --body "$(cat <<'EOF'
## Summary
- Simplified exam entry page: select course → select mode → start
- Removed Paper Bank, Quick Generate, Upload modal, history page, in-exam mode switcher
- Added `mode` column to `mock_exams` table (stored at creation time)
- Mode is now locked when mock exam is created, no switching mid-exam

## What Changed
- **Entry page**: Single card with course dropdown, Practice/Exam mode cards, Start button
- **Mock exam page**: Reads mode from DB record, no SegmentedControl
- **Backend**: `generateMockExam(courseCode, mode)` replaces `generateMockExam(paperId)`
- **Removed**: `ExamPaperUploadModal.tsx`, `history/page.tsx`

## Test plan
- [ ] Select course → select Practice → Start → verify practice mode (immediate feedback)
- [ ] Select course → select Exam → Start → verify exam mode (batch submit)
- [ ] Verify mode cannot be changed mid-exam
- [ ] Verify `/exam/history` returns 404
- [ ] Verify sidebar still lists past exams
- [ ] Run `npx vitest run` — all tests pass
- [ ] Run `npm run build` — build succeeds

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
