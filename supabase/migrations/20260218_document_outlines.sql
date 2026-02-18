-- Add outline columns for document-level and course-level knowledge outlines.
-- Part of knowledge pipeline multi-pass optimization.

-- Document outline: generated after knowledge point extraction
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS outline jsonb,
  ADD COLUMN IF NOT EXISTS outline_embedding vector(768);

-- Course outline: merged from all document outlines in a course
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS knowledge_outline jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_outline_embedding vector(768);

-- [M7] Vector indexes deferred until sufficient data exists.
-- IVFFlat requires ~500+ rows for lists=50 to be effective.
-- HNSW has no minimum but adds write overhead.
-- Recommended: Create HNSW indexes when documents table exceeds ~100 rows:
--   CREATE INDEX idx_documents_outline_embedding
--     ON documents USING hnsw (outline_embedding vector_cosine_ops);
--   CREATE INDEX idx_courses_knowledge_outline_embedding
--     ON courses USING hnsw (knowledge_outline_embedding vector_cosine_ops);
