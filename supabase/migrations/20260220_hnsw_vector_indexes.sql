-- Migration: Add HNSW vector indexes for similarity search performance
-- These indexes use cosine distance (vector_cosine_ops) matching the <=> operator
-- used in hybrid_search and match_knowledge_cards RPCs.

-- Index on lecture_chunks.embedding — used by hybrid_search RPC (main chat retrieval)
CREATE INDEX IF NOT EXISTS idx_lecture_chunks_embedding_hnsw
  ON lecture_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index on knowledge_cards.embedding — used by match_knowledge_cards RPC
CREATE INDEX IF NOT EXISTS idx_knowledge_cards_embedding_hnsw
  ON knowledge_cards
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
