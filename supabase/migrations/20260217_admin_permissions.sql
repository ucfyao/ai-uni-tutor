-- Admin Permissions Migration
-- Adds super_admin role support and course-level permission assignments
-- Rewrites RLS for 8 tables: admin_course_assignments, documents,
-- exam_papers, exam_questions, assignments, assignment_items, universities, courses
--
-- ⚠ BREAKING: universities/courses RLS changes from role='admin' to role='super_admin'.
-- Existing admin users will lose university/course CRUD access.
-- Ensure at least one user is set to super_admin BEFORE running this migration.

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
-- 3d. Add course_id FK to exam_papers and assignments
-- ============================================================================
ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id);
CREATE INDEX IF NOT EXISTS idx_exam_papers_course_id ON exam_papers (course_id);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments (course_id);

-- ============================================================================
-- 4. exam_papers — drop existing policies, add course-scoped admin support
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
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
    )
  );

CREATE POLICY "exam_papers_insert" ON exam_papers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
    )
  );

CREATE POLICY "exam_papers_update" ON exam_papers
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
    )
  );

CREATE POLICY "exam_papers_delete" ON exam_papers
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
    )
  );

-- ============================================================================
-- 5. exam_questions — parent join into exam_papers which now has course_id
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
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
  ));

CREATE POLICY "exam_questions_insert" ON exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
  ));

CREATE POLICY "exam_questions_update" ON exam_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
  ));

CREATE POLICY "exam_questions_delete" ON exam_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
  ));

-- ============================================================================
-- 6. assignments — drop existing policy, add course-scoped admin support
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own assignments" ON assignments;

CREATE POLICY "assignments_select" ON assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = assignments.course_id
    )
  );

CREATE POLICY "assignments_insert" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = assignments.course_id
    )
  );

CREATE POLICY "assignments_update" ON assignments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = assignments.course_id
    )
  );

CREATE POLICY "assignments_delete" ON assignments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM admin_course_assignments
      WHERE admin_id = auth.uid() AND course_id = assignments.course_id
    )
  );

-- ============================================================================
-- 7. assignment_items — parent join into assignments which now has course_id
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage own assignment items" ON assignment_items;

CREATE POLICY "assignment_items_select" ON assignment_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
  ));

CREATE POLICY "assignment_items_insert" ON assignment_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
  ));

CREATE POLICY "assignment_items_update" ON assignment_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
  ));

CREATE POLICY "assignment_items_delete" ON assignment_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      assignments.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
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
