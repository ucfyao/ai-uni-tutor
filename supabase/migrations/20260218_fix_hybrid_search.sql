-- Fix hybrid_search: version-control the function and add course_id filtering
-- Previously: function existed only in remote DB, filtered by user_id (broken for admin-uploaded docs)
-- Now: filters by documents.course_id + metadata JSONB containment

-- Drop the old function signature(s) that may exist in remote DB
DROP FUNCTION IF EXISTS hybrid_search(text, vector, float, int, int, jsonb);
DROP FUNCTION IF EXISTS hybrid_search(text, vector, float, int, int);

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  rrf_k int DEFAULT 60,
  search_course_id uuid DEFAULT NULL,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      row_number() OVER (ORDER BY dc.embedding <=> query_embedding) AS rank_vector
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (search_course_id IS NULL OR d.course_id = search_course_id)
    AND dc.metadata @> filter
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      dc.id,
      dc.content,
      dc.metadata,
      0::float AS similarity,
      row_number() OVER (ORDER BY ts_rank_cd(dc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_keyword
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.fts @@ websearch_to_tsquery('english', query_text)
    AND (search_course_id IS NULL OR d.course_id = search_course_id)
    AND dc.metadata @> filter
    LIMIT match_count * 2
  )
  SELECT
    COALESCE(v.id, k.id) AS id,
    COALESCE(v.content, k.content) AS content,
    COALESCE(v.similarity, 0::float) AS similarity,
    COALESCE(v.metadata, k.metadata) AS metadata
  FROM vector_search v
  FULL OUTER JOIN keyword_search k ON v.id = k.id
  ORDER BY
    COALESCE(1.0 / (rrf_k + v.rank_vector), 0.0) +
    COALESCE(1.0 / (rrf_k + k.rank_keyword), 0.0) DESC
  LIMIT match_count;
END;
$$;
