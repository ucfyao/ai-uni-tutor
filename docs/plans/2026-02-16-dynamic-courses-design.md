# Dynamic Universities & Courses

## Problem

Universities and courses are hardcoded in `src/constants/index.ts` — 4 universities, 2 courses (both UNSW). New users can only select these 2 courses. No admin UI to add courses. This limits the product to a single university's ML courses.

## Decision

**Approach A: New DB tables + full Repository/Service/Action layer** — follows existing architecture exactly.

- Admin-only management (no user self-service)
- Full admin UI with CRUD pages
- Full DB normalization + data migration
- Simple 1:many relationship (course → university)
- Keep localStorage for user's last-selected preference

## Database Schema

### New Tables

```sql
CREATE TABLE universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_courses_uni_code ON courses (university_id, lower(code));
```

### RLS Policies

- `SELECT` open to all authenticated users
- `INSERT/UPDATE/DELETE` restricted to admin role

### Schema Changes to Existing Tables

- `chat_sessions`: add `course_id uuid REFERENCES courses(id) ON DELETE SET NULL`
- `documents`: change `course_id` from text to `uuid REFERENCES courses(id) ON DELETE SET NULL`

### Migration

1. Create `universities` and `courses` tables
2. Seed existing 4 universities + 2 courses with deterministic UUIDs
3. Add `course_id` FK columns to `chat_sessions` and `documents`
4. Backfill `course_id` based on embedded JSON `course.code` matching seeded data
5. Drop `chat_sessions.course` JSON column

## Data Layer

### Repositories

**`UniversityRepository`** (`src/lib/repositories/UniversityRepository.ts`)
- `findAll()`, `findById(id)`, `create(dto)`, `update(id, dto)`, `delete(id)`
- Singleton pattern, entity mapping (snake_case → camelCase), DatabaseError wrapping

**`CourseRepository`** (`src/lib/repositories/CourseRepository.ts`)
- `findAll()`, `findByUniversityId(universityId)`, `findById(id)`, `create(dto)`, `update(id, dto)`, `delete(id)`
- Same patterns as UniversityRepository

### Service

**`CourseService`** (`src/lib/services/CourseService.ts`)
- Single service managing both universities and courses
- Injects both repos via constructor (DI for testing)
- Pass-through CRUD — no complex business logic

### Server Actions

**`courses.ts`** (`src/app/actions/courses.ts`)

| Action | Auth | Purpose |
|---|---|---|
| `fetchUniversities()` | authenticated | List all universities |
| `fetchCourses(universityId?)` | authenticated | List courses, optionally filtered |
| `createUniversity(data)` | admin | Add university |
| `updateUniversity(id, data)` | admin | Edit university |
| `deleteUniversity(id)` | admin | Remove university (cascades courses) |
| `createCourse(data)` | admin | Add course |
| `updateCourse(id, data)` | admin | Edit course |
| `deleteCourse(id)` | admin | Remove course |

All follow existing pattern: `'use server'` → Zod validation → auth check → service call → `ActionResult<T>` → `revalidatePath`.

### Types & Query Keys

```typescript
// query-keys.ts additions
universities: {
  all: ['universities'] as const,
},
courses: {
  all: ['courses'] as const,
  byUniversity: (uniId: string) => ['courses', uniId] as const,
},
```

## Admin UI

### Route

```
src/app/(protected)/admin/courses/
├── page.tsx                # Server component — fetch initial data
└── AdminCoursesClient.tsx  # Client component — tabbed CRUD UI
```

### Layout

Two tabs: **Universities** | **Courses**

**Universities tab:**
- Table: Name, Short Name, Courses Count, Actions (Edit / Delete)
- "Add University" button → modal form (name, short name, logo URL)
- Delete → confirmation modal (warns about cascading course deletion)

**Courses tab:**
- University filter dropdown at top
- Table: Code, Name, University, Actions (Edit / Delete)
- "Add Course" button → modal form (university select, code, name)

### Sidebar

Add to `JUMP_LINKS` in `Sidebar.tsx`:
```typescript
{ labelKey: 'courses' as const, icon: BookOpen, href: '/admin/courses' },
```

## Frontend Migration

### Custom Hook

**`src/hooks/useCourseData.ts`** — shared hook for all 5 consumer components:
- Fetches universities + courses via server actions
- Returns `{ universities, courses, isLoading }`
- Courses filterable by `universityId`

### Component Updates

| Component | Change |
|---|---|
| `NewSessionModal` | Replace static import → `useCourseData()` hook |
| `MockExamModal` | Replace static import → `useCourseData()` hook |
| `ExamEntryClient` | Replace static import → `useCourseData()` hook |
| `FileUploader` | Replace static import → `useCourseData()` hook |
| `KnowledgeClient` | Replace static import → `useCourseData()` hook |

### Session Schema

- New sessions store `course_id` (uuid FK) instead of embedded Course JSON
- `SessionRepository.mapToEntity()` resolves `course_id` via join with `courses` + `universities`
- Downstream consumers (`ChatService`, LLM prompt) receive the same `Course` shape — resolved at repository level

### Cleanup

- Delete `src/constants/index.ts`
- Remove all imports referencing it
- localStorage keys (`lastUniId`, `lastCourseId`) store UUIDs

## Error Handling & Edge Cases

- **Cascade deletion:** Deleting a university cascades to courses. Deleting a course sets `course_id = NULL` on sessions/documents (not cascade — preserve data).
- **Empty state:** Components show "No courses available" message if DB is empty. Admin page shows "Add your first university."
- **Validation:** University name + short_name required (short_name max 10 chars). Course code required (alphanumeric, uppercase), unique per university.
- **Migration safety:** Additive — new tables/columns first, backfill, then drop old column. Unmatched sessions get `course_id = NULL`.

## i18n

All new UI strings added to both `en` and `zh` translation files:
- Admin page labels, form labels, validation errors, empty states
- Sidebar link label (`courses` / `课程管理`)
