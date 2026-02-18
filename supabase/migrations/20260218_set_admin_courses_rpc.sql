-- Atomic RPC for replacing an admin's course assignments in a single transaction.
-- Prevents partial-failure states where an admin has excess course permissions.

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
