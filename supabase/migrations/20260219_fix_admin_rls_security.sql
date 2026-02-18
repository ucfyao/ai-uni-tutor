-- Security fix: harden set_admin_courses RPC and all admin-path RLS policies
--
-- Bug 1: set_admin_courses (SECURITY DEFINER) had no caller auth check,
--         allowing any authenticated user to call it directly via Supabase API.
-- Bug 2: RLS policies checked admin_course_assignments without verifying
--         the user's role, so injected rows would grant data access.
-- Bug 3: set_admin_courses didn't validate that target user is an admin.
--
-- This migration:
--   1. Replaces set_admin_courses with caller + target validation
--   2. Rewrites 24 RLS policies to add role check on admin_course_assignments path

-- ============================================================================
-- 1. Fix set_admin_courses RPC — add caller auth + target role validation
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
  -- Verify caller is super_admin (fixes Bug 1)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden: only super_admin can manage course assignments';
  END IF;

  -- Verify target user is an admin (fixes Bug 3)
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_admin_id AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Target user is not an admin';
  END IF;

  -- Delete assignments not in the target set
  DELETE FROM admin_course_assignments
  WHERE admin_id = p_admin_id
    AND course_id != ALL(p_course_ids);

  -- Upsert target assignments (ON CONFLICT = no-op for existing rows)
  INSERT INTO admin_course_assignments (admin_id, course_id, assigned_by)
  SELECT p_admin_id, unnest(p_course_ids), p_assigned_by
  ON CONFLICT (admin_id, course_id) DO NOTHING;
END;
$$;

-- ============================================================================
-- 2. Fix documents RLS — add role check to admin_course_assignments path
-- ============================================================================

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      user_id = auth.uid()
      AND (
        (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = documents.course_id
          )
        )
        OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = documents.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ============================================================================
-- 3. Fix document_chunks RLS — parent join pattern with role check
-- ============================================================================

DROP POLICY IF EXISTS "document_chunks_select" ON document_chunks;
CREATE POLICY "document_chunks_select" ON document_chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = document_chunks.document_id
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = documents.course_id
        )
      )
      OR (
        documents.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  ));

-- ============================================================================
-- 4. Fix exam_papers RLS — add role check to admin_course_assignments path
-- ============================================================================

DROP POLICY IF EXISTS "exam_papers_select" ON exam_papers;
CREATE POLICY "exam_papers_select" ON exam_papers
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "exam_papers_insert" ON exam_papers;
CREATE POLICY "exam_papers_insert" ON exam_papers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      user_id = auth.uid()
      AND (
        (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
          )
        )
        OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "exam_papers_update" ON exam_papers;
CREATE POLICY "exam_papers_update" ON exam_papers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "exam_papers_delete" ON exam_papers;
CREATE POLICY "exam_papers_delete" ON exam_papers
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ============================================================================
-- 5. Fix exam_questions RLS — parent join pattern with role check
-- ============================================================================

DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
CREATE POLICY "exam_questions_select" ON exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (
      exam_papers.visibility = 'public'
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = exam_papers.course_id
        )
      )
      OR (
        exam_papers.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  ));

-- ============================================================================
-- 6. Fix assignments RLS — add role check to admin_course_assignments path
-- ============================================================================

DROP POLICY IF EXISTS "assignments_select" ON assignments;
CREATE POLICY "assignments_select" ON assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "assignments_insert" ON assignments;
CREATE POLICY "assignments_insert" ON assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      user_id = auth.uid()
      AND (
        (
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
          AND EXISTS (
            SELECT 1 FROM admin_course_assignments
            WHERE admin_id = auth.uid() AND course_id = assignments.course_id
          )
        )
        OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "assignments_update" ON assignments;
CREATE POLICY "assignments_update" ON assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "assignments_delete" ON assignments;
CREATE POLICY "assignments_delete" ON assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
      AND EXISTS (
        SELECT 1 FROM admin_course_assignments
        WHERE admin_id = auth.uid() AND course_id = assignments.course_id
      )
    )
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ============================================================================
-- 7. Fix assignment_items RLS — parent join pattern with role check
-- ============================================================================

DROP POLICY IF EXISTS "assignment_items_select" ON assignment_items;
CREATE POLICY "assignment_items_select" ON assignment_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM assignments
    WHERE assignments.id = assignment_items.assignment_id
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      OR (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
        AND EXISTS (
          SELECT 1 FROM admin_course_assignments
          WHERE admin_id = auth.uid() AND course_id = assignments.course_id
        )
      )
      OR (
        assignments.user_id = auth.uid()
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  ));
