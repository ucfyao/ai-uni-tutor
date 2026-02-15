# Mock Exam Multiple Question Sources — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the exam entry page to support three question sources: real exam papers (direct), random mix across papers, and AI-generated from topic (existing).

**Architecture:** Add two new service methods (`createFromPaper`, `createRandomMix`) that create mock exams from existing exam questions without AI calls. Add one new repository method (`findAllByCourse`). Redesign `ExamEntryClient` with a source selector and conditional options. The answer/review page (`MockExamClient`) remains unchanged.

**Tech Stack:** Next.js Server Actions, Supabase (existing tables), Mantine v8, TypeScript

---

### Task 1: Add `findAllByCourse()` to ExamPaperRepository

**Files:**

- Modify: `src/lib/domain/interfaces/IExamPaperRepository.ts:53` (add interface method)
- Modify: `src/lib/repositories/ExamPaperRepository.ts:273-290` (add implementation after `findByCourse`)

**Step 1: Add interface method**

In `src/lib/domain/interfaces/IExamPaperRepository.ts`, add after `findByCourse` (line 53):

```typescript
findAllByCourse(courseCode: string): Promise<ExamPaper[]>;
```

**Step 2: Add implementation**

In `src/lib/repositories/ExamPaperRepository.ts`, add after the `findByCourse` method (after line 290):

```typescript
async findAllByCourse(courseCode: string): Promise<ExamPaper[]> {
  const sanitized = courseCode.replace(/[^A-Za-z0-9 _-]/g, '');
  if (!sanitized) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('exam_papers')
    .select('*, exam_questions(count)')
    .ilike('course', `%${sanitized}%`)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (error) {
    throw new DatabaseError(`Failed to find exam papers for course: ${error.message}`, error);
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const countArr = row.exam_questions as Array<{ count: number }> | undefined;
    const questionCount = countArr?.[0]?.count ?? 0;
    return mapPaperRow(row, questionCount);
  });
}
```

**Step 3: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no errors related to ExamPaperRepository

**Step 4: Commit**

```bash
git add src/lib/domain/interfaces/IExamPaperRepository.ts src/lib/repositories/ExamPaperRepository.ts
git commit -m "feat(db): add findAllByCourse to ExamPaperRepository"
```

---

### Task 2: Add `createFromPaper()` to MockExamService

**Files:**

- Modify: `src/lib/services/MockExamService.ts:60-67` (add method after constructor)

**Step 1: Add method**

In `src/lib/services/MockExamService.ts`, add after the constructor (after line 67), before `generateFromTopic`:

```typescript
/**
 * Create a mock exam directly from an existing exam paper's original questions.
 * No AI generation — uses the real questions as-is.
 */
async createFromPaper(
  userId: string,
  paperId: string,
  mode: 'practice' | 'exam' = 'practice',
): Promise<{ mockId: string }> {
  const paper = await this.paperRepo.findById(paperId);
  if (!paper) throw new AppError('NOT_FOUND', 'Exam paper not found');

  const questions = await this.paperRepo.findQuestionsByPaperId(paperId);
  if (questions.length === 0) {
    throw new AppError('NOT_FOUND', 'No questions found for this paper');
  }

  const count = await this.mockRepo.countByUserAndPaper(userId, paperId);
  const title = `${paper.title} #${count + 1}`;

  const mockQuestions: MockExamQuestion[] = questions.map((q) => ({
    content: q.content,
    type: q.type,
    options: q.options as Record<string, string> | null,
    answer: q.answer,
    explanation: q.explanation,
    points: q.points,
    sourceQuestionId: q.id,
  }));

  const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

  const mockId = await this.mockRepo.create({
    userId,
    paperId,
    title,
    mode,
    questions: mockQuestions as unknown as Json,
    responses: [] as unknown as Json,
    totalPoints,
    currentIndex: 0,
    status: 'in_progress',
  });

  return { mockId };
}
```

**Step 2: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/services/MockExamService.ts
git commit -m "feat(exam): add createFromPaper to MockExamService"
```

