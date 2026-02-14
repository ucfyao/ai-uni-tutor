# Exam Pages Visual Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align all exam pages with the Knowledge page's Notion-style design language (headers, cards, shadows, background glow, animations).

**Architecture:** Pure visual refactor — no logic, data flow, or functional changes. Each page gets the same treatment: background glow in the server component wrapper, then header/card/animation adjustments in the client component.

**Tech Stack:** Mantine v8 components (`Card`, `Title`, `Text`, `Box`, `Container`), Tailwind CSS v4 animation classes (`animate-fade-in-up`, `animate-delay-*`), existing globals.css keyframes.

---

## Reference: Design Tokens

These tokens are used repeatedly. Copy them exactly.

```tsx
// Header
<Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
<Text c="dimmed" size="md" fw={400} mt={2}>

// Card wrapper
<Card withBorder radius="lg" p={0} style={{
  borderColor: 'var(--mantine-color-gray-2)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
}}>

// Background glow (in server page.tsx)
<Box style={{
  position: 'absolute', top: -40, left: '50%',
  transform: 'translateX(-50%)', width: '120%', height: 200,
  background: 'radial-gradient(ellipse at center, var(--mantine-color-indigo-0) 0%, transparent 70%)',
  pointerEvents: 'none', zIndex: 0, opacity: 0.7,
}} />

// Empty state
<Card radius="lg" p="xl" withBorder style={{
  borderColor: 'var(--mantine-color-gray-2)',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
}}>
  <Stack align="center" gap="md" py="lg">
    <Box style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'var(--mantine-color-violet-0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <IconFileText size={32} color="var(--mantine-color-violet-4)" />
    </Box>
    <Box ta="center">
      <Text fw={500} size="md">Title</Text>
      <Text size="sm" c="dimmed" mt={4}>Subtitle</Text>
    </Box>
  </Stack>
</Card>
```

---

### Task 1: Exam Entry — Server Page Background Glow

**Files:**

- Modify: `src/app/(protected)/exam/page.tsx`

**Step 1: Add background glow and wrapper**

Replace the entire file with:

```tsx
import { Box, Container } from '@mantine/core';
import { getExamPaperList } from '@/app/actions/exam-papers';
import { getMockExamList } from '@/app/actions/mock-exams';
import { ExamEntryClient } from './ExamEntryClient';

export default async function ExamPage() {
  const [papers, mockExams] = await Promise.all([getExamPaperList(), getMockExamList()]);

  return (
    <Container size="xl" py={48} style={{ position: 'relative' }}>
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
        <ExamEntryClient papers={papers} recentMocks={mockExams.slice(0, 5)} />
      </Box>
    </Container>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/page.tsx
git commit -m "style(ui): add background glow to exam entry page"
```

---

### Task 2: Exam Entry — Header & Animation

**Files:**

- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Remove Container wrapper (moved to page.tsx)**

The `ExamEntryClient` currently wraps itself in `<Container size="xl" py={48}>`. Since we moved the Container to `page.tsx`, remove it from the client component. The outermost element should now be `<Stack gap="lg">` (change from `gap="xl"` to `gap="lg"` to match Knowledge page).

**Step 2: Fix header to match Knowledge pattern**

Replace the header section (lines 133-163):

```tsx
{
  /* Header */
}
<Group justify="space-between" align="flex-start" className="animate-fade-in-up">
  <Box>
    <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
      Exam Practice
    </Title>
    <Text c="dimmed" size="md" fw={400} mt={2}>
      Generate mock exams from real past papers
    </Text>
  </Box>
  <Group>
    <Button
      leftSection={<IconBolt size={16} />}
      variant="gradient"
      gradient={{ from: 'teal', to: 'cyan' }}
      onClick={() => setQuickGenOpen(true)}
      radius="md"
    >
      Quick Generate
    </Button>
    <Button
      leftSection={<IconPlus size={16} />}
      variant="gradient"
      gradient={{ from: 'indigo', to: 'violet' }}
      onClick={() => setUploadOpen(true)}
      radius="md"
    >
      Upload Exam Paper
    </Button>
    <Button variant="subtle" onClick={() => router.push('/exam/history')} radius="md">
      View History
    </Button>
  </Group>
</Group>;
```

**Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx
git commit -m "style(ui): align exam entry header with Knowledge design language"
```

---

### Task 3: Exam Entry — Paper Bank Card Wrapping & Empty State

**Files:**

- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Wrap Paper Bank section title and two-column layout**

Replace the Paper Bank `<div>` block (lines 166-352). The section title gets animation delay, the empty state gets Knowledge-style icon circle, and the two-column layout gets a Card wrapper:

For the section title:

```tsx
<Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
  <Title order={4} mb="md">
    Paper Bank
  </Title>
```

For the empty state (replace lines 171-193):

```tsx
{papers.length === 0 ? (
  <Card
    radius="lg"
    p="xl"
    withBorder
    style={{
      borderColor: 'var(--mantine-color-gray-2)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    }}
  >
    <Stack align="center" gap="md" py="lg">
      <Box
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--mantine-color-violet-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconFileText size={32} color="var(--mantine-color-violet-4)" />
      </Box>
      <Box ta="center">
        <Text fw={500} size="md">
          No exam papers yet
        </Text>
        <Text size="sm" c="dimmed" mt={4}>
          Upload a paper or generate from a topic to get started.
        </Text>
      </Box>
      <Group justify="center" mt="xs">
        <Button
          leftSection={<IconBolt size={16} />}
          variant="gradient"
          gradient={{ from: 'teal', to: 'cyan' }}
          onClick={() => setQuickGenOpen(true)}
          radius="md"
        >
          Generate from Topic
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="light"
          onClick={() => setUploadOpen(true)}
          radius="md"
        >
          Upload Paper
        </Button>
      </Group>
    </Stack>
  </Card>
) : (
```

For the two-column layout, wrap it in a Card (replace the `<Group align="flex-start" ...>` with):

```tsx
  <Card
    withBorder
    radius="lg"
    p={0}
    style={{
      borderColor: 'var(--mantine-color-gray-2)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      overflow: 'hidden',
    }}
  >
    <Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 400 }}>
      {/* ... existing left sidebar and right panel ... */}
    </Group>
  </Card>
)}
</Box>
```

Close the `<Box>` wrapper for animation.

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx
git commit -m "style(ui): wrap exam paper bank in card, update empty state"
```

---

### Task 4: Exam Entry — Recent Mocks Section & Final Animations

**Files:**

- Modify: `src/app/(protected)/exam/ExamEntryClient.tsx`

**Step 1: Add animation and card shadow to Recent Mock Exams section**

Wrap the Recent Mocks section (lines 355-408) with animation class, and add shadow/border to each card:

```tsx
{
  recentMocks.length > 0 && (
    <Box className="animate-fade-in-up animate-delay-200" style={{ opacity: 0 }}>
      <Group justify="space-between" mb="md">
        <Title order={4}>Recent Mock Exams</Title>
        <Button variant="subtle" size="xs" onClick={() => router.push('/exam/history')} radius="md">
          View All
        </Button>
      </Group>
      <ScrollArea>
        <Group gap="md" wrap="nowrap">
          {recentMocks.map((mock) => (
            <Card
              key={mock.id}
              withBorder
              radius="lg"
              p="md"
              miw={250}
              style={{
                cursor: 'pointer',
                borderColor: 'var(--mantine-color-gray-2)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
              onClick={() => router.push(`/exam/mock/${mock.id}`)}
            >
              {/* ... existing card content unchanged ... */}
            </Card>
          ))}
        </Group>
      </ScrollArea>
    </Box>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/ExamEntryClient.tsx
git commit -m "style(ui): add animations and card shadow to recent mocks section"
```

---

### Task 5: MockExam — Server Page Background Glow

**Files:**

- Modify: `src/app/(protected)/exam/mock/[id]/page.tsx`

**Step 1: Add background glow and wrapper**

Replace the entire file with:

```tsx
import { notFound } from 'next/navigation';
import { Box, Container } from '@mantine/core';
import { getMockExamDetail } from '@/app/actions/mock-exams';
import { MockExamClient } from './MockExamClient';

export default async function MockExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mock = await getMockExamDetail(id);

  if (!mock) notFound();

  return (
    <Container size="xl" py={48} style={{ position: 'relative' }}>
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
        <MockExamClient initialMock={mock} />
      </Box>
    </Container>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/page.tsx
git commit -m "style(ui): add background glow to mock exam page"
```

---

