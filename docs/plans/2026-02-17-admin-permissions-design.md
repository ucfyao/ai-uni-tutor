# Admin Permission System Design

## Overview

Introduce a three-tier role system (`super_admin` / `admin` / `user`) with course-level permission assignment. Super admins have full access; regular admins can only manage documents within courses assigned to them.

## Roles

| Role          | Description                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| `super_admin` | Full system access. Set manually in database only.                                         |
| `admin`       | Course-scoped access. Promoted from `user` by super admin, then assigned specific courses. |
| `user`        | Regular student. No admin capabilities.                                                    |

## Database Changes

### 1. `profiles.role` extension

Add `'super_admin'` as a new valid value. No migration of existing `admin` users. Add CHECK constraint to enforce valid values.

```sql
ALTER TABLE profiles ADD CONSTRAINT chk_role
  CHECK (role IN ('user', 'admin', 'super_admin'));
```

### 2. New table: `admin_course_assignments`

```sql
CREATE TABLE admin_course_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_id, course_id)
);

CREATE INDEX idx_admin_course_admin ON admin_course_assignments (admin_id);
CREATE INDEX idx_admin_course_course ON admin_course_assignments (course_id);
```

Note: `assigned_by` is nullable with `ON DELETE SET NULL` — if the super_admin who assigned the permission is deleted, the assignment record is preserved.

### 3. RLS policies — complete list

Current RLS state and required changes:

| Table                      | Current RLS                                   | Required Change                                                    |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `admin_course_assignments` | (new table)                                   | Create: super_admin full access; admin SELECT own records          |
| `documents`                | **No RLS enabled**                            | Create from scratch: owner OR super_admin OR course-assigned admin |
| `exam_papers`              | `user_id = auth.uid()` for write ops          | Drop & recreate: add OR super_admin/admin conditions               |
| `exam_questions`           | Via parent `exam_papers.user_id = auth.uid()` | Drop & recreate: add OR super_admin/admin conditions               |
| `assignments`              | `auth.uid() = user_id` for all ops            | Drop & recreate: add OR super_admin/admin conditions               |
| `assignment_items`         | Via parent `assignments.user_id = auth.uid()` | Drop & recreate: add OR super_admin/admin conditions               |
| `universities`             | `role = 'admin'` for write ops                | Drop & recreate: change to `role = 'super_admin'` (**breaking**)   |
| `courses`                  | `role = 'admin'` for write ops                | Drop & recreate: change to `role = 'super_admin'` (**breaking**)   |

**⚠ Breaking change:** Universities/courses RLS will change from `role = 'admin'` to `role = 'super_admin'`. Existing `admin` users will lose the ability to create/edit/delete universities and courses. This is intentional — only `super_admin` should manage these entities. Ensure at least one user is manually set to `super_admin` in the database before running the migration.

**Key insight:** `documents` table has NO RLS at all — must `ENABLE ROW LEVEL SECURITY` and create all policies from scratch. For `exam_papers`/`assignments`, existing `user_id = auth.uid()` policies would block admins managing other users' content.

**RLS policy patterns:**

Tables with `user_id` column (`documents`, `exam_papers`, `assignments`) use a direct pattern:

```sql
-- SELECT/UPDATE/DELETE → USING (...)
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)

-- INSERT → WITH CHECK (...) — same condition, different clause
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
```

Child tables without `user_id` (`exam_questions`, `assignment_items`) use a **parent subquery pattern** — they join to their parent table to check ownership:

```sql
-- exam_questions: check via parent exam_papers
USING (EXISTS (
  SELECT 1 FROM exam_papers
  WHERE exam_papers.id = exam_questions.paper_id
  AND (
    exam_papers.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  )
));
```

Note: Course-level permission is enforced in the application layer (`requireCourseAdmin()`), not in RLS. RLS only distinguishes admin/super_admin from regular users. This avoids complex cross-table subqueries in every RLS policy.

**⚠ Known risk:** RLS allows **any** admin to read/write records across all courses at the database level. Course-scoped isolation is enforced only in the application layer (`requireCourseAdmin()`). This is an intentional tradeoff to keep RLS simple. **Mitigation rule:** repositories must never be called directly from components or API routes — always go through server actions/services which enforce `requireCourseAdmin()` before data access.

