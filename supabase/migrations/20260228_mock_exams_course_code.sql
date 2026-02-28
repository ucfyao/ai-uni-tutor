-- Add course/school info columns to mock_exams for display in history
ALTER TABLE mock_exams ADD COLUMN course_code TEXT;
ALTER TABLE mock_exams ADD COLUMN course_name TEXT;
ALTER TABLE mock_exams ADD COLUMN school_name TEXT;
