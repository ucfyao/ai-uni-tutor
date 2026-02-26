-- Drop paper_id column from mock_exams (no longer needed — questions stored in JSON)
ALTER TABLE mock_exams DROP COLUMN IF EXISTS paper_id;
