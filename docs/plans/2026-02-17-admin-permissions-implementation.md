# Admin Permission System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a three-tier role system (`super_admin` / `admin` / `user`) with course-level permission assignment for document management.

**Architecture:** Extend existing `profiles.role` to support `super_admin`, add `admin_course_assignments` join table, replace `requireAdmin()` with `requireSuperAdmin()` / `requireCourseAdmin(courseId)` / `requireAnyAdmin()`, update all 16 call sites, rewrite RLS for 8 tables, update admin pages.

**Tech Stack:** Supabase (PostgreSQL + RLS), Next.js Server Actions, Mantine v8 components, Zod validation.

---

### Task 1: Database Migration

**Files:**

- Create: `supabase/migrations/20260217_admin_permissions.sql`

**Step 1: Write the migration SQL**

```sql
-- Admin Permissions Migration
-- Adds super_admin role support and course-level permission assignments
-- Rewrites RLS for 8 tables: admin_course_assignments, documents,
-- exam_papers, exam_questions, assignments, assignment_items, universities, courses

-- ============================================================================
-- 1. CHECK constraint on profiles.role
-- ============================================================================
ALTER TABLE profiles ADD CONSTRAINT chk_role
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- ============================================================================
-- 2. admin_course_assignments table
-- ============================================================================
CREATE TABLE admin_course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_id, course_id)
);

CREATE INDEX idx_admin_course_admin ON admin_course_assignments (admin_id);
CREATE INDEX idx_admin_course_course ON admin_course_assignments (course_id);

ALTER TABLE admin_course_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aca_select" ON admin_course_assignments
  FOR SELECT TO authenticated
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "aca_insert" ON admin_course_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "aca_delete" ON admin_course_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- 3. documents — NO RLS exists, create from scratch
-- ============================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = documents.course_id
    )
  );

CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = documents.course_id
    )
  );

CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = documents.course_id
    )
  );

CREATE POLICY "documents_delete" ON documents
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = documents.course_id
    )
  );

-- ============================================================================
-- 4. exam_papers — drop existing user_id-only policies, add admin support
-- ============================================================================
DROP POLICY IF EXISTS "exam_papers_select" ON exam_papers;
DROP POLICY IF EXISTS "exam_papers_insert" ON exam_papers;
DROP POLICY IF EXISTS "exam_papers_update" ON exam_papers;
DROP POLICY IF EXISTS "exam_papers_delete" ON exam_papers;

CREATE POLICY "exam_papers_select" ON exam_papers
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_papers_insert" ON exam_papers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_papers_update" ON exam_papers
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_papers_delete" ON exam_papers
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 5. exam_questions — drop existing policies, add admin support
-- ============================================================================
DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
DROP POLICY IF EXISTS "exam_questions_insert" ON exam_questions;
DROP POLICY IF EXISTS "exam_questions_update" ON exam_questions;
DROP POLICY IF EXISTS "exam_questions_delete" ON exam_questions;

CREATE POLICY "exam_questions_select" ON exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.visibility = 'public'
      OR exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "exam_questions_insert" ON exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "exam_questions_update" ON exam_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "exam_questions_delete" ON exam_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

-- ============================================================================
-- 6. assignments — drop existing policy, add admin support
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own assignments" ON assignments;

CREATE POLICY "assignments_select" ON assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "assignments_insert" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "assignments_update" ON assignments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

CREATE POLICY "assignments_delete" ON assignments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- ============================================================================
-- 7. assignment_items — drop existing policy, add admin support
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own assignment items" ON assignment_items;

CREATE POLICY "assignment_items_select" ON assignment_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "assignment_items_insert" ON assignment_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "assignment_items_update" ON assignment_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

CREATE POLICY "assignment_items_delete" ON assignment_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
    )
  ));

-- ============================================================================
-- 8. universities — change role = 'admin' to role = 'super_admin'
-- ============================================================================
DROP POLICY IF EXISTS "universities_admin_insert" ON universities;
DROP POLICY IF EXISTS "universities_admin_update" ON universities;
DROP POLICY IF EXISTS "universities_admin_delete" ON universities;

CREATE POLICY "universities_superadmin_insert" ON universities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "universities_superadmin_update" ON universities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "universities_superadmin_delete" ON universities
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================================
-- 9. courses — change role = 'admin' to role = 'super_admin'
-- ============================================================================
DROP POLICY IF EXISTS "courses_admin_insert" ON courses;
DROP POLICY IF EXISTS "courses_admin_update" ON courses;
DROP POLICY IF EXISTS "courses_admin_delete" ON courses;

CREATE POLICY "courses_superadmin_insert" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "courses_superadmin_update" ON courses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "courses_superadmin_delete" ON courses
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260217_admin_permissions.sql
git commit -m "feat(db): add admin_course_assignments table and rewrite RLS for 8 tables"
```

