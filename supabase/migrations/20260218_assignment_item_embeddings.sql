-- 1. Add embedding column to assignment_items
ALTER TABLE assignment_items
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 2. Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_assignment_items_embedding
ON assignment_items
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 3. Create match function
CREATE OR REPLACE FUNCTION match_assignment_items(
  query_embedding vector(768),
  match_count int DEFAULT 3,
  filter_course_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  assignment_id uuid,
  order_num int,
  content text,
  reference_answer text,
  explanation text,
  points int,
  difficulty text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai.id,
    ai.assignment_id,
    ai.order_num,
    ai.content,
    ai.reference_answer,
    ai.explanation,
    ai.points,
    ai.difficulty,
    1 - (ai.embedding <=> query_embedding) AS similarity
  FROM assignment_items ai
  INNER JOIN assignments a ON a.id = ai.assignment_id
  WHERE ai.embedding IS NOT NULL
    AND (filter_course_id IS NULL OR a.course_id = filter_course_id)
  ORDER BY ai.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
