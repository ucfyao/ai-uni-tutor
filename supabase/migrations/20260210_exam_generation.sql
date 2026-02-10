-- Add role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Exam papers (parsed from uploaded PDFs)
CREATE TABLE exam_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  title text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  school text,
  course text,
  year text,
  question_types text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'parsing' CHECK (status IN ('parsing', 'ready', 'error')),
  status_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Exam questions (individual questions parsed from papers)
CREATE TABLE exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  order_num int NOT NULL,
  type text NOT NULL,
  content text NOT NULL,
  options jsonb,
  answer text NOT NULL,
  explanation text NOT NULL,
  points int NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Mock exams (generated variants + user responses)
CREATE TABLE mock_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  responses jsonb NOT NULL DEFAULT '[]',
  score int,
  total_points int NOT NULL DEFAULT 0,
  current_index int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exam_papers_user_id ON exam_papers(user_id);
CREATE INDEX idx_exam_papers_visibility ON exam_papers(visibility);
CREATE INDEX idx_exam_questions_paper_id ON exam_questions(paper_id);
CREATE INDEX idx_mock_exams_user_id ON mock_exams(user_id);
CREATE INDEX idx_mock_exams_paper_id ON mock_exams(paper_id);

-- RLS policies
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_exams ENABLE ROW LEVEL SECURITY;

-- exam_papers: users see public + own private
CREATE POLICY "exam_papers_select" ON exam_papers FOR SELECT
  USING (visibility = 'public' OR user_id = auth.uid());

CREATE POLICY "exam_papers_insert" ON exam_papers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "exam_papers_update" ON exam_papers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "exam_papers_delete" ON exam_papers FOR DELETE
  USING (user_id = auth.uid());

-- exam_questions: follow paper access
CREATE POLICY "exam_questions_select" ON exam_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND (exam_papers.visibility = 'public' OR exam_papers.user_id = auth.uid())
  ));

CREATE POLICY "exam_questions_insert" ON exam_questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND exam_papers.user_id = auth.uid()
  ));

CREATE POLICY "exam_questions_update" ON exam_questions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND exam_papers.user_id = auth.uid()
  ));

CREATE POLICY "exam_questions_delete" ON exam_questions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM exam_papers
    WHERE exam_papers.id = exam_questions.paper_id
    AND exam_papers.user_id = auth.uid()
  ));

-- mock_exams: users see only their own
CREATE POLICY "mock_exams_select" ON mock_exams FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "mock_exams_insert" ON mock_exams FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "mock_exams_update" ON mock_exams FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "mock_exams_delete" ON mock_exams FOR DELETE
  USING (user_id = auth.uid());