---

### Task 2: TypeScript Types & Domain Models

**Files:**

- Modify: `src/types/database.ts` — add `admin_course_assignments` table type
- Modify: `src/lib/domain/models/Profile.ts` — add `UserRole` type

**Step 1: Add `admin_course_assignments` to database types**

Add to `src/types/database.ts` inside `Tables`, after the `assignment_items` block:

```typescript
admin_course_assignments: {
  Row: {
    id: string;
    admin_id: string;
    course_id: string;
    assigned_by: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    admin_id: string;
    course_id: string;
    assigned_by?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    admin_id?: string;
    course_id?: string;
    assigned_by?: string | null;
    created_at?: string;
  };
  Relationships: [];
};
```

Note: `assigned_by` is `string | null` because the column is nullable (`ON DELETE SET NULL`).

**Step 2: Add `UserRole` type to Profile model**

In `src/lib/domain/models/Profile.ts`, add:

```typescript
export type UserRole = 'user' | 'admin' | 'super_admin';
```

Change `role: string` to `role: UserRole` in `ProfileEntity`.

**Step 3: Commit**

```bash
git add src/types/database.ts src/lib/domain/models/Profile.ts
git commit -m "feat(db): add admin_course_assignments types and UserRole"
```

---

### Task 3: Permission Check Functions

**Files:**

- Modify: `src/lib/supabase/server.ts` — replace `requireAdmin()` with three new functions

**Step 1: Replace `requireAdmin` with new permission functions**

Replace the `requireAdmin()` function (lines 53-61) in `src/lib/supabase/server.ts` with:

```typescript
/** Require super_admin role or throw ForbiddenError. */
export async function requireSuperAdmin() {
  const { ForbiddenError } = await import('@/lib/errors');
  const user = await requireUser();
  const { getProfileRepository } = await import('@/lib/repositories');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') throw new ForbiddenError('Super admin access required');
  return user;
}

/** Require admin or super_admin role or throw ForbiddenError. */
export async function requireAnyAdmin() {
  const { ForbiddenError } = await import('@/lib/errors');
  const user = await requireUser();
  const { getProfileRepository } = await import('@/lib/repositories');
  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin')
    throw new ForbiddenError('Admin access required');
  return { user, role: profile.role as string };
}

/** Require course-level admin access: super_admin passes directly, admin checked against assignments. */
export async function requireCourseAdmin(courseId: string) {
  const { ForbiddenError } = await import('@/lib/errors');
  const { user, role } = await requireAnyAdmin();
  if (role === 'super_admin') return user;
  // admin: check course assignment
  const { getAdminRepository } = await import('@/lib/repositories/AdminRepository');
  const hasAccess = await getAdminRepository().hasCourseAccess(user.id, courseId);
  if (!hasAccess) throw new ForbiddenError('No access to this course');
  return user;
}

/** @deprecated Use requireSuperAdmin(), requireAnyAdmin(), or requireCourseAdmin() instead. */
export async function requireAdmin() {
  return (await requireAnyAdmin()).user;
}
```

