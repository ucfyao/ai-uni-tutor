-- Knowledge Cards Redesign Migration
-- Creates knowledge_cards, user_cards, card_conversations tables
-- Removes card_id from chat_messages (conversations move to dedicated table)

-- ============================================================================
-- 1. Global knowledge cards (shared across users and courses)
-- ============================================================================
CREATE TABLE knowledge_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  definition text NOT NULL,
  key_formulas text[] DEFAULT '{}',
  key_concepts text[] DEFAULT '{}',
  examples text[] DEFAULT '{}',
  source_pages int[] DEFAULT '{}',
  -- Linking: which document created this card (nullable for manually curated cards)
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  -- Embedding for similarity search during chat
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deduplicate by title (case-insensitive)
CREATE UNIQUE INDEX idx_knowledge_cards_title_unique
  ON knowledge_cards (lower(title));

-- For similarity search during chat
CREATE INDEX idx_knowledge_cards_embedding
  ON knowledge_cards USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_knowledge_cards_document_id
  ON knowledge_cards (document_id);

-- RLS
ALTER TABLE knowledge_cards ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read knowledge cards (global, shared)
CREATE POLICY "knowledge_cards_select" ON knowledge_cards
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update/delete (controlled via server actions)
CREATE POLICY "knowledge_cards_insert" ON knowledge_cards
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "knowledge_cards_update" ON knowledge_cards
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "knowledge_cards_delete" ON knowledge_cards
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 2. User-created cards (per-user, from text selection)
-- ============================================================================
CREATE TABLE user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  source_message_id text,
  source_role text CHECK (source_role IN ('user', 'assistant')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_cards_user_id ON user_cards (user_id);
CREATE INDEX idx_user_cards_session_id ON user_cards (session_id);

-- RLS
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards_select" ON user_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_cards_insert" ON user_cards
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_cards_update" ON user_cards
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "user_cards_delete" ON user_cards
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- 3. Card follow-up conversations (for analytics)
-- ============================================================================
CREATE TABLE card_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  card_type text NOT NULL CHECK (card_type IN ('knowledge', 'user')),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  course_code text,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_conversations_card ON card_conversations (card_id, card_type);
CREATE INDEX idx_card_conversations_user ON card_conversations (user_id);
CREATE INDEX idx_card_conversations_session ON card_conversations (session_id);
CREATE INDEX idx_card_conversations_created ON card_conversations (created_at);

-- RLS
ALTER TABLE card_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_conversations_select" ON card_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "card_conversations_insert" ON card_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 4. Remove card_id from chat_messages (card conversations now in separate table)
-- ============================================================================
ALTER TABLE chat_messages DROP COLUMN IF EXISTS card_id;

-- ============================================================================
-- 5. RPC function for knowledge card similarity search
-- ============================================================================
CREATE OR REPLACE FUNCTION match_knowledge_cards(
  query_embedding vector(768),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  definition text,
  key_formulas text[],
  key_concepts text[],
  examples text[],
  source_pages int[],
  document_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.title,
    kc.definition,
    kc.key_formulas,
    kc.key_concepts,
    kc.examples,
    kc.source_pages,
    kc.document_id,
    kc.created_at,
    kc.updated_at,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_cards kc
  WHERE kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
