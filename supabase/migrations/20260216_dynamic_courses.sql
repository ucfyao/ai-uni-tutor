-- Dynamic Universities & Courses Migration
-- Replaces hardcoded constants with DB-backed tables

-- ============================================================================
-- 1. Universities table
-- ============================================================================
CREATE TABLE universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "universities_select" ON universities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "universities_admin_insert" ON universities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "universities_admin_update" ON universities
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "universities_admin_delete" ON universities
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. Courses table
-- ============================================================================
CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_courses_uni_code ON courses (university_id, lower(code));
CREATE INDEX idx_courses_university_id ON courses (university_id);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select" ON courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "courses_admin_insert" ON courses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "courses_admin_update" ON courses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "courses_admin_delete" ON courses
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 3. Seed existing data with deterministic UUIDs
-- ============================================================================
INSERT INTO universities (id, name, short_name) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'University of New South Wales', 'UNSW'),
  ('a0000000-0000-0000-0000-000000000002', 'University of Sydney', 'USYD'),
  ('a0000000-0000-0000-0000-000000000003', 'Macquarie University', 'MQ'),
  ('a0000000-0000-0000-0000-000000000004', 'University of Wollongong', 'UOW');

INSERT INTO courses (id, university_id, code, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'COMP9417', 'Machine Learning'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'COMP9444', 'Deep Learning');

-- ============================================================================
-- 4. Add course_id FK to chat_sessions
-- ============================================================================
ALTER TABLE chat_sessions ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_chat_sessions_course_id ON chat_sessions (course_id);

-- Backfill: match embedded course.code to seeded courses
UPDATE chat_sessions
SET course_id = c.id
FROM courses c
WHERE chat_sessions.course->>'code' = c.code;

-- Drop the old embedded JSON column
ALTER TABLE chat_sessions DROP COLUMN course;

-- ============================================================================
-- 5. Change documents.course_id from text to uuid FK
-- ============================================================================
ALTER TABLE documents DROP COLUMN IF EXISTS course_id;
ALTER TABLE documents ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX idx_documents_course_id ON documents (course_id);
