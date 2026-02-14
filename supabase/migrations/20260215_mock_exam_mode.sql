-- Add mode column to mock_exams table
ALTER TABLE mock_exams
  ADD COLUMN mode text NOT NULL DEFAULT 'practice'
  CHECK (mode IN ('practice', 'exam'));
