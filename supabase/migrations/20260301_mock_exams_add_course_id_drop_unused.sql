-- Add course_id FK to mock_exams, backfill from course_code, drop unused columns
ALTER TABLE mock_exams ADD COLUMN course_id UUID REFERENCES courses(id);
CREATE INDEX idx_mock_exams_course_id ON mock_exams(course_id);

-- Backfill from existing course_code
UPDATE mock_exams SET course_id = c.id
FROM courses c WHERE c.code = mock_exams.course_code AND mock_exams.course_code IS NOT NULL;

ALTER TABLE mock_exams DROP COLUMN course_name;
ALTER TABLE mock_exams DROP COLUMN school_name;