Key change from v1: deprecated `requireAdmin()` now points to `requireAnyAdmin()` (not `requireSuperAdmin()`), so any missed call sites won't break existing `admin` users.

**Step 2: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat(auth): add requireSuperAdmin, requireAnyAdmin, requireCourseAdmin"
```

---

### Task 4: AdminRepository

**Files:**

- Create: `src/lib/repositories/AdminRepository.ts`
- Modify: `src/lib/repositories/index.ts` — add export

**Step 1: Create AdminRepository**

Create `src/lib/repositories/AdminRepository.ts`:

```typescript
/**
 * Admin Repository Implementation
 *
 * Handles admin course assignments and user role queries.
 */

import type { CourseEntity } from '@/lib/domain/models/Course';
import type { ProfileEntity } from '@/lib/domain/models/Profile';
import { DatabaseError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export class AdminRepository {
  async assignCourse(adminId: string, courseId: string, assignedBy: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('admin_course_assignments').insert({
      admin_id: adminId,
      course_id: courseId,
      assigned_by: assignedBy,
    });
    if (error) throw new DatabaseError(`Failed to assign course: ${error.message}`, error);
  }

  async removeCourse(adminId: string, courseId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('admin_course_assignments')
      .delete()
      .eq('admin_id', adminId)
      .eq('course_id', courseId);
    if (error)
      throw new DatabaseError(`Failed to remove course assignment: ${error.message}`, error);
  }

  async removeAllCourses(adminId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('admin_course_assignments')
      .delete()
      .eq('admin_id', adminId);
    if (error)
      throw new DatabaseError(`Failed to remove course assignments: ${error.message}`, error);
  }

  async getAssignedCourses(adminId: string): Promise<CourseEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('course_id, courses(id, university_id, code, name, created_at, updated_at)')
      .eq('admin_id', adminId);

    if (error) throw new DatabaseError(`Failed to fetch assigned courses: ${error.message}`, error);

    return (data ?? [])
      .map((row) => {
        const c = row.courses as unknown as Record<string, string> | null;
        if (!c) return null;
        return {
          id: c.id,
          universityId: c.university_id,
          code: c.code,
          name: c.name,
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
        };
      })
      .filter((c): c is CourseEntity => c !== null);
  }

  async hasCourseAccess(adminId: string, courseId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('id')
      .eq('admin_id', adminId)
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to check course access: ${error.message}`, error);
    }
    return data !== null;
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('admin_course_assignments')
      .select('course_id')
      .eq('admin_id', adminId);

    if (error)
      throw new DatabaseError(`Failed to fetch assigned course IDs: ${error.message}`, error);
    return (data ?? []).map((row) => row.course_id);
  }

  async listAdmins(): Promise<ProfileEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new DatabaseError(`Failed to list admins: ${error.message}`, error);

    return (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      subscriptionStatus: row.subscription_status,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async searchUsers(search?: string): Promise<ProfileEntity[]> {
    const supabase = await createClient();
    let query = supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(`Failed to search users: ${error.message}`, error);

    return (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      subscriptionStatus: row.subscription_status,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
      role: row.role,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async updateRole(userId: string, role: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw new DatabaseError(`Failed to update user role: ${error.message}`, error);
  }
}

let _adminRepository: AdminRepository | null = null;

export function getAdminRepository(): AdminRepository {
  if (!_adminRepository) {
    _adminRepository = new AdminRepository();
  }
  return _adminRepository;
}
```

**Step 2: Add export to index**

Add to `src/lib/repositories/index.ts`:

```typescript
export { AdminRepository, getAdminRepository } from './AdminRepository';
```

**Step 3: Commit**

```bash
git add src/lib/repositories/AdminRepository.ts src/lib/repositories/index.ts
git commit -m "feat(auth): add AdminRepository for course assignments and user roles"
```

---

### Task 5: AdminService

**Files:**

- Create: `src/lib/services/AdminService.ts`

**Step 1: Create AdminService**

Create `src/lib/services/AdminService.ts`:

```typescript
/**
 * Admin Service
 *
 * Business logic for admin role management and course permission assignment.
 */

import type { CourseEntity } from '@/lib/domain/models/Course';
import type { ProfileEntity, UserRole } from '@/lib/domain/models/Profile';
import { ForbiddenError } from '@/lib/errors';
import { getAdminRepository } from '@/lib/repositories/AdminRepository';
import type { AdminRepository } from '@/lib/repositories/AdminRepository';

export class AdminService {
  private readonly adminRepo: AdminRepository;

  constructor(adminRepo?: AdminRepository) {
    this.adminRepo = adminRepo ?? getAdminRepository();
  }

  async promoteToAdmin(userId: string): Promise<void> {
    await this.adminRepo.updateRole(userId, 'admin');
  }

  /** Demote admin to user. Order: remove courses first, then change role.
   *  Mid-state (admin with no courses) is safe — no excess permissions. */
  async demoteToUser(adminId: string, requesterId: string): Promise<void> {
    if (adminId === requesterId) {
      throw new ForbiddenError('Cannot demote yourself');
    }
    await this.adminRepo.removeAllCourses(adminId);
    await this.adminRepo.updateRole(adminId, 'user');
  }

  async assignCourses(adminId: string, courseIds: string[], assignedBy: string): Promise<void> {
    for (const courseId of courseIds) {
      await this.adminRepo.assignCourse(adminId, courseId, assignedBy);
    }
  }

  async removeCourses(adminId: string, courseIds: string[]): Promise<void> {
    for (const courseId of courseIds) {
      await this.adminRepo.removeCourse(adminId, courseId);
    }
  }

  async setCourses(adminId: string, courseIds: string[], assignedBy: string): Promise<void> {
    const currentIds = await this.adminRepo.getAssignedCourseIds(adminId);
    const toAdd = courseIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !courseIds.includes(id));

    for (const id of toRemove) {
      await this.adminRepo.removeCourse(adminId, id);
    }
    for (const id of toAdd) {
      await this.adminRepo.assignCourse(adminId, id, assignedBy);
    }
  }

  async getAssignedCourses(adminId: string): Promise<CourseEntity[]> {
    return this.adminRepo.getAssignedCourses(adminId);
  }

  async getAssignedCourseIds(adminId: string): Promise<string[]> {
    return this.adminRepo.getAssignedCourseIds(adminId);
  }

  async listAdmins(): Promise<ProfileEntity[]> {
    return this.adminRepo.listAdmins();
  }

  async searchUsers(search?: string): Promise<ProfileEntity[]> {
    return this.adminRepo.searchUsers(search);
  }

  async getAdminWithCourses(
    adminId: string,
  ): Promise<{ profile: ProfileEntity; courses: CourseEntity[] } | null> {
    const { getProfileRepository } = await import('@/lib/repositories');
    const profile = await getProfileRepository().findById(adminId);
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) return null;
    const courses = await this.adminRepo.getAssignedCourses(adminId);
    return { profile, courses };
  }

  /** Get available courses for an admin: super_admin sees all, admin sees assigned only. */
  async getAvailableCourseIds(userId: string, role: UserRole): Promise<string[] | 'all'> {
    if (role === 'super_admin') return 'all';
    return this.adminRepo.getAssignedCourseIds(userId);
  }
}

let _adminService: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!_adminService) {
    _adminService = new AdminService();
  }
  return _adminService;
}
```

**Step 2: Commit**

```bash
git add src/lib/services/AdminService.ts
git commit -m "feat(auth): add AdminService for role management and course assignments"
```

---

### Task 6: Server Actions — Admin User Management

**Files:**

- Create: `src/app/actions/admin.ts`

**Step 1: Create admin server actions**

Create `src/app/actions/admin.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { mapError } from '@/lib/errors';
import { getAdminService } from '@/lib/services/AdminService';
import { requireSuperAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/actions';

// ============================================================================
// Types
// ============================================================================

export interface AdminUserItem {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

export interface AdminWithCourses extends AdminUserItem {
  courseIds: string[];
}

// ============================================================================
// Schemas
// ============================================================================

const searchSchema = z.object({
  search: z.string().max(100).optional(),
});

const promoteSchema = z.object({
  userId: z.string().uuid(),
});

const demoteSchema = z.object({
  userId: z.string().uuid(),
});

const setCoursesSchema = z.object({
  adminId: z.string().uuid(),
  courseIds: z.array(z.string().uuid()),
});

// ============================================================================
// Actions
// ============================================================================

export async function searchUsers(input: unknown): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const parsed = searchSchema.parse(input);
    const service = getAdminService();
    const users = await service.searchUsers(parsed.search);
    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function listAdmins(): Promise<ActionResult<AdminUserItem[]>> {
  try {
    await requireSuperAdmin();
    const service = getAdminService();
    const admins = await service.listAdmins();
    return {
      success: true,
      data: admins.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return mapError(error);
  }
}

export async function getAdminCourseIds(adminId: string): Promise<ActionResult<string[]>> {
  try {
    await requireSuperAdmin();
    const service = getAdminService();
    const courseIds = await service.getAssignedCourseIds(adminId);
    return { success: true, data: courseIds };
  } catch (error) {
    return mapError(error);
  }
}

export async function promoteToAdmin(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = promoteSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot modify your own role', code: 'FORBIDDEN' };
    }
    const service = getAdminService();
    await service.promoteToAdmin(parsed.userId);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function demoteToUser(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = demoteSchema.parse(input);
    if (parsed.userId === user.id) {
      return { success: false, error: 'Cannot demote yourself', code: 'FORBIDDEN' };
    }
    const service = getAdminService();
    await service.demoteToUser(parsed.userId, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}

export async function setAdminCourses(input: unknown): Promise<ActionResult<void>> {
  try {
    const user = await requireSuperAdmin();
    const parsed = setCoursesSchema.parse(input);
    const service = getAdminService();
    await service.setCourses(parsed.adminId, parsed.courseIds, user.id);
    revalidatePath('/admin/users');
    return { success: true, data: undefined };
  } catch (error) {
    return mapError(error);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "feat(auth): add admin server actions for user/role management"
```

---

### Task 7: Update Existing Server Actions — courses.ts

**Files:**

- Modify: `src/app/actions/courses.ts`

**Step 1: Replace `requireAdmin` with `requireSuperAdmin` for all 6 mutations**

In `src/app/actions/courses.ts`:

- Change import: `requireAdmin` → `requireSuperAdmin`
- Replace all 6 `await requireAdmin()` calls with `await requireSuperAdmin()`:
  - `createUniversity` (line 101)
  - `updateUniversity` (line 125)
  - `deleteUniversity` (line 146)
  - `createCourse` (line 158)
  - `updateCourse` (line 183)
  - `deleteCourse` (line 202)

**Step 2: Commit**

```bash
git add src/app/actions/courses.ts
git commit -m "refactor(auth): use requireSuperAdmin for course mutations"
```

---

### Task 8: Update Existing Server Actions — documents.ts

**Files:**

- Modify: `src/app/actions/documents.ts`

**Step 1: Update imports**

Change import from:

```typescript
import { requireAdmin } from '@/lib/supabase/server';
```

to:

```typescript
import { requireAnyAdmin } from '@/lib/supabase/server';
```

**Step 2: Update all 9 call sites**

Replace every `await requireAdmin()` with `await requireAnyAdmin()`:

```typescript
// Before (9 occurrences):
const user = await requireAdmin();

// After:
const { user } = await requireAnyAdmin();
```

Call sites: `fetchDocuments` (line 29), `uploadDocument` (line 131), `deleteDocument` (line 217), `updateDocumentChunks` (line 245), `regenerateEmbeddings` (line 275), `retryDocument` (line 304), `updateDocumentMeta` (line 327), `updateExamQuestions` (line 362), `updateAssignmentItems` (line 402).

Note: Course-level permission checks (`requireCourseAdmin`) will be added in Task 14 when the frontend sends courseId. For now, `requireAnyAdmin()` + RLS provides the security layer.

**Step 3: Commit**

```bash
git add src/app/actions/documents.ts
git commit -m "refactor(auth): update document actions to use requireAnyAdmin"
```

---

### Task 9: Update SSE Route — documents/parse

**Files:**

- Modify: `src/app/api/documents/parse/route.ts`

**Step 1: Update auth check**

In `src/app/api/documents/parse/route.ts`:

- Change import from `requireAdmin` to `requireAnyAdmin`
- Change the auth block (lines 87-91) from:
  ```typescript
  user = await requireAdmin();
  ```
  to:
  ```typescript
  const result = await requireAnyAdmin();
  user = result.user;
  ```

**Step 2: Commit**

```bash
git add src/app/api/documents/parse/route.ts
git commit -m "refactor(auth): update SSE parse route to use requireAnyAdmin"
```

---

### Task 10: Update Admin Layout

**Files:**

- Modify: `src/app/(protected)/admin/layout.tsx`

**Step 1: Rewrite role check to allow both admin and super_admin**

Current code (line 16) uses inline Supabase query with strict comparison:

```typescript
if (profile?.role !== 'admin') redirect('/study');
```

Replace with:

```typescript
if (profile?.role !== 'admin' && profile?.role !== 'super_admin') redirect('/study');
```

This is a rewrite of the inline comparison, NOT a function call swap.

**Step 2: Commit**

```bash
git add src/app/(protected)/admin/layout.tsx
git commit -m "refactor(auth): allow admin and super_admin in admin layout"
```

---

### Task 11: Admin Users Page — Server Component

**Files:**

- Create: `src/app/(protected)/admin/users/page.tsx`

**Step 1: Create the page**

Create `src/app/(protected)/admin/users/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { getProfileRepository } from '@/lib/repositories';
import { getCurrentUser } from '@/lib/supabase/server';
import { AdminUsersClient } from './AdminUsersClient';

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getProfileRepository().findById(user.id);
  if (profile?.role !== 'super_admin') redirect('/admin/knowledge');

  return <AdminUsersClient />;
}
```

**Step 2: Commit**

```bash
git add src/app/(protected)/admin/users/page.tsx
git commit -m "feat(ui): add admin users page (super_admin only)"
```

---

### Task 12: Admin Users Page — Client Component

**Files:**

- Create: `src/app/(protected)/admin/users/AdminUsersClient.tsx`

**Step 1: Create the client component**

This is a larger component. Key features:

- Search users by email/name
- Display user list with role badges
- Promote/demote buttons (user ↔ admin), disabled for `super_admin` rows
- Click admin row → expand to show course assignment multi-select
- Course multi-select with save button

Create `src/app/(protected)/admin/users/AdminUsersClient.tsx` with a complete Mantine-based UI:

- Use `TextInput` for search
- Use `Table` for user list
- Use `Badge` for role display (`super_admin` = red, `admin` = blue, `user` = gray)
- Use `ActionIcon` or `Button` for promote/demote
- Use `MultiSelect` (populated from `fetchCourses()`) for course assignment
- Use `showNotification` from `@/lib/notifications` for success/error feedback
- Call server actions: `searchUsers`, `promoteToAdmin`, `demoteToUser`, `setAdminCourses`, `getAdminCourseIds`
- Call `fetchCourses` and `fetchUniversities` from `@/app/actions/courses` for the course selector

The component should follow existing patterns in `AdminCoursesClient.tsx` for styling and layout.

**Step 2: Commit**

```bash
git add src/app/(protected)/admin/users/AdminUsersClient.tsx
git commit -m "feat(ui): add AdminUsersClient with user management and course assignment"
```

---

### Task 13: Admin Navigation — Role-Based Menu

**Files:**

- Identify and modify the admin navigation/sidebar component that renders admin menu items
- Likely in the sidebar or header component that shows links to `/admin/courses`, `/admin/knowledge`, `/admin/exam`

**Step 1: Find the admin navigation component**

Search for components rendering admin navigation links (e.g., links to `/admin/courses`, `/admin/knowledge`).

**Step 2: Add role-based visibility**

- `/admin/courses` → only show for `super_admin`
- `/admin/users` → only show for `super_admin` (new link)
- `/admin/knowledge` → show for both `admin` and `super_admin`
- `/admin/exam` → show for both `admin` and `super_admin`

Use the `role` from `ProfileContext` (`useProfile()`) to conditionally render menu items.

**Step 3: Commit**

```bash
git commit -m "feat(ui): add role-based admin navigation menu"
```

---

### Task 14: Knowledge Page — Course Filter for Admins

**Files:**

- Modify: `src/app/(protected)/admin/knowledge/page.tsx`
- Modify: `src/app/(protected)/admin/knowledge/KnowledgeClient.tsx`
- Modify: `src/app/actions/documents.ts` — `fetchDocuments` to support course filtering

**Step 1: Update fetchDocuments to accept courseId filter and resolve courseId for mutations**

In `src/app/actions/documents.ts`, update `fetchDocuments` to:

- Accept optional `courseId` and `role` parameters
- For `super_admin`: if courseId provided, filter by course; otherwise show all
- For `admin`: always filter by assigned courses only (query `admin_course_assignments` for the user's course IDs, then filter documents)

For mutation actions (`deleteDocument`, `updateDocumentChunks`, `regenerateEmbeddings`, `retryDocument`, `updateDocumentMeta`, `updateExamQuestions`, `updateAssignmentItems`):

- Look up the entity first to get its `course_id`
- If `course_id` exists, call `requireCourseAdmin(courseId)` instead of `requireAnyAdmin()`
- If `course_id` is null (legacy documents), fall back to ownership check (`user_id`)

**Step 2: Update KnowledgeClient**

Add a course filter dropdown at the top of the knowledge page:

- `super_admin` sees all courses in the dropdown
- `admin` sees only assigned courses
- Selecting a course filters the document list

**Step 3: Update knowledge page.tsx**

Pass user role and available courses as props to KnowledgeClient.

**Step 4: Commit**

```bash
git commit -m "feat(ui): add course filter for admin knowledge page"
```

---

### Task 15: Exam & Assignment Pages — Course Filter

**Files:**

- Apply same course filter pattern from Task 14 to exam and assignment admin pages

**Step 1: Update exam admin page**

Same pattern as knowledge page — add course filter dropdown, filter by assigned courses for admin role.

**Step 2: Update assignment admin page (if exists as separate page)**

Same pattern.

**Step 3: Commit**

```bash
git commit -m "feat(ui): add course filter for exam and assignment admin pages"
```

---

### Task 16: Type Check, Lint, Build

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run linter**

```bash
npm run lint
```

Fix any lint errors.

**Step 3: Run build**

```bash
npm run build
```

Fix any build errors.

**Step 4: Commit fixes**

```bash
git commit -m "fix(auth): resolve type and lint errors from admin permissions"
```

---

### Task 17: Tests

**Step 1: Write tests for permission check functions**

Create test file for `requireSuperAdmin`, `requireAnyAdmin`, `requireCourseAdmin` — verify they throw `ForbiddenError` for unauthorized roles and pass for authorized ones.

**Step 2: Write tests for AdminService**

Test `promoteToAdmin`, `demoteToUser`, `setCourses`, `getAvailableCourseIds` — verify role changes and course assignment logic. Verify `demoteToUser` removes all course assignments before changing role.

**Step 3: Run tests**

```bash
npx vitest run
```

**Step 4: Commit**

```bash
git commit -m "test(auth): add tests for admin permission system"
```