## Permission Check Layer

### Functions (`src/lib/supabase/server.ts`)

| Function                       | Purpose                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `requireSuperAdmin()`          | Role must be `super_admin`. For: university/course CRUD, user role management, course assignment, global stats.          |
| `requireCourseAdmin(courseId)` | Super admin passes directly; admin checked against `admin_course_assignments`. For: document/exam/assignment operations. |
| `requireAnyAdmin()`            | Role is `admin` or `super_admin`. For: admin layout access.                                                              |
| `requireAdmin()` (deprecated)  | Alias → `requireAnyAdmin()`. Kept during migration, to be removed after all call sites are updated.                      |

### Operation mapping

| Operation                      | Guard                          |
| ------------------------------ | ------------------------------ |
| Create/edit/delete university  | `requireSuperAdmin()`          |
| Create/edit/delete course      | `requireSuperAdmin()`          |
| Promote/demote user role       | `requireSuperAdmin()`          |
| Assign course permissions      | `requireSuperAdmin()`          |
| Global statistics              | `requireSuperAdmin()`          |
| Upload/edit/delete documents   | `requireCourseAdmin(courseId)` |
| Upload/edit/delete exams       | `requireCourseAdmin(courseId)` |
| Upload/edit/delete assignments | `requireCourseAdmin(courseId)` |
| Access admin layout            | `requireAnyAdmin()`            |

### Call sites requiring migration (exhaustive list)

**`src/app/actions/courses.ts`** — 6 calls, all → `requireSuperAdmin()`:

- `createUniversity` (line 101)
- `updateUniversity` (line 125)
- `deleteUniversity` (line 146)
- `createCourse` (line 158)
- `updateCourse` (line 183)
- `deleteCourse` (line 202)

**`src/app/actions/documents.ts`** — 9 calls:

- `fetchDocuments` (line 29) → `requireAnyAdmin()` + backend course filtering via `getAvailableCourseIds()` (admin only sees assigned courses, super_admin sees all)
- `uploadDocument` (line 131) → `requireCourseAdmin(courseId)` (courseId available from formData)
- `deleteDocument` (line 217) → `requireCourseAdmin(courseId)` (resolve courseId from document)
- `updateDocumentChunks` (line 245) → `requireCourseAdmin(courseId)` (resolve courseId from document)
- `regenerateEmbeddings` (line 275) → `requireCourseAdmin(courseId)` (resolve courseId from document)
- `retryDocument` (line 304) → `requireCourseAdmin(courseId)` (resolve courseId from document)
- `updateDocumentMeta` (line 327) → `requireCourseAdmin(courseId)` (resolve courseId from document)
- `updateExamQuestions` (line 362) → `requireCourseAdmin(courseId)` (resolve courseId from exam paper)
- `updateAssignmentItems` (line 402) → `requireCourseAdmin(courseId)` (resolve courseId from assignment)

All 7 write actions (lines 217–402) must resolve `courseId` from the entity before calling `requireCourseAdmin()`. Without this, course-scoped permissions are ineffective for writes — any admin could mutate any document regardless of course assignment.

**`src/app/api/documents/parse/route.ts`** — 1 call:

- SSE pipeline auth (line 88) → `requireCourseAdmin(courseId)` (resolve documentId from request body → courseId)

**`src/app/(protected)/admin/layout.tsx`** — inline Supabase query (NOT a `requireAdmin()` call):

- `profile?.role !== 'admin'` (line 16) → rewrite to check both `admin` and `super_admin`

### courseId resolution for document operations

Several document actions receive `documentId` not `courseId`. Resolution strategy:

```typescript
// For operations that receive documentId:
// 1. Look up document/exam/assignment to get course_id
// 2. Pass course_id to requireCourseAdmin()
// This adds one DB query but is necessary for correct permission checking.

async function getCourseIdFromDocument(documentId: string): Promise<string | null> {
  const doc = await documentService.findById(documentId);
  return doc?.courseId ?? null;
}
```

For `deleteDocument`, `updateDocumentChunks`, `regenerateEmbeddings`, etc. — first resolve courseId from the entity, then call `requireCourseAdmin(courseId)`. If courseId is null (legacy documents without course), fall back to ownership check (`user_id === auth.uid()`).

