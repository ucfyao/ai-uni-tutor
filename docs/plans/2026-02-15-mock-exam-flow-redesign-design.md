# Mock Exam Flow Redesign

**Date**: 2026-02-15

## Problem

Current mock exam flow is confusing. Users don't know what they're doing — Paper Bank, upload, Quick Generate, mode switching mid-exam. Too many choices, unclear path.

## Core Value

We have real past exam papers (uploaded via Knowledge as `doc_type: 'exam'`). AI generates similar questions from these. Users get mock exams that feel like the real thing.

## New Flow

```
/exam → select course → select mode → start → /exam/mock/[id]
```

That's it.

## Entry Page (`/exam`)

Single-purpose page with three inputs:

1. **Course selector** — dropdown showing courses that have exam papers in Knowledge. Display badge: "X past papers". Grouped by university.
2. **Mode selector** — two cards side by side:
   - **Practice**: answer one question, get immediate feedback, then next. For learning.
   - **Exam**: answer all questions, submit at end, get final score. Simulates real exam.
3. **Start button**

No recent exams list (sidebar already has this). No upload (Knowledge handles it). No Paper Bank. No Quick Generate. No difficulty/question count config — system decides from the real papers.

## Mock Exam Page (`/exam/mock/[id]`)

- Mode is locked at creation time, stored in the mock exam record
- No mode switcher inside the exam
- Practice mode page: shows question → user answers → immediate feedback → next button
- Exam mode page: shows question → user answers → nav to any question → submit all at end → results
- Timer remains optional (toggle in header)

## What Gets Removed

- `ExamPaperUploadModal` — upload unified to Knowledge
- Paper Bank two-column layout — no more browsing papers
- Quick Generate modal — no more topic-based generation
- Mode switcher (SegmentedControl) inside MockExamClient
- Recent mock exams carousel on entry page (sidebar covers this)
- `/exam/history` page — sidebar lists past exams, clicking one opens it

## Backend Changes

- `generateMockExam(paperId)` → `generateMockExam(courseCode, mode)` — system finds exam papers in Knowledge by course, generates questions
- Store `mode` in mock exam record at creation time (currently determined client-side)
- Remove `generateMockFromTopic` action (or keep internal, not exposed in UI)
- Remove `getExamPaperList`, `getExamPaperDetail` from exam entry (no longer needed for UI)
- Query Knowledge documents with `doc_type: 'exam'` and matching course metadata

## Data Flow

```
User selects course + mode
  → Server Action: generateMockExam(courseCode, mode)
    → Find Knowledge docs where doc_type='exam' AND course=courseCode
    → Extract questions from those documents
    → AI generates similar questions
    → Create MockExam record with mode stored
    → Return mockId
  → Redirect to /exam/mock/{mockId}
```

## Files Affected

### Remove

- `src/app/(protected)/exam/ExamPaperUploadModal.tsx`
- `src/app/(protected)/exam/history/page.tsx`

### Major Rewrite

- `src/app/(protected)/exam/ExamEntryClient.tsx` — replace Paper Bank with course + mode selector
- `src/app/(protected)/exam/mock/[id]/MockExamClient.tsx` — remove mode switcher, lock mode from record

### Modify

- `src/app/actions/mock-exams.ts` — new `generateMockExam(courseCode, mode)` signature
- `src/app/(protected)/exam/page.tsx` — pass course list instead of papers
- `src/types/exam.ts` — add `mode` to MockExam type if not present

### Possibly Remove

- `src/app/actions/exam-papers.ts` — may no longer be needed for UI (keep for admin)
