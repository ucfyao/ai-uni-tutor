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
| `universities`             | `role = 'admin'` for write ops                | Drop & recreate: change to `role = 'super_admin'`                  |
| `courses`                  | `role = 'admin'` for write ops                | Drop & recreate: change to `role = 'super_admin'`                  |

**Key insight:** `documents` table has NO RLS at all — must `ENABLE ROW LEVEL SECURITY` and create all policies from scratch. For `exam_papers`/`assignments`, existing `user_id = auth.uid()` policies would block admins managing other users' content.

All admin-accessible policies follow this pattern:

```sql
-- Allow access if:
-- 1. User owns the record (user_id = auth.uid()), OR
-- 2. User is super_admin, OR
-- 3. User is admin (course-level check done in application layer)
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
```

Note: Course-level permission is enforced in the application layer (`requireCourseAdmin()`), not in RLS. RLS only distinguishes admin/super_admin from regular users. This avoids complex cross-table subqueries in every RLS policy.

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

- `fetchDocuments` (line 29) → `requireAnyAdmin()` + course filtering
- `uploadDocument` (line 131) → `requireCourseAdmin(courseId)`
- `deleteDocument` (line 217) → `requireAnyAdmin()` + ownership/course check
- `updateDocumentChunks` (line 245) → `requireAnyAdmin()`
- `regenerateEmbeddings` (line 275) → `requireAnyAdmin()`
- `retryDocument` (line 304) → `requireAnyAdmin()`
- `updateDocumentMeta` (line 327) → `requireAnyAdmin()`
- `updateExamQuestions` (line 362) → `requireAnyAdmin()`
- `updateAssignmentItems` (line 402) → `requireAnyAdmin()`

**`src/app/api/documents/parse/route.ts`** — 1 call:

- SSE pipeline auth (line 88) → `requireAnyAdmin()`

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

```typescript
class AdminRepository {
  assignCourse(adminId, courseId, assignedBy): Promise<void>;
  removeCourse(adminId, courseId): Promise<void>;
  removeAllCourses(adminId): Promise<void>;
  getAssignedCourses(adminId): Promise<Course[]>;
  getAssignedCourseIds(adminId): Promise<string[]>;
  hasCourseAccess(adminId, courseId): Promise<boolean>;
  listAdmins(): Promise<Profile[]>; // .limit(100)
  searchUsers(search?: string): Promise<Profile[]>; // .limit(50)
  updateRole(userId, role): Promise<void>;
}
```

### New: `AdminService`

```typescript
class AdminService {
  promoteToAdmin(userId): Promise<void>        // user → admin
  demoteToUser(adminId, requesterId): Promise<void>  // admin → user
    // Order: removeAllCourses first, then updateRole
    // Mid-state (admin with no courses) is safe — no excess permissions
  assignCourses(adminId, courseIds[], assignedBy): Promise<void>
  removeCourses(adminId, courseIds[]): Promise<void>
  setCourses(adminId, courseIds[], assignedBy): Promise<void>  // diff-based
  getAdminWithCourses(adminId): Promise<{profile, courses[]}>
  getAvailableCourseIds(userId, role): Promise<string[] | 'all'>
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