## Repository & Service Layer

### New: `AdminRepository`

Handles `admin_course_assignments` table operations only.

```typescript
class AdminRepository {
  assignCourse(adminId, courseId, assignedBy): Promise<void>;
  removeCourse(adminId, courseId): Promise<void>;
  removeAllCourses(adminId): Promise<void>;
  getAssignedCourses(adminId): Promise<Course[]>;
  getAssignedCourseIds(adminId): Promise<string[]>;
  hasCourseAccess(adminId, courseId): Promise<boolean>;
}
```

### Existing: `ProfileRepository` (extended)

`searchUsers`, `updateRole`, and `listAdmins` belong in `ProfileRepository` since they operate on the `profiles` table, not `admin_course_assignments`.

```typescript
// Add to existing ProfileRepository:
searchUsers(search?: string): Promise<Profile[]>; // .limit(50)
updateRole(userId, role): Promise<void>;
findByRole(role): Promise<Profile[]>; // .limit(100), used for listAdmins
```

### New: `AdminService`

```typescript
class AdminService {
  promoteToAdmin(userId): Promise<void>        // user → admin (via profileRepo.updateRole)
  demoteToUser(adminId, requesterId): Promise<void>  // admin → user
    // Order: removeAllCourses first, then updateRole
    // Mid-state (admin with no courses) is safe — no excess permissions
  assignCourses(adminId, courseIds[], assignedBy): Promise<void>
  removeCourses(adminId, courseIds[]): Promise<void>
  setCourses(adminId, courseIds[], assignedBy): Promise<void>  // diff-based
  getAdminWithCourses(adminId): Promise<{profile, courses[]}>
  getAvailableCourseIds(userId, role): Promise<string[]>
    // super_admin: returns all course IDs from courses table
    // admin: returns assigned course IDs only
}
```

### Existing changes

- `DocumentRepository` / `ExamPaperRepository` / `AssignmentRepository`: support querying by course without `user_id` filter for admin access.

## Frontend Changes

### Admin layout (`/admin/layout.tsx`)

Rewrite inline Supabase query to check `role IN ('admin', 'super_admin')`. Current code is a direct DB query (`profile?.role !== 'admin'`), not a function call — must be rewritten, not just swapped.

### Navigation (role-based menu)

| Menu item                                  | super_admin |         admin         |
| ------------------------------------------ | :---------: | :-------------------: |
| Course management (university/course CRUD) |     Yes     |          No           |
| User management (roles + assignment)       |     Yes     |          No           |
| Knowledge base (documents)                 | All courses | Assigned courses only |
| Exam management                            | All courses | Assigned courses only |
| Assignment management                      | All courses | Assigned courses only |
| Global statistics                          |     Yes     |          No           |

### New page: `/admin/users/`

Super admin only. Features:

- User list with search (by email/name), showing current role
- Promote/demote toggle: `user` <-> `admin`
- Course assignment: multi-select course list for each admin

### Existing page changes

- Course filter dropdown: super_admin sees all courses; admin sees assigned courses only.
- Document/exam/assignment lists: show all files in the course (not filtered by uploader).

## Security & Edge Cases

### Guard rules

- Super admin cannot demote themselves.
- UI/API do not support promoting to `super_admin` (database-only).
- `demoteToUser()` order: first removes all `admin_course_assignments`, then changes role. Mid-state is "admin with no courses" (safe direction — no excess permissions).
- `ON DELETE CASCADE` on `course_id` handles course deletion.
- `assigned_by ON DELETE SET NULL` handles super_admin deletion.

### Defense in depth

- Layer 1: Server Action guards (`requireSuperAdmin()` / `requireCourseAdmin()`)
- Layer 2: Database RLS policies (independent enforcement)
- RLS enforces admin/super_admin role check; application layer enforces course-level assignment check.

### Out of scope (YAGNI)

- Audit logging (existing `assigned_by` + `created_at` provides basic traceability)
- Bulk admin import
- Permission expiry / time limits
- Global statistics page implementation (entry point reserved, built later)
- Knowledge-related tables (`knowledge_cards`, `user_cards`, `card_conversations`) — linked via `document_id ON DELETE SET NULL`, not affected by permission changes