---

### Task 3: Add `createRandomMix()` to MockExamService

**Files:**

- Modify: `src/lib/services/MockExamService.ts` (add method after `createFromPaper`)

**Step 1: Add method**

Add after the `createFromPaper` method:

```typescript
/**
 * Create a mock exam by randomly selecting questions from all papers for a course.
 */
async createRandomMix(
  userId: string,
  courseCode: string,
  numQuestions: number,
  mode: 'practice' | 'exam' = 'practice',
): Promise<{ mockId: string }> {
  const papers = await this.paperRepo.findAllByCourse(courseCode);
  if (papers.length === 0) {
    throw new AppError('NOT_FOUND', 'No exam papers available for this course');
  }

  // Gather all questions from all papers
  const allQuestions: Array<ExamQuestion & { paperTitle: string }> = [];
  for (const paper of papers) {
    const questions = await this.paperRepo.findQuestionsByPaperId(paper.id);
    allQuestions.push(...questions.map((q) => ({ ...q, paperTitle: paper.title })));
  }

  if (allQuestions.length === 0) {
    throw new AppError('NOT_FOUND', 'No questions found for this course');
  }

  // Shuffle using Fisher-Yates
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  const selected = allQuestions.slice(0, Math.min(numQuestions, allQuestions.length));

  const mockQuestions: MockExamQuestion[] = selected.map((q) => ({
    content: q.content,
    type: q.type,
    options: q.options as Record<string, string> | null,
    answer: q.answer,
    explanation: q.explanation,
    points: q.points,
    sourceQuestionId: q.id,
  }));

  const totalPoints = mockQuestions.reduce((sum, q) => sum + q.points, 0);

  // Create a virtual paper for FK constraint
  const virtualPaperId = await this.paperRepo.create({
    userId,
    title: `Random Mix — ${courseCode}`,
    course: courseCode,
    visibility: 'private',
    status: 'ready',
    questionTypes: [...new Set(mockQuestions.map((q) => q.type))],
  });

  const title = `Random Mix — ${courseCode} (${selected.length} questions)`;

  const mockId = await this.mockRepo.create({
    userId,
    paperId: virtualPaperId,
    title,
    mode,
    questions: mockQuestions as unknown as Json,
    responses: [] as unknown as Json,
    totalPoints,
    currentIndex: 0,
    status: 'in_progress',
  });

  return { mockId };
}
```

**Step 2: Add the missing import at the top of MockExamService.ts**

Ensure `ExamQuestion` is imported. Check line 16 — if `ExamQuestion` is not already imported from `@/types/exam`, add it:

```typescript
import type {
  BatchSubmitResult,
  ExamQuestion,
  MockExam,
  MockExamQuestion,
  MockExamResponse,
} from '@/types/exam';
```

**Step 3: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 4: Commit**

```bash
git add src/lib/services/MockExamService.ts
git commit -m "feat(exam): add createRandomMix to MockExamService"
```

---

### Task 4: Add Server Actions

**Files:**

- Modify: `src/app/actions/mock-exams.ts` (add 3 new actions)

**Step 1: Add `getExamPapersForCourse` action**

Add at the end of `src/app/actions/mock-exams.ts`:

```typescript
export async function getExamPapersForCourse(
  courseCode: string,
): Promise<{ success: true; papers: ExamPaper[] } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };

    const { getExamPaperRepository } = await import('@/lib/repositories/ExamPaperRepository');
    const papers = await getExamPaperRepository().findAllByCourse(courseCode.trim());

    return { success: true, papers };
  } catch (error) {
    console.error('Fetch papers for course error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch papers',
    };
  }
}
```

Note: This action calls the repository directly because it's a simple read — but per the server-actions rule, we should go through a service. However, `MockExamService` is the closest service and it doesn't own "list papers". For simplicity, use `ExamPaperService`:

Actually, check `src/lib/services/ExamPaperService.ts` — it likely has a `getPapers` method. If so, call that instead. If not, calling the repository directly here is acceptable as a pragmatic exception for a read-only query. Use the approach that matches the existing codebase pattern.

**Step 2: Add `createRealExamMock` action**

```typescript
export async function createRealExamMock(
  paperId: string,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!paperId.trim()) return { success: false, error: 'Paper ID is required' };
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    const { mockId } = await service.createFromPaper(user.id, paperId.trim(), mode);

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Real exam mock creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create mock exam',
    };
  }
}
```

**Step 3: Add `createRandomMixMock` action**

```typescript
export async function createRandomMixMock(
  courseCode: string,
  numQuestions: number,
  mode: 'practice' | 'exam',
): Promise<{ success: true; mockId: string } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!courseCode.trim()) return { success: false, error: 'Course code is required' };
    if (![5, 10, 15, 20].includes(numQuestions)) {
      return { success: false, error: 'Number of questions must be 5, 10, 15, or 20' };
    }
    if (!['practice', 'exam'].includes(mode)) return { success: false, error: 'Invalid mode' };

    const service = getMockExamService();
    const { mockId } = await service.createRandomMix(
      user.id,
      courseCode.trim(),
      numQuestions,
      mode,
    );

    revalidatePath('/exam');
    return { success: true, mockId };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { success: false, error: error.message };
    }
    console.error('Random mix mock creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create random mix exam',
    };
  }
}
```

**Step 4: Add the `ExamPaper` import**

At the top of `mock-exams.ts`, add `ExamPaper` to the exam type imports:

```typescript
import type { BatchSubmitResult, ExamPaper, MockExam, MockExamResponse } from '@/types/exam';
```

**Step 5: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 6: Commit**

```bash
git add src/app/actions/mock-exams.ts
git commit -m "feat(exam): add server actions for real exam and random mix mock"
```

---

### Task 5: Add i18n translation keys

**Files:**

- Modify: `src/i18n/translations.ts` (add new keys to both zh and en `exam` sections)

**Step 1: Add Chinese translations**

In the `zh` → `exam` section (around line 294-321), add before the closing `}`:

```typescript
// Source selection
selectSource: '选择出题方式',
realExam: '真题练习',
realExamDesc: '使用上传的历年真题进行练习',
randomMix: '随机组卷',
randomMixDesc: '从多套真题中随机抽取题目',
aiMock: 'AI 模拟',
aiMockDesc: '输入知识点，AI 自动生成练习题',
selectPaper: '选择试卷',
numQuestions: '题目数量',
topic: '知识点',
difficulty: '难度',
noPapersAvailable: '该课程暂无真题，请先在知识库上传考试文档',
```

**Step 2: Add English translations**

In the `en` → `exam` section (around line 797-823), add before the closing `}`:

```typescript
// Source selection
selectSource: 'Question Source',
realExam: 'Real Exam',
realExamDesc: 'Practice with uploaded past exam papers',
randomMix: 'Random Mix',
randomMixDesc: 'Randomly select questions from multiple papers',
aiMock: 'AI Mock',
aiMockDesc: 'Enter a topic and let AI generate practice questions',
selectPaper: 'Select Paper',
numQuestions: 'Number of Questions',
topic: 'Topic / Knowledge Point',
difficulty: 'Difficulty',
noPapersAvailable: 'No papers available for this course. Upload exam documents in Knowledge Base first.',
```

**Step 3: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: no errors (both language objects must have the same shape)

**Step 4: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat(ui): add i18n keys for exam source selection"
```

---

### Task 6: Redesign ExamEntryClient with source selector

**Files:**

- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx` (full redesign)

**Step 1: Rewrite ExamEntryClient**

Replace the entire `ExamEntryClient.tsx` with the new version. Key changes:

