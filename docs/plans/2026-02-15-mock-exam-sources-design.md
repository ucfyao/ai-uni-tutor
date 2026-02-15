# Mock Exam: Multiple Question Sources

## Overview

Expand the mock exam entry flow to support three question sources:

1. **Real Exam** - Practice with original questions from an uploaded past paper
2. **Random Mix** - Randomly select questions across multiple uploaded papers for a course
3. **AI Mock** - AI generates questions from a user-provided knowledge point (existing `generateFromTopic`)

The answer/review experience remains identical regardless of source. Existing `MockExamClient` is reused as-is.

## Exam Entry Page (UI)

### Current

```
Course selector → Mode (Practice/Exam) → Start
```

### New

```
Course selector
  ↓
Source selector (3 cards):
  ├── Real Exam    → Paper picker dropdown (which paper?)
  ├── Random Mix   → Number of questions slider/select
  └── AI Mock      → Topic input + question count + difficulty + question types
  ↓
Mode (Practice / Exam)
  ↓
Start
```

### Source-specific options

| Source     | Extra inputs                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Real Exam  | `Select<ExamPaper>` — which paper to use                                                                         |
| Random Mix | `Select<number>` — how many questions (5/10/15/20)                                                               |
| AI Mock    | `TextInput` topic, `Select` count, `Select` difficulty, `MultiSelect` types (existing UI from generateFromTopic) |

### Conditional rendering

- Source selector appears after course is selected
- Source-specific options appear after source is selected
- Paper picker (Real Exam) is populated by fetching papers for the selected course
- If no papers exist for the course, Real Exam and Random Mix are disabled with a hint

## Backend

### New: `MockExamService.createFromPaper()`

```typescript
async createFromPaper(
  userId: string,
  paperId: string,
  mode: ExamMode,
): Promise<{ mockId: string }>
```

Flow:

1. Fetch all questions from `exam_questions` for the given `paperId`
2. Map to `MockExamQuestion[]` (set `sourceQuestionId` to original question ID)
3. Create `mock_exams` record with original questions, no AI calls
4. Return `mockId`

### New: `MockExamService.createRandomMix()`

```typescript
async createRandomMix(
  userId: string,
  courseCode: string,
  numQuestions: number,
  mode: ExamMode,
): Promise<{ mockId: string }>
```

Flow:

1. `ExamPaperRepository.findAllByCourse(courseCode)` — get all paper IDs for course
2. For each paper, fetch questions → flatten into one array
3. Shuffle and pick `numQuestions` items
4. Create a virtual `exam_paper` record (title: "Random Mix — {course}", visibility: private) for FK constraint
5. Create `mock_exams` record with selected questions
6. Return `mockId`

### Existing: `MockExamService.generateFromTopic()` — No changes

Current `generateFromTopic()` is used as-is for "AI Mock" source.

### New: `ExamPaperRepository.findAllByCourse()`

```typescript
async findAllByCourse(courseCode: string): Promise<ExamPaper[]>
```

Returns all papers matching the course code (case-insensitive). Used by:

- Random Mix: to gather questions across papers
- Real Exam UI: to populate the paper picker dropdown

### New Server Actions

```typescript
// Direction 1a: Real exam paper
createRealExamMock(paperId: string, mode: ExamMode)
  → auth + quota → MockExamService.createFromPaper()

// Direction 1b: Random mix
createRandomMixMock(courseCode: string, numQuestions: number, mode: ExamMode)
  → auth + quota → MockExamService.createRandomMix()

// Fetch papers for course (for UI paper picker)
getExamPapersForCourse(courseCode: string)
  → auth → ExamPaperRepository.findAllByCourse()
```

Existing `generateMockFromTopic()` action handles the AI Mock source.

## Data Flow

```
Real Exam:
  User → select course → select "Real Exam" → pick paper → select mode → Start
  → createRealExamMock(paperId, mode)
  → MockExamService.createFromPaper()
  → ExamPaperRepo.findQuestionsByPaperId()
  → MockExamRepo.create() (with original questions)
  → redirect /exam/mock/[id]

Random Mix:
  User → select course → select "Random Mix" → pick count → select mode → Start
  → createRandomMixMock(courseCode, numQuestions, mode)
  → MockExamService.createRandomMix()
  → ExamPaperRepo.findAllByCourse() → flatten questions → shuffle → pick N
  → MockExamRepo.create() (with selected questions)
  → redirect /exam/mock/[id]

AI Mock:
  User → select course → select "AI Mock" → enter topic + options → select mode → Start
  → generateMockFromTopic(topic, numQuestions, difficulty, types)
  → MockExamService.generateFromTopic()  (existing, unchanged)
  → redirect /exam/mock/[id]
```

## What Does NOT Change

- `MockExamClient.tsx` — answer/review UI is source-agnostic
- `judgeAnswer()`, `submitAnswer()`, `batchSubmitAnswers()` — grading logic unchanged
- Database schema — no new tables or migrations needed
- `QuestionCard.tsx`, `FeedbackCard.tsx` — rendering components unchanged

## Files to Modify

| File                                           | Change                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/lib/services/MockExamService.ts`          | Add `createFromPaper()`, `createRandomMix()`                                    |
| `src/lib/repositories/ExamPaperRepository.ts`  | Add `findAllByCourse()`                                                         |
| `src/app/actions/mock-exams.ts`                | Add `createRealExamMock()`, `createRandomMixMock()`, `getExamPapersForCourse()` |
| `src/app/(protected)/exam/ExamEntryClient.tsx` | Redesign with source selector + conditional options                             |
| `src/i18n/en.ts` + `src/i18n/zh.ts`            | Add translation keys for new UI strings                                         |

## Mock Exam Title Convention

| Source     | Title Format                                   |
| ---------- | ---------------------------------------------- |
| Real Exam  | `"{Paper Title}"` (e.g. "2024 Final Exam")     |
| Random Mix | `"Random Mix — {Course Code} ({N} questions)"` |
| AI Mock    | `"{Topic} - Practice Exam"` (existing)         |
