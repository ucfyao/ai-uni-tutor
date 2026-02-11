-- Add doc_type and course_id to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'lecture'
  CHECK (doc_type IN ('lecture', 'exam', 'assignment'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS course_id text;

-- Add session_id to mock_exams to link with chat_sessions
ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS session_id text REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- Index for efficient course-based knowledge lookups
CREATE INDEX IF NOT EXISTS idx_documents_course_id ON documents(course_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_mock_exams_session_id ON mock_exams(session_id);