1. Add `source` state: `'real' | 'random' | 'ai'`
2. Add 3 source cards (reuse `ModeCard` pattern)
3. Conditional options per source:
   - `real` → paper picker (`Select` populated by `getExamPapersForCourse`)
   - `random` → question count picker (`Select` with 5/10/15/20)
   - `ai` → topic input + count + difficulty + type selectors
4. Keep existing mode selector (Practice / Exam)
5. Start button calls different action per source

The component should:

- Fetch papers when course changes (via `useEffect` + `getExamPapersForCourse`)
- Disable "Real Exam" and "Random Mix" if no papers exist for the course
- Show helpful hint when no papers available

Imports needed:

```typescript
import { IconFileText, IconLoader2, IconShuffle, IconSparkles } from '@tabler/icons-react';
import { useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  createRandomMixMock,
  createRealExamMock,
  generateMockFromTopic,
  getExamPapersForCourse,
} from '@/app/actions/mock-exams';
```

State additions:

```typescript
const [source, setSource] = useState<'real' | 'random' | 'ai'>('real');
const [papers, setPapers] = useState<ExamPaper[]>([]);
const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
const [numQuestions, setNumQuestions] = useState<string | null>('10');
const [topic, setTopic] = useState('');
const [difficulty, setDifficulty] = useState<string | null>('mixed');
const [questionTypes, setQuestionTypes] = useState<string[]>([]);
const [loadingPapers, setLoadingPapers] = useState(false);
```

Paper fetch effect:

```typescript
useEffect(() => {
  if (!selectedCourse) {
    setPapers([]);
    return;
  }
  setLoadingPapers(true);
  getExamPapersForCourse(selectedCourse).then((result) => {
    if (result.success) setPapers(result.papers);
    else setPapers([]);
    setLoadingPapers(false);
  });
}, [selectedCourse]);
```

`handleStart` branching:

```typescript
const handleStart = () => {
  if (!selectedCourse) return;
  setError(null);

  startTransition(async () => {
    let result;
    if (source === 'real') {
      if (!selectedPaper) return;
      result = await createRealExamMock(selectedPaper, selectedMode);
    } else if (source === 'random') {
      result = await createRandomMixMock(selectedCourse, Number(numQuestions), selectedMode);
    } else {
      if (!topic.trim()) return;
      result = await generateMockFromTopic(
        topic.trim(),
        Number(numQuestions),
        difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
        questionTypes,
      );
    }
    if (result.success) {
      router.push(`/exam/mock/${result.mockId}`);
    } else {
      setError(result.error);
    }
  });
};
```

Source cards section (between course selector and mode selector):

```tsx
{
  /* Source selector */
}
<div>
  <Text size="sm" fw={500} mb="xs">
    {t.exam.selectSource}
  </Text>
  <Group grow gap="md">
    <SourceCard
      active={source === 'real'}
      title={t.exam.realExam}
      description={t.exam.realExamDesc}
      icon={<IconFileText size={20} />}
      disabled={papers.length === 0 && !loadingPapers}
      onClick={() => setSource('real')}
    />
    <SourceCard
      active={source === 'random'}
      title={t.exam.randomMix}
      description={t.exam.randomMixDesc}
      icon={<IconShuffle size={20} />}
      disabled={papers.length === 0 && !loadingPapers}
      onClick={() => setSource('random')}
    />
    <SourceCard
      active={source === 'ai'}
      title={t.exam.aiMock}
      description={t.exam.aiMockDesc}
      icon={<IconSparkles size={20} />}
      disabled={false}
      onClick={() => setSource('ai')}
    />
  </Group>
  {selectedCourse && papers.length === 0 && !loadingPapers && (
    <Text size="xs" c="orange" mt="xs">
      {t.exam.noPapersAvailable}
    </Text>
  )}
</div>;
```

Source-specific options:

