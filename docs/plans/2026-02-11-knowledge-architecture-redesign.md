# Knowledge-Driven Architecture Redesign

## Goal

Restructure the app so that a centralized Knowledge Base (admin-curated + user-uploaded content) powers all three features: Lecture Helper, Assignment Coach, and Mock Exam. Elevate Mock Exam to a first-class session-based feature alongside the other two.

## Architecture

```
Admin Panel (/admin/content)
  Upload PDFs → Parse → Review/Fix text → Tag with course + type → Publish
  Content types: lecture | exam | assignment

Knowledge Base (DB: documents table)
  Parsed content + embeddings, linked to courses by course_id
  doc_type distinguishes content purpose
  Both admin and users can upload (users add supplementary notes)

User-Facing Features (all auto-linked to course knowledge):
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ Lecture       │ │ Assignment   │ │ Mock Exam    │
  │ Helper       │ │ Coach        │ │              │
  │ Chat + RAG   │ │ Chat + RAG   │ │ Structured   │
  │              │ │              │ │ Q&A + Score  │
  └──────────────┘ └──────────────┘ └──────────────┘
  All three are session-based, appear in sidebar, auto-use course knowledge.
```

## Key Decisions

- **Knowledge Base is the engine, not a standalone page.** Users don't need to visit /knowledge to upload before they can use features. Content is auto-available by course.
- **Admin uploads are the primary content source.** Admins upload lecture slides, past exams, and assignment solutions. Users can supplement with their own notes.
- **Mock Exam is a peer feature.** Same session system as Lecture Helper / Assignment Coach. Shows in sidebar under its own module. Uses structured Q&A UI (not chat).
- **Course tagging is the link.** When admin uploads a PDF, they tag it with a course. When a user starts a session for that course, all tagged content is available to the AI.
- **All UI in English.** Chinese i18n deferred to later.

---

## Part 1: Database Changes

### Extend `documents` table

Add two columns:

```sql
ALTER TABLE documents ADD COLUMN doc_type text DEFAULT 'lecture'
  CHECK (doc_type IN ('lecture', 'exam', 'assignment'));
ALTER TABLE documents ADD COLUMN course_id text;
```

Existing documents get `doc_type = 'lecture'` (backwards compatible).

### Add `Mock Exam` to TutoringMode

```typescript
// src/types/index.ts
export type TutoringMode = 'Lecture Helper' | 'Assignment Coach' | 'Mock Exam';
```

### Link mock_exams to chat_sessions

Add `session_id` to `mock_exams` table so mock exam sessions appear in the sidebar:

```sql
ALTER TABLE mock_exams ADD COLUMN session_id text REFERENCES chat_sessions(id);
```

When creating a mock exam, also create a chat_session with `mode = 'Mock Exam'`.

---

## Part 2: Admin Content Management

### New page: `/admin/content`

Replaces the current `/admin/exam` page. Single admin panel for all content types.

**Layout:** `<Container size="md" py={48}>` (matches site-wide standard)

**Components:**

1. **Header**: "Content Management" title + [Upload] button
2. **Filters**: doc_type dropdown, course dropdown, status dropdown
3. **Content table**: list of documents with columns: title, course, type, status, chunk count, upload date
4. **Row actions**: click to review/edit, delete

**Upload modal** (extends existing `ExamPaperUploadModal`):

- PDF file input
- Course select (from COURSES constant)
- Doc type select: Lecture Slides | Past Exam | Assignment/Solution
- Visibility: Public | Private

**Review/Edit page** (`/admin/content/[id]`):

- Shows parsed text in editable textarea blocks (one per chunk)
- Admin can fix OCR errors, remove irrelevant content
- Save updates the embeddings
- Status toggle: Draft → Ready

### Keep `/admin/exam` as redirect to `/admin/content?type=exam`

---

## Part 3: Sidebar Changes

### CHAT_MODULES (3 entries now)

```typescript
const CHAT_MODULES = [
  {
    mode: 'Lecture Helper' as TutoringMode,
    label: 'Lectures',
    icon: Presentation,
    color: 'indigo',
  },
  {
    mode: 'Assignment Coach' as TutoringMode,
    label: 'Assignments',
    icon: Compass,
    color: 'violet',
  },
  { mode: 'Mock Exam' as TutoringMode, label: 'Mock Exams', icon: FileQuestion, color: 'purple' },
];
```

### JUMP_LINKS (only Knowledge Base remains)

```typescript
const JUMP_LINKS = [{ label: 'Knowledge Base', icon: GraduationCap, href: '/knowledge' }];
```

### Session routing

- Lecture Helper sessions → `/lecture/[id]` (existing)
- Assignment Coach sessions → `/assignment/[id]` (existing)
- Mock Exam sessions → `/exam/mock/[id]` (existing structured UI)

Add to MODES_METADATA:

```typescript
'Mock Exam': {
  id: 'exam/mock',
  label: 'Mock Exam',
  icon: FileQuestion,
  color: 'purple',
  desc: 'Practice with real past exams',
  intro: '**Mock Exam Mode Active**\n\nI generate exam variants from real past papers for your course. Let\'s practice!',
  hoverClass: 'hover:border-purple-300 hover:shadow-[0_8px_30px_rgba(147,51,234,0.15)]',
},
```

---

## Part 4: Study Page

3 equal cards, all use NewSessionModal flow:

| Card             | Label            | Subtitle                                               | CTA                |
| ---------------- | ---------------- | ------------------------------------------------------ | ------------------ |
| Lecture Helper   | Lecture Helper   | Upload slides and get key concepts explained           | Start Explaining → |
| Assignment Coach | Assignment Coach | Paste your problem and get step-by-step guidance       | Start Solving →    |
| Mock Exam        | Mock Exam        | Practice with AI-generated variants of real past exams | Start Practicing → |

All 3 cards → NewSessionModal (pick course) → create session → redirect.

For Mock Exam specifically: creating a session also triggers mock exam generation from the course's exam-type documents in the knowledge base.

---

## Part 5: Mock Exam Session Creation Flow

1. User clicks "Mock Exam" card → NewSessionModal opens
2. User picks course → clicks "Start Session"
3. Backend: `createChatSession(course, 'Mock Exam')` → gets session_id
4. Backend: finds exam-type documents for that course → `generateMockExam(paperId, sessionId)`
5. Frontend redirects to `/exam/mock/[session_id]`
6. Session appears in sidebar under "Mock Exams" module

If no exam papers exist for the course, show a friendly message: "No past exams available for this course yet."

---

## Part 6: Knowledge Page Changes

The `/knowledge` page shifts purpose:

- **For regular users**: browse available materials for their courses + upload own supplementary docs
- **For admins**: redirect to `/admin/content` for full management

User view shows:

- List of available docs for courses they've used (read-only)
- "My Uploads" section where they can add their own notes/docs
- Upload is personal (tagged with user_id), not visible to other users

---

## Implementation Order

1. **DB migrations**: Add `doc_type`, `course_id` to documents; add `session_id` to mock_exams
2. **Type changes**: Add 'Mock Exam' to TutoringMode, update all validators/schemas
3. **MODES_METADATA**: Add Mock Exam entry
4. **Sidebar**: Move Mock Exam from JUMP_LINKS to CHAT_MODULES
5. **Study Page**: Update Mock Exam card to use NewSessionModal flow (not router.push)
6. **NewSessionModal**: Add MODE_LABELS entry for Mock Exam
7. **Mock Exam session flow**: Create chat_session + generate mock exam on session start
8. **Admin content page**: New `/admin/content` with upload, list, review/edit
9. **Knowledge page**: Restructure for user-facing browse + personal uploads
