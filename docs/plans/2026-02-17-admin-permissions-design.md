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

Add `'super_admin'` as a new valid value. No migration of existing `admin` users.

```
'user' | 'admin' | 'super_admin'
```

### 2. New table: `admin_course_assignments`

```sql
CREATE TABLE admin_course_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_id, course_id)
);
```

### 3. RLS policies

- `admin_course_assignments`: super_admin full access; admin can SELECT own records only.
- `documents` / `exam_papers` / `assignments`: extend existing RLS to allow access when user is super_admin OR admin with matching course assignment.

## Permission Check Layer

### Functions (`src/lib/supabase/server.ts`)

| Function                       | Purpose                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `requireSuperAdmin()`          | Role must be `super_admin`. For: university/course CRUD, user role management, course assignment, global stats.          |
| `requireCourseAdmin(courseId)` | Super admin passes directly; admin checked against `admin_course_assignments`. For: document/exam/assignment operations. |
| `requireAnyAdmin()`            | Role is `admin` or `super_admin`. For: admin layout access.                                                              |

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

## Repository & Service Layer

### New: `AdminRepository`

```typescript
class AdminRepository {
  assignCourse(adminId, courseId, assignedBy): Promise<void>;
  removeCourse(adminId, courseId): Promise<void>;
  getAssignedCourses(adminId): Promise<Course[]>;
  getAdminsForCourse(courseId): Promise<Profile[]>;
  hasCourseAccess(adminId, courseId): Promise<boolean>;
  listAdmins(): Promise<Profile[]>;
  listUsers(search?: string): Promise<Profile[]>;
}
```

### New: `AdminService`

```typescript
class AdminService {
  promoteToAdmin(userId): Promise<void>        // user → admin
  demoteToUser(adminId): Promise<void>          // admin → user (clears all course assignments)
  assignCourses(adminId, courseIds[]): Promise<void>
  removeCourses(adminId, courseIds[]): Promise<void>
  getAdminWithCourses(adminId): Promise<{profile, courses[]}>
  getGlobalStats(): Promise<Stats>              // future expansion
}
```

### Existing changes

- `DocumentRepository` / `ExamPaperRepository` / `AssignmentRepository`: support querying by course without `user_id` filter for admin access.

## Frontend Changes

### Admin layout (`/admin/layout.tsx`)

Use `requireAnyAdmin()` instead of `requireAdmin()`.

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
- `demoteToUser()` cascades: removes all `admin_course_assignments` records.
- `ON DELETE CASCADE` on `course_id` handles course deletion.

### Defense in depth

- Layer 1: Server Action guards (`requireSuperAdmin()` / `requireCourseAdmin()`)
- Layer 2: Database RLS policies (independent enforcement)

### Out of scope (YAGNI)

- Audit logging (existing `assigned_by` + `created_at` provides basic traceability)
- Bulk admin import
- Permission expiry / time limits
- Global statistics page implementation (entry point reserved, built later)