### Task 6: MockExam — Header & Container Cleanup

**Files:**

- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Remove Container wrapper (moved to page.tsx)**

Replace `<Container size="xl" py={32}>` with just `<Stack gap="md">` (remove the Container entirely since it's now in page.tsx).

Also remove the closing `</Container>` at the end.

**Step 2: Redesign the header**

Replace the header section (lines 259-310) with:

```tsx
{
  /* Header */
}
<Group justify="space-between" align="flex-start" className="animate-fade-in-up">
  <Box>
    <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
      {mock.title}
    </Title>
    <Text c="dimmed" size="md" fw={400} mt={2}>
      {isCompleted
        ? `Completed · ${totalQuestions} questions`
        : `${mode === 'practice' ? 'Practice' : 'Exam'} Mode · ${totalQuestions} questions`}
    </Text>
  </Box>

  {!isCompleted && (
    <Group gap="md">
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
      <Group gap="xs">
        <Switch
          label="Timer"
          size="sm"
          checked={timerEnabled}
          onChange={(e) => setTimerEnabled(e.currentTarget.checked)}
          disabled={hasSubmitted}
        />
        {timerEnabled && (
          <Text size="sm" fw={700} ff="monospace" c={timeRemaining < 300 ? 'red' : undefined}>
            {formatTime(timeRemaining)}
          </Text>
        )}
      </Group>
    </Group>
  )}

  {isCompleted && mock.score !== null && (
    <Group gap="xs">
      <IconTrophy size={18} color="gold" />
      <Text fw={700}>
        {mock.score}/{mock.totalPoints}
      </Text>
    </Group>
  )}
</Group>;
```

**Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/MockExamClient.tsx
git commit -m "style(ui): align mock exam header with Knowledge design language"
```

---

### Task 7: MockExam — Card Wrapping & Animations

**Files:**

- Modify: `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx`

**Step 1: Add animation to progress bar**

Wrap the progress bar in an animated box:

```tsx
<Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
  <Progress value={progressValue} size="sm" color="indigo" />
</Box>
```

**Step 2: Wrap two-column layout in Card**

Replace the `<Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 500 }}>` with:

```tsx
<Card
  withBorder
  radius="lg"
  p={0}
  className="animate-fade-in-up animate-delay-200"
  style={{
    borderColor: 'var(--mantine-color-gray-2)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    opacity: 0,
  }}
>
  <Group align="flex-start" gap={0} wrap="nowrap" style={{ minHeight: 500 }}>
    {/* ... existing sidebar and right panel unchanged ... */}
  </Group>
