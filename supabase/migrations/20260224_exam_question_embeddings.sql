-- Migration: Add embedding column and similarity search for exam questions
-- This enables semantic search across exam questions (similar to assignment_items and lecture_chunks)

-- 1. Add embedding column
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 2. HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS idx_exam_questions_embedding_hnsw
  ON exam_questions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. RPC function for semantic exam question search
CREATE OR REPLACE FUNCTION match_exam_questions(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  filter_course_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  paper_id uuid,
  order_num int,
  content text,
  answer text,
  explanation text,
  points int,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    eq.id,
    eq.paper_id,
    eq.order_num,
    eq.content,
    eq.answer,
    eq.explanation,
    eq.points,
    1 - (eq.embedding <=> query_embedding) AS similarity
  FROM exam_questions eq
  JOIN exam_papers ep ON ep.id = eq.paper_id
  WHERE eq.embedding IS NOT NULL
    AND (filter_course_id IS NULL OR ep.course_id = filter_course_id)
  ORDER BY eq.embedding <=> query_embedding
  LIMIT match_count;
$$;