```tsx
{
  /* Source-specific options */
}
{
  source === 'real' && papers.length > 0 && (
    <Select
      label={t.exam.selectPaper}
      placeholder="Select an exam paper"
      data={papers.map((p) => ({
        value: p.id,
        label: `${p.title}${p.year ? ` (${p.year})` : ''}`,
      }))}
      value={selectedPaper}
      onChange={setSelectedPaper}
      size="md"
    />
  );
}

{
  source === 'random' && (
    <Select
      label={t.exam.numQuestions}
      data={['5', '10', '15', '20']}
      value={numQuestions}
      onChange={setNumQuestions}
      size="md"
    />
  );
}

{
  source === 'ai' && (
    <Stack gap="sm">
      <TextInput
        label={t.exam.topic}
        placeholder="e.g., Binary Trees, Linear Regression"
        value={topic}
        onChange={(e) => setTopic(e.currentTarget.value)}
        size="md"
      />
      <Group grow>
        <Select
          label={t.exam.numQuestions}
          data={['5', '10', '15', '20']}
          value={numQuestions}
          onChange={setNumQuestions}
          size="md"
        />
        <Select
          label={t.exam.difficulty}
          data={[
            { value: 'mixed', label: 'Mixed' },
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
          value={difficulty}
          onChange={setDifficulty}
          size="md"
        />
      </Group>
    </Stack>
  );
}
```

Disable logic for start button:

```tsx
disabled={
  !selectedCourse ||
  (source === 'real' && !selectedPaper) ||
  (source === 'ai' && !topic.trim())
}
```

Add `SourceCard` component (extend `ModeCard` pattern):

```tsx
function SourceCard({
  active,
  title,
  description,
  icon,
  disabled,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <UnstyledButton onClick={onClick} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <Card
        withBorder
        radius="md"
        p="md"
        style={{
          borderColor: active ? 'var(--mantine-color-violet-5)' : 'var(--mantine-color-gray-3)',
          backgroundColor: active ? 'var(--mantine-color-violet-0)' : undefined,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 150ms ease',
        }}
      >
        <Group gap="xs" mb={4}>
          {icon}
          <Text fw={600} size="sm">
            {title}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Card>
    </UnstyledButton>
  );
}
```

**Step 2: Verify build passes**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx
git commit -m "feat(ui): redesign exam entry with three question sources"
```

---

### Task 7: Lint, format, and build verification

**Step 1: Format all changed files**

Run: `npm run format`

**Step 2: Lint**

Run: `npm run lint`
Fix any issues.

**Step 3: Build**

Run: `npm run build`
Expected: build succeeds

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "style(exam): lint and format fixes"
```

---

### Task 8: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feature/mock-exam-sources
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(exam): support real exam, random mix, and AI mock sources" --body "$(cat <<'EOF'
## Summary
- Add three question sources to the mock exam entry page:
  - **Real Exam**: practice with original questions from an uploaded past paper
  - **Random Mix**: randomly select questions across multiple papers for a course
  - **AI Mock**: existing AI-generated questions from a topic (unchanged)
- New service methods: `createFromPaper()`, `createRandomMix()`
- New repository method: `findAllByCourse()`
- New server actions: `createRealExamMock()`, `createRandomMixMock()`, `getExamPapersForCourse()`
- Answer/review UI (`MockExamClient`) unchanged — all sources share the same experience

## Test plan
- [ ] Select a course with uploaded exam papers → "Real Exam" and "Random Mix" are enabled
- [ ] Select a course without papers → "Real Exam" and "Random Mix" are disabled with hint
- [ ] Real Exam: select paper → start → verify original questions appear in mock
- [ ] Random Mix: select 10 questions → start → verify questions from different papers
- [ ] AI Mock: enter topic → start → verify AI-generated questions (existing behavior)
- [ ] Practice mode works correctly for all three sources
- [ ] Exam mode works correctly for all three sources
- [ ] i18n: switch to Chinese → all new strings translated

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