</Card>
```

**Step 3: Add shadow to completion score card**

Update the score card (lines 387-405) — add shadow:

```tsx
<Card
  withBorder
  radius="lg"
  p="xl"
  ta="center"
  style={{
    borderColor: 'var(--mantine-color-gray-2)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  }}
>
```

**Step 4: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/\(protected\)/exam/mock/\[id\]/MockExamClient.tsx
git commit -m "style(ui): wrap mock exam layout in card, add animations"
```

---

### Task 8: History Page — Full Redesign

**Files:**

- Modify: `src/app/(protected)/exam/history/page.tsx`

**Step 1: Rewrite the entire page**

Replace file contents with:

```tsx
import { IconClock, IconFileText, IconTrophy } from '@tabler/icons-react';
import Link from 'next/link';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { getMockExamList } from '@/app/actions/mock-exams';

export default async function ExamHistoryPage() {
  const mocks = await getMockExamList();

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
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="flex-start" className="animate-fade-in-up">
            <Box>
              <Title order={2} fw={700} style={{ letterSpacing: '-0.02em' }}>
                Mock Exam History
              </Title>
              <Text c="dimmed" size="md" fw={400} mt={2}>
                Review your past exam attempts
              </Text>
            </Box>
            <Button component={Link} href="/exam" variant="subtle" radius="md">
              Back to Exam Practice
            </Button>
          </Group>

          {/* Content */}
          <Box className="animate-fade-in-up animate-delay-100" style={{ opacity: 0 }}>
            {mocks.length === 0 ? (
              <Card
                radius="lg"
                p="xl"
                withBorder
                style={{
                  borderColor: 'var(--mantine-color-gray-2)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <Stack align="center" gap="md" py="lg">
                  <Box
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'var(--mantine-color-violet-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconFileText size={32} color="var(--mantine-color-violet-4)" />
                  </Box>
                  <Box ta="center">
                    <Text fw={500} size="md">
                      No mock exams yet
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      Generate one from the exam practice page to get started.
                    </Text>
                  </Box>
                  <Button
                    component={Link}
                    href="/exam"
                    variant="light"
                    color="indigo"
                    size="sm"
                    radius="md"
                  >
                    Go to Exam Practice
                  </Button>
                </Stack>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                {mocks.map((mock) => (
                  <Anchor
                    key={mock.id}
                    href={`/exam/mock/${mock.id}`}
                    underline="never"
                    c="inherit"
                  >
                    <Card
                      withBorder
                      radius="lg"
                      p="lg"
                      style={{
                        borderColor: 'var(--mantine-color-gray-2)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      }}
                    >
                      <Text fw={600} lineClamp={1}>
                        {mock.title}
                      </Text>

                      <Group gap="xs" mt="sm">
                        {mock.status === 'completed' ? (
                          <>
                            <IconTrophy size={16} color="gold" />
                            <Text fw={600}>
                              {mock.score}/{mock.totalPoints}
                            </Text>
                            <Badge color="green" size="xs">
                              Completed
                            </Badge>
                          </>
                        ) : (
                          <>
                            <IconClock size={16} style={{ opacity: 0.5 }} />
                            <Text size="sm" c="dimmed">
                              {mock.currentIndex}/{mock.questions.length} answered
                            </Text>
                            <Badge color="yellow" size="xs">
                              In Progress
                            </Badge>
                          </>
                        )}
                      </Group>

                      {mock.status === 'completed' && (
                        <Progress
                          value={(mock.score! / mock.totalPoints) * 100}
                          mt="sm"
                          size="sm"
                          color={mock.score! / mock.totalPoints >= 0.6 ? 'green' : 'red'}
                        />
                      )}

                      <Text size="xs" c="dimmed" mt="sm">
                        {new Date(mock.createdAt).toLocaleDateString()}
                      </Text>
                    </Card>
                  </Anchor>
                ))}
              </SimpleGrid>
            )}
          </Box>
        </Stack>
      </Box>
    </Container>
  );
}
```

**Step 2: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(protected\)/exam/history/page.tsx
git commit -m "style(ui): align exam history page with Knowledge design language"
```

---

### Task 9: Shared Components — QuestionCard & FeedbackCard

**Files:**

- Modify: `src/components/exam/QuestionCard.tsx`
- Modify: `src/components/exam/FeedbackCard.tsx`

**Step 1: Update QuestionCard**

In `QuestionCard.tsx`, change the Card component (line 27) from:

```tsx
<Card withBorder radius="lg" p="lg">
```

to:

```tsx
<Card
  withBorder
  radius="lg"
  p="lg"
  style={{
    borderColor: 'var(--mantine-color-gray-2)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  }}
>
```

**Step 2: Update FeedbackCard**

In `FeedbackCard.tsx`, add shadow to the Card (line 24). Change from:

```tsx
<Card
  withBorder
  radius="lg"
  p="lg"
  bg={feedback.isCorrect ? 'green.0' : 'red.0'}
  style={{
    borderColor: feedback.isCorrect
      ? 'var(--mantine-color-green-3)'
      : 'var(--mantine-color-red-3)',
  }}
>
```

to:

```tsx
<Card
  withBorder
  radius="lg"
  p="lg"
  bg={feedback.isCorrect ? 'green.0' : 'red.0'}
  style={{
    borderColor: feedback.isCorrect
      ? 'var(--mantine-color-green-3)'
      : 'var(--mantine-color-red-3)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  }}
>
```

**Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/exam/QuestionCard.tsx src/components/exam/FeedbackCard.tsx
git commit -m "style(ui): add unified shadow to QuestionCard and FeedbackCard"
```

---

### Task 10: Final Verification

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All tests pass (no logic changes, so no test regressions)

**Step 5: Visual check (manual)**

Open in browser and verify:

- `/exam` — background glow, header style, paper bank in card, empty state icon circle, recent mocks with shadow
- `/exam/mock/[id]` — background glow, header with title, two-column in card, animations
- `/exam/history` — background glow, header + subtitle, empty state, card shadows
- All pages have fade-in animations on load
