-- Add tree-based branching to chat_messages (parent_message_id pattern)
ALTER TABLE chat_messages
  ADD COLUMN parent_message_id uuid DEFAULT NULL
    REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Index for parent lookups (find children / siblings)
CREATE INDEX idx_chat_messages_parent ON chat_messages (parent_message_id)
  WHERE parent_message_id IS NOT NULL;

-- Backfill existing messages into linear chains by created_at order within each session.
-- This is a one-time backfill — new messages will have parent_message_id set by the app.
WITH ordered AS (
  SELECT id, session_id,
    LAG(id) OVER (PARTITION BY session_id ORDER BY created_at, id) AS prev_id
  FROM chat_messages
)
UPDATE chat_messages m
  SET parent_message_id = o.prev_id
  FROM ordered o
  WHERE m.id = o.id AND o.prev_id IS NOT NULL;
