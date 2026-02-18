-- Fix: infinite recursion in profiles RLS policies
--
-- Root cause: profiles RLS policies queried `profiles` table to check role,
-- triggering the same RLS policies again → infinite recursion.
-- All other tables' policies also reference profiles → same recursion chain.
--
-- Fix: create a SECURITY DEFINER helper function `get_my_role()` that reads
-- the current user's role bypassing RLS. Replace all policy subqueries with
-- this function call.

-- ============================================================================
-- 1. Helper function: get current user's role (bypasses RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================================
-- 2. Fix profiles policies (source of recursion)
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = get_my_role());

DROP POLICY IF EXISTS "profiles_update_superadmin" ON profiles;
CREATE POLICY "profiles_update_superadmin" ON profiles
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin');

-- ============================================================================
-- 3. Fix admin_course_assignments policies
-- ============================================================================

DROP POLICY IF EXISTS "aca_select" ON admin_course_assignments;
CREATE POLICY "aca_select" ON admin_course_assignments
  FOR SELECT TO authenticated
  USING (
    admin_id = auth.uid()
    OR get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "aca_insert" ON admin_course_assignments;
CREATE POLICY "aca_insert" ON admin_course_assignments
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "aca_update" ON admin_course_assignments;
CREATE POLICY "aca_update" ON admin_course_assignments
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "aca_delete" ON admin_course_assignments;
CREATE POLICY "aca_delete" ON admin_course_assignments
  FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- ============================================================================
-- 4. Fix documents policies
-- ============================================================================

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      user_id = auth.uid()
      AND (
        (
          get_my_role() IN ('admin', 'super_admin')
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = documents.course_id
          )
        )
        OR get_my_role() != 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

-- ============================================================================
-- 5. Fix document_chunks policies
-- ============================================================================

DROP POLICY IF EXISTS "document_chunks_select" ON document_chunks;
CREATE POLICY "document_chunks_select" ON document_chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_chunks.document_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "document_chunks_insert" ON document_chunks;
CREATE POLICY "document_chunks_insert" ON document_chunks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_chunks.document_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "document_chunks_update" ON document_chunks;
CREATE POLICY "document_chunks_update" ON document_chunks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_chunks.document_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "document_chunks_delete" ON document_chunks;
CREATE POLICY "document_chunks_delete" ON document_chunks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_chunks.document_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

-- ============================================================================
-- 6. Fix exam_papers policies
-- ============================================================================

DROP POLICY IF EXISTS "exam_papers_select" ON exam_papers;
CREATE POLICY "exam_papers_select" ON exam_papers
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "exam_papers_insert" ON exam_papers;
CREATE POLICY "exam_papers_insert" ON exam_papers
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      user_id = auth.uid()
      AND (
        (
          get_my_role() IN ('admin', 'super_admin')
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
          )
        )
        OR get_my_role() != 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "exam_papers_update" ON exam_papers;
CREATE POLICY "exam_papers_update" ON exam_papers
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "exam_papers_delete" ON exam_papers;
CREATE POLICY "exam_papers_delete" ON exam_papers
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

-- ============================================================================
-- 7. Fix exam_questions policies
-- ============================================================================

DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
CREATE POLICY "exam_questions_select" ON exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.visibility = 'public'
      OR get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "exam_questions_insert" ON exam_questions;
CREATE POLICY "exam_questions_insert" ON exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "exam_questions_update" ON exam_questions;
CREATE POLICY "exam_questions_update" ON exam_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "exam_questions_delete" ON exam_questions;
CREATE POLICY "exam_questions_delete" ON exam_questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

-- ============================================================================
-- 8. Fix assignments policies
-- ============================================================================

DROP POLICY IF EXISTS "assignments_select" ON assignments;
CREATE POLICY "assignments_select" ON assignments
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "assignments_insert" ON assignments;
CREATE POLICY "assignments_insert" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (
      user_id = auth.uid()
      AND (
        (
          get_my_role() IN ('admin', 'super_admin')
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = assignments.course_id
          )
        )
        OR get_my_role() != 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "assignments_update" ON assignments;
CREATE POLICY "assignments_update" ON assignments
  FOR UPDATE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

DROP POLICY IF EXISTS "assignments_delete" ON assignments;
CREATE POLICY "assignments_delete" ON assignments
  FOR DELETE TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR (
      get_my_role() IN ('admin', 'super_admin')
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND get_my_role() != 'admin'
    )
  );

-- ============================================================================
-- 9. Fix assignment_items policies
-- ============================================================================

DROP POLICY IF EXISTS "assignment_items_select" ON assignment_items;
CREATE POLICY "assignment_items_select" ON assignment_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "assignment_items_insert" ON assignment_items;
CREATE POLICY "assignment_items_insert" ON assignment_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "assignment_items_update" ON assignment_items;
CREATE POLICY "assignment_items_update" ON assignment_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

DROP POLICY IF EXISTS "assignment_items_delete" ON assignment_items;
CREATE POLICY "assignment_items_delete" ON assignment_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('admin', 'super_admin')
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND get_my_role() != 'admin'
      )
    )
  ));

-- ============================================================================
-- 10. Fix universities policies
-- ============================================================================

DROP POLICY IF EXISTS "universities_superadmin_insert" ON universities;
CREATE POLICY "universities_superadmin_insert" ON universities
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "universities_superadmin_update" ON universities;
CREATE POLICY "universities_superadmin_update" ON universities
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "universities_superadmin_delete" ON universities;
CREATE POLICY "universities_superadmin_delete" ON universities
  FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- ============================================================================
-- 11. Fix courses policies
-- ============================================================================

DROP POLICY IF EXISTS "courses_superadmin_insert" ON courses;
CREATE POLICY "courses_superadmin_insert" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "courses_superadmin_update" ON courses;
CREATE POLICY "courses_superadmin_update" ON courses
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "courses_superadmin_delete" ON courses;
CREATE POLICY "courses_superadmin_delete" ON courses
  FOR DELETE TO authenticated
  USING (get_my_role() = 'super_admin');

-- ============================================================================
-- 12. Update set_admin_courses RPC to use get_my_role() for consistency
-- ============================================================================

CREATE OR REPLACE FUNCTION set_admin_courses(
  p_admin_id uuid,
  p_course_ids uuid[],
  p_assigned_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super_admin
  IF get_my_role() != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: only super_admin can manage course assignments';
  END IF;

  -- Verify target user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  -- Delete assignments not in the target set
  DELETE FROM admin_course_assignments
  WHERE admin_id = p_admin_id
    AND course_id != ALL(p_course_ids);

  -- Upsert target assignments
  INSERT INTO admin_course_assignments (admin_id, course_id, assigned_by)
  SELECT p_admin_id, unnest(p_course_ids), p_assigned_by
  ON CONFLICT (admin_id, course_id) DO NOTHING;
END;
$$;
