-- Add retake_of column to mock_exams
ALTER TABLE mock_exams ADD COLUMN retake_of UUID REFERENCES mock_exams(id) ON DELETE SET NULL;

-- Create bookmarked_papers table
CREATE TABLE bookmarked_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, paper_id)
);

-- RLS
ALTER TABLE bookmarked_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bookmarks" ON bookmarked_papers
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_bookmarked_papers_user ON bookmarked_papers(user_id);
CREATE INDEX idx_mock_exams_retake_of ON mock_exams(retake_of);
