-- Migration: Rename documents/document_chunks to lecture_documents/lecture_chunks
-- Part of the document workflow refactor to separate lecture, exam, and assignment concerns.

BEGIN;

-- ============================================================
-- 1. Table renames
-- ============================================================
ALTER TABLE documents RENAME TO lecture_documents;
ALTER TABLE document_chunks RENAME TO lecture_chunks;

-- ============================================================
-- 2. Column rename (document_id → lecture_document_id)
-- ============================================================
ALTER TABLE lecture_chunks RENAME COLUMN document_id TO lecture_document_id;

-- ============================================================
-- 3. Drop unused RPC: match_documents
-- ============================================================
DROP FUNCTION IF EXISTS match_documents(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter jsonb
);

-- ============================================================
-- 4. Recreate hybrid_search() with updated table references
--    (documents → lecture_documents, document_chunks → lecture_chunks,
--     document_id → lecture_document_id)
-- ============================================================
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
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
  WITH semantic AS (
    SELECT
      lc.id,
      lc.content,
      1 - (lc.embedding <=> query_embedding) AS similarity,
      lc.metadata,
      ROW_NUMBER() OVER (ORDER BY lc.embedding <=> query_embedding) AS rank_ix
    FROM lecture_chunks lc
    JOIN lecture_documents ld ON ld.id = lc.lecture_document_id
    WHERE
      1 - (lc.embedding <=> query_embedding) > match_threshold
      AND (search_course_id IS NULL OR ld.course_id = search_course_id)
      AND (filter = '{}'::jsonb OR lc.metadata @> filter)
    ORDER BY lc.embedding <=> query_embedding
    LIMIT LEAST(match_count, 30) * 2
  ),
  keyword AS (
    SELECT
      lc.id,
      lc.content,
      lc.metadata,
      ts_rank_cd(to_tsvector('english', lc.content), websearch_to_tsquery('english', query_text)) AS rank_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(to_tsvector('english', lc.content), websearch_to_tsquery('english', query_text)) DESC
      ) AS rank_ix
    FROM lecture_chunks lc
    JOIN lecture_documents ld ON ld.id = lc.lecture_document_id
    WHERE
      to_tsvector('english', lc.content) @@ websearch_to_tsquery('english', query_text)
      AND (search_course_id IS NULL OR ld.course_id = search_course_id)
      AND (filter = '{}'::jsonb OR lc.metadata @> filter)
    ORDER BY rank_score DESC
    LIMIT LEAST(match_count, 30) * 2
  )
  SELECT
    COALESCE(s.id, k.id) AS id,
    COALESCE(s.content, k.content) AS content,
    COALESCE(s.similarity, 0.0::float) AS similarity,
    COALESCE(s.metadata, k.metadata) AS metadata
  FROM semantic s
  FULL OUTER JOIN keyword k ON s.id = k.id
  ORDER BY
    COALESCE(1.0 / (rrf_k + s.rank_ix), 0.0) +
    COALESCE(1.0 / (rrf_k + k.rank_ix), 0.0)
    DESC
  LIMIT LEAST(match_count, 30);
END;
$$;

-- ============================================================
-- 5. FK cleanup: drop document_id from exam_papers and knowledge_cards
-- ============================================================
ALTER TABLE exam_papers DROP COLUMN IF EXISTS document_id;
ALTER TABLE knowledge_cards DROP COLUMN IF EXISTS document_id;

-- ============================================================
-- 6. Status data migration (BEFORE constraint changes)
-- ============================================================
UPDATE lecture_documents SET status = 'draft' WHERE status IN ('processing', 'error');
UPDATE exam_papers SET status = 'draft' WHERE status IN ('parsing', 'error');
UPDATE assignments SET status = 'draft' WHERE status IN ('parsing', 'error');

-- ============================================================
-- 7. Drop status_message columns
-- ============================================================
ALTER TABLE lecture_documents DROP COLUMN IF EXISTS status_message;
ALTER TABLE exam_papers DROP COLUMN IF EXISTS status_message;
ALTER TABLE assignments DROP COLUMN IF EXISTS status_message;

-- ============================================================
-- 8. Update CHECK constraints: status only allows ('draft', 'ready')
-- ============================================================

-- lecture_documents
ALTER TABLE lecture_documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE lecture_documents DROP CONSTRAINT IF EXISTS lecture_documents_status_check;
ALTER TABLE lecture_documents ADD CONSTRAINT lecture_documents_status_check
  CHECK (status IN ('draft', 'ready'));

-- exam_papers
ALTER TABLE exam_papers DROP CONSTRAINT IF EXISTS exam_papers_status_check;
ALTER TABLE exam_papers ADD CONSTRAINT exam_papers_status_check
  CHECK (status IN ('draft', 'ready'));

-- assignments
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('draft', 'ready'));

COMMIT;
